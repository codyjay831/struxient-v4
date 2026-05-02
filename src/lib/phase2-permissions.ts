import { MembershipRole } from "@prisma/client";

/** Quote authoring: sales/office leadership only — not field/crew, not generic MEMBER. */
const QUOTE_AUTHOR_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
]);

export function canAuthorQuotes(role: MembershipRole): boolean {
  return QUOTE_AUTHOR_ROLES.has(role);
}
