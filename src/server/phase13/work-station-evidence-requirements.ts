import { JobStatus, JobTaskStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { parseJobTaskCompletionRequirements } from "@/server/phase13/completion-requirements";
import {
  acceptedEvidenceCountForTaskFromMaps,
  loadAcceptedEvidenceCountMapsForJob,
} from "@/server/phase13/evidence-requirement-evaluation";

export const WORK_STATION_EVIDENCE_REQUIREMENT_CARD_CAP = 12;

export type EvidenceRequirementWorkStationRow = {
  taskId: string;
  jobId: string;
  taskTitle: string;
  jobDisplayNumber: number;
  customerDisplayName: string;
  requiredCount: number;
  acceptedCount: number;
};

/**
 * Tasks in READY/IN_PROGRESS with an active evidence requirement and insufficient ACCEPTED evidence.
 * Office/management feed only — caller must enforce role.
 */
export async function listJobTasksNeedingAcceptedEvidenceForWorkStation(
  ctx: OrgSessionContext,
): Promise<EvidenceRequirementWorkStationRow[]> {
  const candidates = await prisma.jobTask.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { in: [JobTaskStatus.READY, JobTaskStatus.IN_PROGRESS] },
      completionRequirementsJson: { not: Prisma.DbNull },
      job: { status: { in: [JobStatus.ACTIVE, JobStatus.PAUSED] } },
    },
    select: {
      id: true,
      title: true,
      jobId: true,
      completionRequirementsJson: true,
      job: {
        select: {
          displayNumber: true,
          customer: { select: { displayName: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const out: EvidenceRequirementWorkStationRow[] = [];
  const mapsByJob = new Map<string, Awaited<ReturnType<typeof loadAcceptedEvidenceCountMapsForJob>>>();

  for (const t of candidates) {
    const parsed = parseJobTaskCompletionRequirements(t.completionRequirementsJson);
    if (parsed.kind !== "valid") {
      continue;
    }
    const min = parsed.v1.evidence.minAcceptedCount ?? 1;
    const allowJob = parsed.v1.evidence.allowJobLevelEvidence;
    let maps = mapsByJob.get(t.jobId);
    if (!maps) {
      maps = await loadAcceptedEvidenceCountMapsForJob(ctx, t.jobId);
      mapsByJob.set(t.jobId, maps);
    }
    const accepted = acceptedEvidenceCountForTaskFromMaps(t.id, allowJob, maps);
    if (accepted >= min) {
      continue;
    }
    out.push({
      taskId: t.id,
      jobId: t.jobId,
      taskTitle: t.title,
      jobDisplayNumber: t.job.displayNumber,
      customerDisplayName: t.job.customer.displayName.trim(),
      requiredCount: min,
      acceptedCount: accepted,
    });
    if (out.length >= WORK_STATION_EVIDENCE_REQUIREMENT_CARD_CAP) {
      break;
    }
  }

  return out;
}
