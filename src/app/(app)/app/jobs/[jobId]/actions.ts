"use server";

import { revalidatePath } from "next/cache";
import { requireOrgSession } from "@/server/phase1/org-session";
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import {
  jobMutationCancel,
  jobMutationComplete,
  jobMutationPause,
  jobMutationResume,
} from "@/server/phase5/job-status-mutations";
import { jobMutationActivateExecution } from "@/server/phase4/job-activation";
import {
  jobMutationCancelScheduledWork,
  jobMutationRescheduleScheduledWork,
  jobMutationScheduleJobTask,
} from "@/server/phase7/scheduled-work-mutations";
import { jobMutationUpdateJobTaskCompletionRequirements } from "@/server/phase13/completion-requirement-mutations";
import {
  jobMutationAddWorkPlanTask,
  jobMutationArchiveWorkPlanTask,
  jobMutationReorderWorkPlanTasks,
  jobMutationUpdateWorkPlanStage,
  jobMutationUpdateWorkPlanTask,
} from "@/server/phase4/job-work-plan-mutations";
import type {
  CompletionRequirementMutationResult,
  JobLifecycleActionResult,
  JobTaskActionResult,
  ScheduledWorkActionResult,
  WorkPlanMutationResult,
} from "./action-types";

export async function updateJobTaskStatus(
  _prev: JobTaskActionResult | undefined,
  formData: FormData,
): Promise<JobTaskActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationUpdateTaskStatus(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
    revalidatePath("/app/work-station");
  }
  return r;
}

export async function updateJobTaskCompletionRequirementsAction(
  _prev: CompletionRequirementMutationResult | undefined,
  formData: FormData,
): Promise<CompletionRequirementMutationResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationUpdateJobTaskCompletionRequirements(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
    revalidatePath("/app/work-station");
  }
  return r;
}

export async function pauseJob(
  _prev: JobLifecycleActionResult | undefined,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationPause(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function resumeJob(
  _prev: JobLifecycleActionResult | undefined,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationResume(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function completeJob(
  _prev: JobLifecycleActionResult | undefined,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationComplete(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function cancelJob(
  _prev: JobLifecycleActionResult | undefined,
  formData: FormData,
): Promise<JobLifecycleActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationCancel(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function activateJobExecution(
  _prev: JobLifecycleActionResult | undefined,
  formData: FormData
): Promise<JobLifecycleActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationActivateExecution(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/jobs");
    revalidatePath("/app/work-station");
    // Also revalidate quote if possible, but we don't have quoteId here easily without loading.
    // The job workspace include already has quote.id, so the page will be fresh.
  }
  return r;
}

export async function scheduleJobTaskAction(
  _prev: ScheduledWorkActionResult | undefined,
  formData: FormData,
): Promise<ScheduledWorkActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationScheduleJobTask(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/schedule");
  }
  return r;
}

export async function rescheduleScheduledWorkAction(
  _prev: ScheduledWorkActionResult | undefined,
  formData: FormData,
): Promise<ScheduledWorkActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationRescheduleScheduledWork(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/schedule");
  }
  return r;
}

export async function cancelScheduledWorkAction(
  _prev: ScheduledWorkActionResult | undefined,
  formData: FormData,
): Promise<ScheduledWorkActionResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationCancelScheduledWork(ctx, formData);
  if (r.ok) {
    revalidatePath(`/app/jobs/${r.jobId}`);
    revalidatePath("/app/schedule");
  }
  return r;
}

function revalidateJobWorkPlan(jobId: string) {
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app/jobs");
  revalidatePath("/app/work-station");
}

export async function updateWorkPlanTaskAction(
  _prev: WorkPlanMutationResult | undefined,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationUpdateWorkPlanTask(ctx, formData);
  if (r.ok) {
    revalidateJobWorkPlan(r.jobId);
  }
  return r;
}

export async function addWorkPlanTaskAction(
  _prev: WorkPlanMutationResult | undefined,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationAddWorkPlanTask(ctx, formData);
  if (r.ok) {
    revalidateJobWorkPlan(r.jobId);
  }
  return r;
}

export async function archiveWorkPlanTaskAction(
  _prev: WorkPlanMutationResult | undefined,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationArchiveWorkPlanTask(ctx, formData);
  if (r.ok) {
    revalidateJobWorkPlan(r.jobId);
  }
  return r;
}

export async function reorderWorkPlanTasksAction(
  _prev: WorkPlanMutationResult | undefined,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationReorderWorkPlanTasks(ctx, formData);
  if (r.ok) {
    revalidateJobWorkPlan(r.jobId);
  }
  return r;
}

export async function updateWorkPlanStageAction(
  _prev: WorkPlanMutationResult | undefined,
  formData: FormData,
): Promise<WorkPlanMutationResult> {
  const ctx = await requireOrgSession();
  const r = await jobMutationUpdateWorkPlanStage(ctx, formData);
  if (r.ok) {
    revalidateJobWorkPlan(r.jobId);
  }
  return r;
}
