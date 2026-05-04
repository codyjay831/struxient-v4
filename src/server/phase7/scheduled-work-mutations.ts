import { JobStatus, JobTaskStatus, Prisma, ScheduledWorkStatus, ScheduledWorkType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canMutateSchedule } from "@/lib/phase7-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { zodActionFailure } from "@/server/phase2/quote-mutations";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { recordJobActivity } from "@/server/phase5/record-job-activity";
import { assertNoActiveScheduledWorkForTask, canAttachNewScheduleToJob } from "@/server/phase7/scheduled-work-queries";
import { isTaskSchedulable } from "@/server/phase7/schedule-readiness";
import {
  cancelScheduledWorkSchema,
  rescheduleScheduledWorkSchema,
  scheduleJobTaskSchema,
} from "@/server/phase7/validation";

export type ScheduledWorkActionResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function formString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (v === null || v === undefined) {
    return undefined;
  }
  return typeof v === "string" ? v : String(v);
}

export async function jobMutationScheduleJobTask(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<ScheduledWorkActionResult> {
  if (!canMutateSchedule(ctx.role)) {
    return { ok: false, error: "You do not have permission to schedule work." };
  }

  const parsed = scheduleJobTaskSchema.safeParse({
    jobId: formString(formData, "jobId"),
    jobTaskId: formString(formData, "jobTaskId"),
    scheduledStartAt: formString(formData, "scheduledStartAt"),
    scheduledEndAt: formString(formData, "scheduledEndAt"),
    title: formString(formData, "title"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const title = (parsed.data.title ?? "").trim() || undefined;

  try {
    await prisma.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { id: parsed.data.jobId, organizationId: ctx.organizationId },
        select: { id: true, status: true },
      });
      if (!job) {
        throw new Error("JOB_NOT_FOUND");
      }
      if (job.status === JobStatus.WORK_PLAN_REVIEW) {
        throw new Error("JOB_IN_REVIEW");
      }
      if (!canAttachNewScheduleToJob(job.status)) {
        throw new Error("JOB_CLOSED");
      }

      const task = await tx.jobTask.findFirst({
        where: {
          id: parsed.data.jobTaskId,
          jobId: parsed.data.jobId,
          organizationId: ctx.organizationId,
        },
        select: { id: true, title: true, status: true },
      });
      if (!task) {
        throw new Error("TASK_NOT_FOUND");
      }
      if (task.status === JobTaskStatus.COMPLETE) {
        throw new Error("TASK_COMPLETE");
      }
      if (!isTaskSchedulable(task.status)) {
        throw new Error("TASK_NOT_SCHEDULABLE");
      }

      const slotFree = await assertNoActiveScheduledWorkForTask(tx, ctx.organizationId, task.id);
      if (!slotFree) {
        throw new Error("DUPLICATE_ACTIVE");
      }

      const rowTitle = title ?? task.title;

      const created = await tx.scheduledWork.create({
        data: {
          organizationId: ctx.organizationId,
          jobId: job.id,
          jobTaskId: task.id,
          type: ScheduledWorkType.JOB_TASK,
          status: ScheduledWorkStatus.SCHEDULED,
          title: rowTitle,
          scheduledStartAt: parsed.data.scheduledStartAt,
          scheduledEndAt: parsed.data.scheduledEndAt,
          notes: parsed.data.notes?.trim() || null,
          createdByUserId: ctx.userId,
        },
      });

      await recordJobActivity(tx, {
        organizationId: ctx.organizationId,
        jobId: job.id,
        actorUserId: ctx.userId,
        eventType: JobActivityEventType.SCHEDULED_WORK_CREATED,
        summary: `Scheduled "${rowTitle}" (${parsed.data.scheduledStartAt.toISOString()} – ${parsed.data.scheduledEndAt.toISOString()}).`,
        payloadJson: {
          scheduledWorkId: created.id,
          jobTaskId: task.id,
          scheduledStartAt: parsed.data.scheduledStartAt.toISOString(),
          scheduledEndAt: parsed.data.scheduledEndAt.toISOString(),
        } satisfies Prisma.InputJsonValue,
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "This task already has an active scheduled window. Cancel or reschedule the existing entry first.",
      };
    }
    if (e instanceof Error) {
      if (e.message === "JOB_NOT_FOUND" || e.message === "TASK_NOT_FOUND") {
        return { ok: false, error: "Job or task was not found." };
      }
      if (e.message === "JOB_IN_REVIEW") {
        return { ok: false, error: "Scheduling is not allowed during work plan review." };
      }
      if (e.message === "JOB_CLOSED") {
        return { ok: false, error: "This job is closed; new schedule entries are not allowed." };
      }
      if (e.message === "TASK_COMPLETE") {
        return { ok: false, error: "Completed tasks cannot be scheduled." };
      }
      if (e.message === "TASK_NOT_SCHEDULABLE") {
        return { ok: false, error: "This task cannot be scheduled in its current state." };
      }
      if (e.message === "DUPLICATE_ACTIVE") {
        return {
          ok: false,
          error: "This task already has an active scheduled window. Cancel or reschedule the existing entry first.",
        };
      }
    }
    throw e;
  }

  return { ok: true, jobId: parsed.data.jobId };
}

export async function jobMutationRescheduleScheduledWork(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<ScheduledWorkActionResult> {
  if (!canMutateSchedule(ctx.role)) {
    return { ok: false, error: "You do not have permission to reschedule work." };
  }

  const parsed = rescheduleScheduledWorkSchema.safeParse({
    scheduledWorkId: formString(formData, "scheduledWorkId"),
    scheduledStartAt: formString(formData, "scheduledStartAt"),
    scheduledEndAt: formString(formData, "scheduledEndAt"),
    notes: formString(formData, "notes"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const row = await prisma.scheduledWork.findFirst({
    where: { id: parsed.data.scheduledWorkId, organizationId: ctx.organizationId },
    include: { job: { select: { id: true, status: true } } },
  });
  if (!row) {
    return { ok: false, error: "Scheduled work was not found." };
  }
  if (row.status !== ScheduledWorkStatus.SCHEDULED) {
    return { ok: false, error: "Only active scheduled rows can be rescheduled." };
  }
  if (row.job.status === JobStatus.COMPLETED || row.job.status === JobStatus.CANCELED) {
    return { ok: false, error: "The job is closed; use cancel to clear this window if needed." };
  }

  const prevStart = row.scheduledStartAt.toISOString();
  const prevEnd = row.scheduledEndAt.toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.scheduledWork.update({
      where: { id: row.id },
      data: {
        scheduledStartAt: parsed.data.scheduledStartAt,
        scheduledEndAt: parsed.data.scheduledEndAt,
        notes: (parsed.data.notes ?? "").trim() || null,
      },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: row.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.SCHEDULED_WORK_RESCHEDULED,
      summary: `Rescheduled "${row.title}" (${prevStart} – ${prevEnd} → ${parsed.data.scheduledStartAt.toISOString()} – ${parsed.data.scheduledEndAt.toISOString()}).`,
      payloadJson: {
        scheduledWorkId: row.id,
        jobTaskId: row.jobTaskId,
        previousStartAt: prevStart,
        previousEndAt: prevEnd,
        scheduledStartAt: parsed.data.scheduledStartAt.toISOString(),
        scheduledEndAt: parsed.data.scheduledEndAt.toISOString(),
      } satisfies Prisma.InputJsonValue,
    });
  });

  return { ok: true, jobId: row.jobId };
}

export async function jobMutationCancelScheduledWork(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<ScheduledWorkActionResult> {
  if (!canMutateSchedule(ctx.role)) {
    return { ok: false, error: "You do not have permission to cancel scheduled work." };
  }

  const parsed = cancelScheduledWorkSchema.safeParse({
    scheduledWorkId: formString(formData, "scheduledWorkId"),
    cancelReason: formString(formData, "cancelReason"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const row = await prisma.scheduledWork.findFirst({
    where: { id: parsed.data.scheduledWorkId, organizationId: ctx.organizationId },
    select: {
      id: true,
      jobId: true,
      jobTaskId: true,
      title: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  });
  if (!row) {
    return { ok: false, error: "Scheduled work was not found." };
  }
  if (row.status !== ScheduledWorkStatus.SCHEDULED) {
    return { ok: false, error: "Only active scheduled rows can be canceled." };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.scheduledWork.update({
      where: { id: row.id },
      data: {
        status: ScheduledWorkStatus.CANCELED,
        canceledAt: now,
        canceledByUserId: ctx.userId,
        cancelReason: parsed.data.cancelReason,
      },
    });

    await recordJobActivity(tx, {
      organizationId: ctx.organizationId,
      jobId: row.jobId,
      actorUserId: ctx.userId,
      eventType: JobActivityEventType.SCHEDULED_WORK_CANCELED,
      summary: `Canceled scheduled work "${row.title}" (${row.scheduledStartAt.toISOString()} – ${row.scheduledEndAt.toISOString()}).`,
      payloadJson: {
        scheduledWorkId: row.id,
        jobTaskId: row.jobTaskId,
        previousStartAt: row.scheduledStartAt.toISOString(),
        previousEndAt: row.scheduledEndAt.toISOString(),
        cancelReason: parsed.data.cancelReason,
      } satisfies Prisma.InputJsonValue,
    });
  });

  return { ok: true, jobId: row.jobId };
}
