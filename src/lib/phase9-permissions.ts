import { MembershipRole } from "@prisma/client";

const VIEW_PORTAL_SUBMISSION_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
]);

const MANAGE_PORTAL_SUBMISSION_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

export function canViewCustomerPortalSubmissions(role: MembershipRole): boolean {
  return VIEW_PORTAL_SUBMISSION_ROLES.has(role);
}

export function canManageCustomerPortalSubmissions(role: MembershipRole): boolean {
  return MANAGE_PORTAL_SUBMISSION_ROLES.has(role);
}
