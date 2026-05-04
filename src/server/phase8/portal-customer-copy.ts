import { JobStatus, JobTaskStatus, QuoteStatus, ScheduledWorkStatus } from "@prisma/client";

/**
 * Decision 1 (customer portal): preparing copy for pre-execution jobs; unknown job statuses must
 * not default to "In progress." Prisma `JobStatus.PENDING_ACTIVATION` will match this string once
 * the lifecycle schema lands. Runtime `String(jobStatus)` stays correct without a fake enum import.
 *
 * After the enum exists: use `JobStatus.WORK_PLAN_REVIEW` in tests (drop `as JobStatus` casts).
 * Optional later: soften empty-milestone copy in `portal-customer-view.tsx` if it still reads too
 * "field/execution" before activation.
 */
export const PORTAL_JOB_PENDING_ACTIVATION_STATUS_VALUE = JobStatus.WORK_PLAN_REVIEW;

export function isJobPendingActivationPortal(jobStatus: JobStatus): boolean {
  return jobStatus === JobStatus.WORK_PLAN_REVIEW;
}

/** True when field/office execution is underway (not pre-activation planning). */
export function isJobExecutionLiveForCustomerPortal(jobStatus: JobStatus | null): boolean {
  if (!jobStatus) return false;
  return jobStatus === JobStatus.ACTIVE || jobStatus === JobStatus.PAUSED;
}

export function mapJobStatusForCustomer(status: JobStatus): string {
  if (isJobPendingActivationPortal(status)) {
    return "We're preparing your project.";
  }
  switch (status) {
    case JobStatus.ACTIVE:
      return "In progress";
    case JobStatus.PAUSED:
      return "Temporarily paused";
    case JobStatus.COMPLETED:
      return "Completed";
    case JobStatus.CANCELED:
      return "Canceled";
    default:
      // Unknown future statuses: avoid implying execution has started.
      return "We're preparing your project.";
  }
}

export function mapJobTaskStatusForCustomer(status: JobTaskStatus): string {
  switch (status) {
    case JobTaskStatus.NOT_STARTED:
      return "Not started";
    case JobTaskStatus.READY:
      return "Ready";
    case JobTaskStatus.IN_PROGRESS:
      return "In progress";
    case JobTaskStatus.BLOCKED:
      return "Waiting";
    case JobTaskStatus.COMPLETE:
      return "Complete";
    default:
      return "Not started";
  }
}

export function mapScheduledWorkStatusForCustomer(status: ScheduledWorkStatus): string {
  switch (status) {
    case ScheduledWorkStatus.SCHEDULED:
      return "Scheduled";
    case ScheduledWorkStatus.COMPLETED:
      return "Completed";
    case ScheduledWorkStatus.CANCELED:
      return "Canceled";
    default:
      return "Scheduled";
  }
}

export function customerPortalQuoteStatusLabel(
  quoteStatus: QuoteStatus,
  options: { hasLinkedJob: boolean; jobStatus: JobStatus | null },
): string {
  const { hasLinkedJob, jobStatus } = options;

  switch (quoteStatus) {
    case QuoteStatus.SENT:
      return "Proposal sent";
    case QuoteStatus.ACTIVATED:
      return "Work underway";
    case QuoteStatus.ACCEPTED:
      if (!hasLinkedJob || jobStatus === null) {
        return "Proposal accepted";
      }
      if (jobStatus === JobStatus.COMPLETED) {
        return "Project complete";
      }
      if (jobStatus === JobStatus.CANCELED) {
        return "Project ended";
      }
      if (isJobExecutionLiveForCustomerPortal(jobStatus)) {
        return "Project active";
      }
      return "We're preparing your project.";
    default:
      return "Proposal";
  }
}

export function buildPortalWhatHappensNext(params: {
  quoteStatus: QuoteStatus;
  jobStatus: JobStatus | null;
  scheduleCount: number;
}): string {
  const { quoteStatus, jobStatus, scheduleCount } = params;

  if (jobStatus === JobStatus.COMPLETED) {
    return "Your project is complete. Thank you for working with us.";
  }
  if (jobStatus === JobStatus.CANCELED) {
    return "This project is no longer active. Please contact the office if you have questions.";
  }
  if (jobStatus === JobStatus.PAUSED) {
    return "Work on this project is temporarily paused. The office will reach out when activity resumes.";
  }

  if (jobStatus === JobStatus.ACTIVE) {
    if (scheduleCount > 0) {
      return "Your upcoming appointment is listed below. Times are subject to office confirmation.";
    }
    return "We will update this page when the office posts your visit times.";
  }

  if (jobStatus !== null && !isJobExecutionLiveForCustomerPortal(jobStatus)) {
    if (scheduleCount > 0) {
      return "Your upcoming appointment is listed below. Times are subject to office confirmation.";
    }
    return "We're preparing your project. We'll update this page when there is news.";
  }

  if (quoteStatus === QuoteStatus.SENT) {
    return "Review is in progress. Contact the office with any questions about your proposal.";
  }
  if (quoteStatus === QuoteStatus.ACCEPTED) {
    return "Your proposal is accepted. We'll update this page when there is news about your project.";
  }
  if (quoteStatus === QuoteStatus.ACTIVATED) {
    return "We will update this page as work progresses.";
  }

  return "We will update this page as work progresses.";
}
