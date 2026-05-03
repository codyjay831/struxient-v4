import { MembershipRole } from "@prisma/client";

/** Roles that may create a customer portal link (aligned with quote authoring). */
const PORTAL_LINK_CREATE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
]);

/** Revoke/regenerate: office leadership band — not SALES (tighter control). Field roles excluded. */
const PORTAL_LINK_REVOKE_REGENERATE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
]);

export function canCreateCustomerPortalLink(role: MembershipRole): boolean {
  return PORTAL_LINK_CREATE_ROLES.has(role);
}

export function canRevokeOrRegenerateCustomerPortalLink(role: MembershipRole): boolean {
  return PORTAL_LINK_REVOKE_REGENERATE_ROLES.has(role);
}
