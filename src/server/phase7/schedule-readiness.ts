import { JobStatus, JobTaskStatus, ScheduledWorkStatus } from "@prisma/client";
import type { ScheduleReadiness, ScheduleReadinessLabel } from "@/server/phase7/scheduled-work-types";

export type AddressContext = {
  quoteServiceAddressText: string | null;
  quoteServiceAddressTbd: boolean;
  opportunityServiceAddressText: string | null;
  opportunityServiceAddressTbd: boolean;
};

/** True when neither quote nor opportunity provides a confirmed service address. */
export function isServiceAddressAtRisk(ctx: AddressContext): boolean {
  const quoteOk =
    !ctx.quoteServiceAddressTbd && (ctx.quoteServiceAddressText?.trim().length ?? 0) > 0;
  if (quoteOk) {
    return false;
  }
  const oppOk =
    !ctx.opportunityServiceAddressTbd && (ctx.opportunityServiceAddressText?.trim().length ?? 0) > 0;
  return !oppOk;
}

const SCHEDULABLE_TASK_STATUSES: ReadonlySet<JobTaskStatus> = new Set([
  JobTaskStatus.NOT_STARTED,
  JobTaskStatus.READY,
  JobTaskStatus.IN_PROGRESS,
  JobTaskStatus.BLOCKED,
]);

export function isJobSchedulable(jobStatus: JobStatus): boolean {
  return jobStatus === JobStatus.ACTIVE || jobStatus === JobStatus.PAUSED;
}

export function isTaskSchedulable(taskStatus: JobTaskStatus): boolean {
  return SCHEDULABLE_TASK_STATUSES.has(taskStatus);
}

function labelCopy(label: ScheduleReadinessLabel, detail?: string): string {
  switch (label) {
    case "SCHEDULED_READY":
      return "Scheduled and currently ready based on job and task status.";
    case "SCHEDULED_BLOCKED": {
      const base = "Scheduled, but this task is blocked.";
      return detail ? `${base} ${detail}` : base;
    }
    case "SCHEDULED_AT_RISK":
      return detail ?? "Scheduled with a risk factor based on current job or task facts.";
    case "READY_TO_SCHEDULE":
      return "Ready to place on the schedule.";
    case "NOT_SCHEDULABLE":
      return detail ?? "This task cannot be scheduled in its current state.";
    case "CANCELED":
      return "Scheduled work was canceled.";
    case "COMPLETED":
      return "Scheduled work is marked complete.";
    default:
      return detail ?? "";
  }
}

export type ScheduledReadinessFacts = {
  scheduledWorkStatus: ScheduledWorkStatus;
  jobStatus: JobStatus;
  jobStatusReason: string | null;
  taskStatus: JobTaskStatus;
  taskBlockedReason: string | null;
  estimatedDurationMinutes: number | null;
  addressContext: AddressContext;
};

/**
 * Derives readiness for an existing ScheduledWork row plus current Job/JobTask facts.
 * Does not persist; does not invent domains beyond provided facts.
 */
export function deriveReadinessForScheduledWork(facts: ScheduledReadinessFacts): ScheduleReadiness {
  const { scheduledWorkStatus: sw, jobStatus, jobStatusReason, taskStatus, taskBlockedReason } = facts;

  if (sw === ScheduledWorkStatus.CANCELED) {
    return { label: "CANCELED", explanation: labelCopy("CANCELED") };
  }
  if (sw === ScheduledWorkStatus.COMPLETED) {
    return { label: "COMPLETED", explanation: labelCopy("COMPLETED") };
  }

  if (taskStatus === JobTaskStatus.COMPLETE) {
    return {
      label: "SCHEDULED_AT_RISK",
      explanation:
        "The task is marked complete while scheduled time remains on record. Cancel or adjust if this window is no longer valid.",
    };
  }

  if (jobStatus === JobStatus.COMPLETED || jobStatus === JobStatus.CANCELED) {
    return {
      label: "SCHEDULED_AT_RISK",
      explanation:
        "The job is no longer active. This scheduled window may be outdated — review or cancel when appropriate.",
    };
  }

  if (taskStatus === JobTaskStatus.BLOCKED) {
    const reason = taskBlockedReason?.trim();
    return {
      label: "SCHEDULED_BLOCKED",
      explanation: reason
        ? `Scheduled, but blocked: ${reason}`
        : "Scheduled, but this task is blocked (no block reason text was recorded).",
    };
  }

  if (jobStatus === JobStatus.PAUSED) {
    const note = jobStatusReason?.trim();
    return {
      label: "SCHEDULED_AT_RISK",
      explanation: note
        ? `Scheduled while the job is paused. Pause note: ${note}`
        : "Scheduled while the job is paused. Execution timing may change when the job resumes.",
    };
  }

  if (facts.estimatedDurationMinutes == null) {
    return {
      label: "SCHEDULED_AT_RISK",
      explanation: "Scheduled with a risk: estimated duration is missing for this task.",
    };
  }

  if (isServiceAddressAtRisk(facts.addressContext)) {
    return {
      label: "SCHEDULED_AT_RISK",
      explanation: "Scheduled with a risk: service address is not confirmed on the quote or opportunity.",
    };
  }

  return { label: "SCHEDULED_READY", explanation: labelCopy("SCHEDULED_READY") };
}

export type UnscheduledTaskReadinessFacts = {
  jobStatus: JobStatus;
  taskStatus: JobTaskStatus;
};

/** Readiness label for a job task that does not have an active scheduled row (UI hint). */
export function deriveReadinessForUnscheduledTask(facts: UnscheduledTaskReadinessFacts): ScheduleReadiness {
  if (facts.jobStatus === JobStatus.COMPLETED || facts.jobStatus === JobStatus.CANCELED) {
    return {
      label: "NOT_SCHEDULABLE",
      explanation: labelCopy("NOT_SCHEDULABLE", "The job is closed; new schedule entries are not allowed."),
    };
  }
  if (facts.taskStatus === JobTaskStatus.COMPLETE) {
    return {
      label: "NOT_SCHEDULABLE",
      explanation: labelCopy("NOT_SCHEDULABLE", "Completed tasks cannot be scheduled."),
    };
  }
  if (!isTaskSchedulable(facts.taskStatus)) {
    return {
      label: "NOT_SCHEDULABLE",
      explanation: labelCopy("NOT_SCHEDULABLE", "This task status cannot be placed on the schedule."),
    };
  }
  return { label: "READY_TO_SCHEDULE", explanation: labelCopy("READY_TO_SCHEDULE") };
}
