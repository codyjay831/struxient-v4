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
import {
  jobMutationCancelScheduledWork,
  jobMutationRescheduleScheduledWork,
  jobMutationScheduleJobTask,
} from "@/server/phase7/scheduled-work-mutations";
import { jobMutationUpdateJobTaskCompletionRequirements } from "@/server/phase13/completion-requirement-mutations";
import type {
  CompletionRequirementMutationResult,
  JobLifecycleActionResult,
  JobTaskActionResult,
  ScheduledWorkActionResult,
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
