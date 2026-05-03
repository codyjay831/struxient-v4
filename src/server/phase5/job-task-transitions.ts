import { JobTaskStatus, MembershipRole } from "@prisma/client";

const REOPEN_COMPLETE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

/** Allowed targets from each source status (excluding COMPLETE → IN_PROGRESS role special-case). */
const TRANSITION_MATRIX: Record<JobTaskStatus, readonly JobTaskStatus[]> = {
  [JobTaskStatus.NOT_STARTED]: [JobTaskStatus.READY, JobTaskStatus.IN_PROGRESS, JobTaskStatus.BLOCKED],
  [JobTaskStatus.READY]: [JobTaskStatus.NOT_STARTED, JobTaskStatus.IN_PROGRESS, JobTaskStatus.BLOCKED],
  [JobTaskStatus.IN_PROGRESS]: [JobTaskStatus.READY, JobTaskStatus.BLOCKED, JobTaskStatus.COMPLETE],
  [JobTaskStatus.BLOCKED]: [JobTaskStatus.NOT_STARTED, JobTaskStatus.READY, JobTaskStatus.IN_PROGRESS],
  [JobTaskStatus.COMPLETE]: [JobTaskStatus.IN_PROGRESS],
};

export function isAllowedJobTaskStatusTransition(
  from: JobTaskStatus,
  to: JobTaskStatus,
  role: MembershipRole,
): boolean {
  if (from === to) {
    return true;
  }
  if (from === JobTaskStatus.COMPLETE && to === JobTaskStatus.IN_PROGRESS) {
    return REOPEN_COMPLETE_ROLES.has(role);
  }
  const allowed = TRANSITION_MATRIX[from];
  return allowed.includes(to);
}
