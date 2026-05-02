import { MembershipRole } from "@prisma/client";

const PHASE1_CUSTOMERS_AND_SALES = new Set<MembershipRole>([
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.OFFICE,
  MembershipRole.SALES,
  MembershipRole.MEMBER,
]);

/**
 * Internal staff who may work lead intake, customers, and opportunities.
 * Field and crew roles use Work Station / Jobs later; they do not get Sales/Customers here.
 */
export function canAccessPhase1CustomersAndSales(role: MembershipRole): boolean {
  return PHASE1_CUSTOMERS_AND_SALES.has(role);
}
