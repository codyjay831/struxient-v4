import { JobEvidenceStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  parseJobTaskCompletionRequirements,
  type ParsedCompletionRequirements,
} from "@/server/phase13/completion-requirements";

export type EvaluateJobTaskCompletionRequirementsParams = {
  organizationId: string;
  jobId: string;
  jobTaskId: string;
  completionRequirementsJson: unknown;
  /** Optional Prisma client for transactions */
  db?: Prisma.TransactionClient | typeof prisma;
};

export type EvidenceRequirementEvaluation =
  | { satisfied: true; reason: "none" | "satisfied" }
  | {
      satisfied: false;
      reason: "invalid_configuration" | "insufficient_evidence";
      message: string;
      requiredCount: number;
      acceptedCount: number;
    };

/**
 * Count ACCEPTED JobEvidence for completion gate.
 * - Task-linked: jobTaskId = jobTaskId
 * - Job-level (only when allowJobLevelEvidence): jobTaskId is null
 */
export async function countAcceptedJobEvidenceForTask(
  ctx: Pick<OrgSessionContext, "organizationId">,
  jobId: string,
  jobTaskId: string,
  options: { allowJobLevelEvidence: boolean },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const orgWhere = { organizationId: ctx.organizationId, jobId, status: JobEvidenceStatus.ACCEPTED };

  if (!options.allowJobLevelEvidence) {
    return db.jobEvidence.count({
      where: {
        ...orgWhere,
        jobTaskId,
      },
    });
  }

  return db.jobEvidence.count({
    where: {
      ...orgWhere,
      OR: [{ jobTaskId }, { jobTaskId: null }],
    },
  });
}

export type AcceptedEvidenceCountMaps = {
  taskLinked: Map<string, number>;
  jobLevel: number;
};

/** One query: all ACCEPTED evidence rows for a job (task-linked and job-level). */
export async function loadAcceptedEvidenceCountMapsForJob(
  ctx: Pick<OrgSessionContext, "organizationId">,
  jobId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<AcceptedEvidenceCountMaps> {
  const rows = await db.jobEvidence.findMany({
    where: {
      organizationId: ctx.organizationId,
      jobId,
      status: JobEvidenceStatus.ACCEPTED,
    },
    select: { jobTaskId: true },
  });
  let jobLevel = 0;
  const taskLinked = new Map<string, number>();
  for (const r of rows) {
    if (r.jobTaskId === null) {
      jobLevel += 1;
    } else {
      taskLinked.set(r.jobTaskId, (taskLinked.get(r.jobTaskId) ?? 0) + 1);
    }
  }
  return { taskLinked, jobLevel };
}

/** Accepted count for completion gate semantics (matches SQL OR logic). */
export function acceptedEvidenceCountForTaskFromMaps(
  taskId: string,
  allowJobLevelEvidence: boolean,
  maps: AcceptedEvidenceCountMaps,
): number {
  const linked = maps.taskLinked.get(taskId) ?? 0;
  if (!allowJobLevelEvidence) {
    return linked;
  }
  return linked + maps.jobLevel;
}

export async function evaluateJobTaskCompletionRequirements(
  params: EvaluateJobTaskCompletionRequirementsParams,
): Promise<EvidenceRequirementEvaluation> {
  const db = params.db ?? prisma;
  const parsed: ParsedCompletionRequirements = parseJobTaskCompletionRequirements(
    params.completionRequirementsJson,
  );

  if (parsed.kind === "none") {
    return { satisfied: true, reason: "none" };
  }

  if (parsed.kind === "invalid") {
    return {
      satisfied: false,
      reason: "invalid_configuration",
      message:
        "This task has an invalid completion requirement configuration. Ask the office to review it.",
      requiredCount: 0,
      acceptedCount: 0,
    };
  }

  const min = parsed.v1.evidence.minAcceptedCount ?? 1;
  const allowJob = parsed.v1.evidence.allowJobLevelEvidence;
  const maps = await loadAcceptedEvidenceCountMapsForJob(
    { organizationId: params.organizationId },
    params.jobId,
    db,
  );
  const accepted = acceptedEvidenceCountForTaskFromMaps(params.jobTaskId, allowJob, maps);

  if (accepted >= min) {
    return { satisfied: true, reason: "satisfied" };
  }

  return {
    satisfied: false,
    reason: "insufficient_evidence",
    message: "This task requires accepted evidence before it can be completed.",
    requiredCount: min,
    acceptedCount: accepted,
  };
}
