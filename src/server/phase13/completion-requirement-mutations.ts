import { JobStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageJobTaskCompletionRequirements } from "@/lib/phase13-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { recordJobActivity } from "@/server/phase5/record-job-activity";
import {
  parseJobTaskCompletionRequirements,
  requirementSummaryForAudit,
  serializeEvidenceRequirementInput,
  toCompletionRequirementDto,
} from "@/server/phase13/completion-requirements";
import { updateJobTaskCompletionRequirementsSchema } from "@/server/phase13/validation";
import { zodActionFailure } from "@/server/phase2/quote-mutations";

export type CompletionRequirementMutationResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function jobMutationUpdateJobTaskCompletionRequirements(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<CompletionRequirementMutationResult> {
  if (!canManageJobTaskCompletionRequirements(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit completion requirements." };
  }

  const requiredRaw = formData.get("required");
  const allowRaw = formData.get("allowJobLevelEvidence");

  const parsed = updateJobTaskCompletionRequirementsSchema.safeParse({
    jobId: formData.get("jobId"),
    jobTaskId: formData.get("jobTaskId"),
    required: requiredRaw === "true" || requiredRaw === "on" || requiredRaw === "1",
    minAcceptedCount: formData.get("minAcceptedCount") ?? 1,
    allowJobLevelEvidence: allowRaw === "true" || allowRaw === "on" || allowRaw === "1",
  });

  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.jobTask.findFirst({
    where: {
      id: parsed.data.jobTaskId,
      jobId: parsed.data.jobId,
      organizationId: ctx.organizationId,
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      completionRequirementsJson: true,
      job: { select: { status: true } },
    },
  });

  if (!task) {
    return { ok: false, error: "Task not found." };
  }

  if (task.job.status === JobStatus.COMPLETED || task.job.status === JobStatus.CANCELED) {
    return { ok: false, error: "This job is closed. Completion requirements cannot be edited." };
  }

  let nextJson: Prisma.InputJsonValue | null;
  try {
    nextJson = serializeEvidenceRequirementInput({
      required: parsed.data.required,
      minAcceptedCount: parsed.data.minAcceptedCount,
      allowJobLevelEvidence: parsed.data.allowJobLevelEvidence,
    }) as Prisma.InputJsonValue | null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid input." };
  }

  const prevDto = toCompletionRequirementDto(
    parseJobTaskCompletionRequirements(task.completionRequirementsJson),
  );
  const nextDto = toCompletionRequirementDto(parseJobTaskCompletionRequirements(nextJson));

  await prisma.$transaction(async (tx) => {
    await tx.jobTask.update({
      where: { id: task.id },
      data: {
        completionRequirementsJson: nextJson === null ? Prisma.JsonNull : nextJson,
      },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: parsed.data.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.JOB_TASK_COMPLETION_REQUIREMENTS_UPDATED,
      summary: `Completion requirements updated for task "${task.title}"`,
      payloadJson: {
        jobTaskId: task.id,
        previous: requirementSummaryForAudit(prevDto),
        next: requirementSummaryForAudit(nextDto),
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        type: "JOB_TASK_COMPLETION_REQUIREMENTS_UPDATED",
        payload: {
          jobId: parsed.data.jobId,
          jobTaskId: task.id,
          previousSummary: requirementSummaryForAudit(prevDto),
          nextSummary: requirementSummaryForAudit(nextDto),
        },
      },
    });
  });

  return { ok: true, jobId: parsed.data.jobId };
}
