import type { ReactNode } from "react";
import { canAccessPhase1CustomersAndSales } from "@/lib/phase1-permissions";
import { AccessDeniedPanel } from "@/components/phase1/access-denied-panel";
import { requireOrgSession } from "@/server/phase1/org-session";

export default async function CustomersLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return (
      <AccessDeniedPanel
        title="Customers"
        description="Your role does not include customer records. If you need access, ask an organization administrator."
      />
    );
  }
  return <>{children}</>;
}
