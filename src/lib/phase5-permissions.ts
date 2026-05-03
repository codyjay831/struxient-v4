import { JobStatus, MembershipRole } from "@prisma/client";
import { canUpdateJobTaskStatus, canViewJobsWorkspace } from "@/lib/phase4-permissions";

export { canViewJobsWorkspace, canUpdateJobTaskStatus };

const CHANGE_JOB_STATUS_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

/** Pause / resume / complete / cancel — not SALES, not field, not MEMBER. */
export function canChangeJobStatus(role: MembershipRole): boolean {
  return CHANGE_JOB_STATUS_ROLES.has(role);
}

/** While job is PAUSED, only office band may change task status. */
export function canUpdateJobTaskWhenJobPaused(role: MembershipRole): boolean {
  return CHANGE_JOB_STATUS_ROLES.has(role);
}

/**
 * Task status UI + mutations: base task role, then job lifecycle gates.
 * COMPLETED/CANCELED: no one. PAUSED: office band only. ACTIVE: base roles.
 */
export function canUpdateJobTasksForCurrentJobState(role: MembershipRole, jobStatus: JobStatus): boolean {
  if (!canUpdateJobTaskStatus(role)) {
    return false;
  }
  if (jobStatus === JobStatus.COMPLETED || jobStatus === JobStatus.CANCELED) {
    return false;
  }
  if (jobStatus === JobStatus.PAUSED) {
    return canUpdateJobTaskWhenJobPaused(role);
  }
  return true;
}
