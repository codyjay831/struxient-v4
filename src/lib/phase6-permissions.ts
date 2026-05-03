import { MembershipRole } from "@prisma/client";

/**
 * Work Station is an internal operational feed. Generic MEMBER has no access.
 * Field roles see job-scoped cards only (enforced in feed builder).
 */
export function canViewWorkStation(role: MembershipRole): boolean {
  return role !== MembershipRole.MEMBER;
}
