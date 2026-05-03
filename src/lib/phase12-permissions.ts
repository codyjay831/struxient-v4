import { MembershipRole } from "@prisma/client";

const VIEW_JOB_EVIDENCE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
]);

const MANAGE_JOB_EVIDENCE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

/** Work Station candidate cards: operations and management only (not sales, not field). */
const WORK_STATION_JOB_EVIDENCE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

export function canViewJobEvidence(role: MembershipRole): boolean {
  return VIEW_JOB_EVIDENCE_ROLES.has(role);
}

export function canManageJobEvidence(role: MembershipRole): boolean {
  return MANAGE_JOB_EVIDENCE_ROLES.has(role);
}

export function canSeeJobEvidenceWorkStationCards(role: MembershipRole): boolean {
  return WORK_STATION_JOB_EVIDENCE_ROLES.has(role);
}
