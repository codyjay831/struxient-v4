import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canChangeJobStatus } from "@/lib/phase5-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { zodActionFailure } from "@/server/phase2/quote-mutations";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { getJobProgressForJob } from "@/server/phase5/job-progress";
import { recordJobActivity } from "@/server/phase5/record-job-activity";
import { jobCancelActionSchema, jobIdActionSchema, jobPauseActionSchema } from "@/server/phase5/validation";

export type JobLifecycleActionResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function statusSummary(from: JobStatus, to: JobStatus) {
  return `Job status changed: ${from} → ${to}`;
}

async function loadJobRow(organizationId: string, jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: { id: true, status: true, displayNumber: true },
  });
}

export async function jobMutationPause(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  if (!canChangeJobStatus(ctx.role)) {
    return { ok: false, error: "You do not have permission to change job status." };
  }
  const noteRaw = formData.get("statusReason");
  const parsed = jobPauseActionSchema.safeParse({
    jobId: formData.get("jobId"),
    statusReason: noteRaw === null || noteRaw === "" ? undefined : String(noteRaw),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const job = await loadJobRow(ctx.organizationId, parsed.data.jobId);
  if (!job) {
    return { ok: false, error: "Job not found." };
  }
  if (job.status !== JobStatus.ACTIVE) {
    return { ok: false, error: "Only an active job can be paused." };
  }

  const now = new Date();
  const note = (parsed.data.statusReason ?? "").trim() || null;

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.PAUSED,
        pausedAt: now,
        statusReason: note,
      },
    });
    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: job.id,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.JOB_STATUS_CHANGED,
      summary: statusSummary(JobStatus.ACTIVE, JobStatus.PAUSED),
      payloadJson: { from: JobStatus.ACTIVE, to: JobStatus.PAUSED },
    });
  });

  return { ok: true, jobId: job.id };
}

export async function jobMutationResume(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  if (!canChangeJobStatus(ctx.role)) {
    return { ok: false, error: "You do not have permission to change job status." };
  }
  const parsed = jobIdActionSchema.safeParse({ jobId: formData.get("jobId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const job = await loadJobRow(ctx.organizationId, parsed.data.jobId);
  if (!job) {
    return { ok: false, error: "Job not found." };
  }
  if (job.status !== JobStatus.PAUSED) {
    return { ok: false, error: "Only a paused job can be resumed." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.ACTIVE,
        statusReason: null,
      },
    });
    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: job.id,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.JOB_STATUS_CHANGED,
      summary: statusSummary(JobStatus.PAUSED, JobStatus.ACTIVE),
      payloadJson: { from: JobStatus.PAUSED, to: JobStatus.ACTIVE },
    });
  });

  return { ok: true, jobId: job.id };
}

export async function jobMutationComplete(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  if (!canChangeJobStatus(ctx.role)) {
    return { ok: false, error: "You do not have permission to change job status." };
  }
  const parsed = jobIdActionSchema.safeParse({ jobId: formData.get("jobId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const job = await loadJobRow(ctx.organizationId, parsed.data.jobId);
  if (!job) {
    return { ok: false, error: "Job not found." };
  }
  if (job.status !== JobStatus.ACTIVE && job.status !== JobStatus.PAUSED) {
    return { ok: false, error: "Only an active or paused job can be completed." };
  }

  const progress = await getJobProgressForJob(ctx.organizationId, job.id);
  const openRequired = progress.requiredTotal - progress.requiredComplete;
  if (openRequired > 0) {
    return {
      ok: false,
      error: `${openRequired} of ${progress.requiredTotal} required tasks are still open. Finish all required tasks before completing the job.`,
    };
  }

  const now = new Date();
  const fromStatus = job.status;

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: now,
        statusReason: null,
      },
    });
    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: job.id,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.JOB_STATUS_CHANGED,
      summary: statusSummary(fromStatus, JobStatus.COMPLETED),
      payloadJson: { from: fromStatus, to: JobStatus.COMPLETED },
    });
  });

  return { ok: true, jobId: job.id };
}

export async function jobMutationCancel(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  if (!canChangeJobStatus(ctx.role)) {
    return { ok: false, error: "You do not have permission to change job status." };
  }
  const parsed = jobCancelActionSchema.safeParse({
    jobId: formData.get("jobId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const job = await loadJobRow(ctx.organizationId, parsed.data.jobId);
  if (!job) {
    return { ok: false, error: "Job not found." };
  }
  if (job.status !== JobStatus.ACTIVE && job.status !== JobStatus.PAUSED) {
    return { ok: false, error: "This job cannot be canceled from its current status." };
  }

  const now = new Date();
  const fromStatus = job.status;
  const reason = parsed.data.reason.trim();

  await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.CANCELED,
        canceledAt: now,
        statusReason: reason,
      },
    });
    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: job.id,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.JOB_STATUS_CHANGED,
      summary: statusSummary(fromStatus, JobStatus.CANCELED),
      payloadJson: { from: fromStatus, to: JobStatus.CANCELED, reason },
    });
  });

  return { ok: true, jobId: job.id };
}
