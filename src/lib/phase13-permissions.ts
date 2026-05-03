import { MembershipRole } from "@prisma/client";

const MANAGE_COMPLETION_REQUIREMENTS_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

const EVIDENCE_OVERRIDE_COMPLETION_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

const WORK_STATION_EVIDENCE_REQUIREMENT_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

export function canManageJobTaskCompletionRequirements(role: MembershipRole): boolean {
  return MANAGE_COMPLETION_REQUIREMENTS_ROLES.has(role);
}

export function canCompleteJobTaskWithEvidenceOverride(role: MembershipRole): boolean {
  return EVIDENCE_OVERRIDE_COMPLETION_ROLES.has(role);
}

export function canSeeEvidenceRequirementWorkStationCards(role: MembershipRole): boolean {
  return WORK_STATION_EVIDENCE_REQUIREMENT_ROLES.has(role);
}
