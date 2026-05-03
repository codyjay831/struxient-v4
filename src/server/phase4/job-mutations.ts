import { JobStatus, JobTaskStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { canUpdateJobTaskStatus } from "@/lib/phase4-permissions";

import { canCompleteJobTaskWithEvidenceOverride } from "@/lib/phase13-permissions";

import { canUpdateJobTaskWhenJobPaused } from "@/lib/phase5-permissions";

import type { OrgSessionContext } from "@/server/phase1/org-session";

import { zodActionFailure } from "@/server/phase2/quote-mutations";

import { JobActivityEventType, type JobActivityEventTypeName } from "@/server/phase5/job-activity-types";

import { isAllowedJobTaskStatusTransition } from "@/server/phase5/job-task-transitions";

import { recordJobActivity } from "@/server/phase5/record-job-activity";

import { evaluateJobTaskCompletionRequirements } from "@/server/phase13/evidence-requirement-evaluation";

import { isTaskCompletionGateError, TaskCompletionGateError } from "@/server/phase13/task-completion-gate-error";

import { completeJobTaskEvidenceOverrideReasonMax } from "@/server/phase13/validation";

import { updateJobTaskStatusSchema } from "@/server/phase5/validation";



export type JobTaskActionResult =

  | { ok: true; jobId: string }

  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };



function taskStatusSummary(title: string, from: JobTaskStatus, to: JobTaskStatus) {

  return `Task "${title}": ${from} → ${to}`;

}



function readEvidenceOverrideFromForm(formData: FormData): { active: boolean; reason: string } {

  const raw = formData.get("evidenceCompletionOverride");

  const active = raw === "true" || raw === "on" || raw === "1";

  const reasonRaw = formData.get("overrideReason");

  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";

  return { active, reason };

}



export async function jobMutationUpdateTaskStatus(

  ctx: OrgSessionContext,

  formData: FormData,

): Promise<JobTaskActionResult> {

  const blockedRaw = formData.get("blockedReason");

  const parsed = updateJobTaskStatusSchema.safeParse({

    jobId: formData.get("jobId"),

    taskId: formData.get("taskId"),

    status: formData.get("status"),

    blockedReason:

      blockedRaw === null || blockedRaw === "" ? undefined : typeof blockedRaw === "string" ? blockedRaw : String(blockedRaw),

  });

  if (!parsed.success) {

    return { ok: false, ...zodActionFailure(parsed.error) };

  }



  const task = await prisma.jobTask.findFirst({

    where: {

      id: parsed.data.taskId,

      jobId: parsed.data.jobId,

      organizationId: ctx.organizationId,

    },

    include: { job: { select: { id: true, organizationId: true, status: true } } },

  });

  if (!task) {

    return { ok: false, error: "Task not found." };

  }



  if (!canUpdateJobTaskStatus(ctx.role)) {

    return { ok: false, error: "You do not have permission to update job tasks." };

  }



  const jobStatus = task.job.status;

  if (jobStatus === JobStatus.COMPLETED || jobStatus === JobStatus.CANCELED) {

    return { ok: false, error: "This job is closed. Task status cannot be changed." };

  }

  if (jobStatus === JobStatus.PAUSED && !canUpdateJobTaskWhenJobPaused(ctx.role)) {

    return {

      ok: false,

      error:

        "This job is paused. Field roles cannot update tasks until the office resumes the job or updates the task on your behalf.",

    };

  }



  const from = task.status;

  const to = parsed.data.status;



  if (from === to) {

    return { ok: true, jobId: task.jobId };

  }



  if (!isAllowedJobTaskStatusTransition(from, to, ctx.role)) {

    return { ok: false, error: "That status change is not allowed for this task or your role." };

  }



  const trimmedBlock = (parsed.data.blockedReason ?? "").trim();

  const enteringBlocked = to === JobTaskStatus.BLOCKED && from !== JobTaskStatus.BLOCKED;

  const enteringComplete = to === JobTaskStatus.COMPLETE;

  const leavingComplete = from === JobTaskStatus.COMPLETE && to !== JobTaskStatus.COMPLETE;



  const blockedReasonNext = to === JobTaskStatus.BLOCKED ? trimmedBlock : null;



  let completedAt = task.completedAt;

  let completedByUserId = task.completedByUserId;

  if (to === JobTaskStatus.COMPLETE) {

    completedAt = new Date();

    completedByUserId = ctx.userId;

  } else if (leavingComplete) {

    completedAt = null;

    completedByUserId = null;

  }



  const now = new Date();



  let eventType: JobActivityEventTypeName = JobActivityEventType.JOB_TASK_STATUS_UPDATED;

  if (enteringBlocked) {

    eventType = JobActivityEventType.JOB_TASK_BLOCKED;

  } else if (enteringComplete) {

    eventType = JobActivityEventType.JOB_TASK_COMPLETED;

  }



  const overrideRead = readEvidenceOverrideFromForm(formData);



  const payloadJson = {

    taskId: task.id,

    from,

    to,

    ...(enteringBlocked && trimmedBlock ? { blockedReason: trimmedBlock } : {}),

  } satisfies Prisma.InputJsonValue;



  try {

    await prisma.$transaction(async (tx) => {

      if (enteringComplete) {

        const ev = await evaluateJobTaskCompletionRequirements({

          organizationId: ctx.organizationId,

          jobId: task.jobId,

          jobTaskId: task.id,

          completionRequirementsJson: task.completionRequirementsJson,

          db: tx,

        });



        if (!ev.satisfied) {

          if (ev.reason === "invalid_configuration") {

            throw new TaskCompletionGateError(ev.message);

          }

          if (ev.reason === "insufficient_evidence") {

            const canOv = canCompleteJobTaskWithEvidenceOverride(ctx.role);

            if (overrideRead.active) {

              if (!canOv) {

                throw new TaskCompletionGateError(

                  "You do not have permission to override evidence requirements.",

                );

              }

              if (overrideRead.reason.length < 1) {

                throw new TaskCompletionGateError(

                  "A reason is required to complete without accepted evidence.",

                );

              }

              if (overrideRead.reason.length > completeJobTaskEvidenceOverrideReasonMax) {

                throw new TaskCompletionGateError("Override reason is too long.");

              }

              eventType = JobActivityEventType.JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE;

            } else {

              throw new TaskCompletionGateError(ev.message);

            }

          }

        }

      }



      await tx.jobTask.update({

        where: { id: task.id },

        data: {

          status: to,

          blockedReason: blockedReasonNext,

          lastStatusChangedAt: now,

          lastStatusChangedByUserId: ctx.userId,

          completedAt,

          completedByUserId,

        },

      });



      const activityPayload: Prisma.InputJsonValue =

        enteringComplete && eventType === JobActivityEventType.JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE

          ? {

              ...payloadJson,

              evidenceRequirementOverride: true,

            }

          : payloadJson;



      await recordJobActivity(tx, {

        organizationId: ctx.organizationId,

        jobId: task.jobId,

        actorUserId: ctx.userId,

        eventType,

        summary:

          eventType === JobActivityEventType.JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE

            ? `${taskStatusSummary(task.title, from, to)} · Evidence requirement overridden by management`

            : taskStatusSummary(task.title, from, to),

        payloadJson: activityPayload,

      });



      if (enteringComplete && eventType === JobActivityEventType.JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE) {

        await tx.auditEvent.create({

          data: {

            organizationId: ctx.organizationId,

            actorUserId: ctx.userId,

            type: "JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE",

            payload: {

              jobId: task.jobId,

              jobTaskId: task.id,

              overrideReason: overrideRead.reason,

            },

          },

        });

      }

    });

  } catch (e) {

    if (isTaskCompletionGateError(e)) {

      return { ok: false, error: e.message };

    }

    throw e;

  }



  return { ok: true, jobId: task.jobId };

}

