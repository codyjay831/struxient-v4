import { MembershipRole } from "@prisma/client";
import { canAuthorQuotes } from "@/lib/phase2-permissions";

const TEMPLATE_MANAGE_ROLES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
]);

/** Same policy as quote authoring: sales/office leadership — not field/crew or generic MEMBER. */
export function canViewTemplateLibrary(role: MembershipRole): boolean {
  return canAuthorQuotes(role);
}

/** Archive, restore, and metadata edits on org work templates. */
export function canManageQuoteWorkTemplates(role: MembershipRole): boolean {
  return TEMPLATE_MANAGE_ROLES.has(role);
}
