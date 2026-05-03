import { MembershipRole } from "@prisma/client";

const MARK_ACCEPTED_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
]);

const ACTIVATE_JOB_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

const VIEW_JOBS_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
  MembershipRole.CREW_LEAD,
  MembershipRole.FIELD_WORKER,
]);

const JOB_TASK_STATUS_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.CREW_LEAD,
  MembershipRole.FIELD_WORKER,
]);

/** OWNER, ADMIN, MANAGER, OFFICE, SALES */
export function canMarkQuoteAccepted(role: MembershipRole): boolean {
  return MARK_ACCEPTED_ROLES.has(role);
}

/** OWNER, ADMIN, MANAGER, OFFICE — not sales-only. */
export function canActivateAcceptedQuoteAsJob(role: MembershipRole): boolean {
  return ACTIVATE_JOB_ROLES.has(role);
}

/** MEMBER denied by default. */
export function canViewJobsWorkspace(role: MembershipRole): boolean {
  return VIEW_JOBS_ROLES.has(role);
}

/** Not SALES, not MEMBER. */
export function canUpdateJobTaskStatus(role: MembershipRole): boolean {
  return JOB_TASK_STATUS_ROLES.has(role);
}
