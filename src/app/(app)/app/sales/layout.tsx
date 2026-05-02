import type { ReactNode } from "react";
import { canAccessPhase1CustomersAndSales } from "@/lib/phase1-permissions";
import { AccessDeniedPanel } from "@/components/phase1/access-denied-panel";
import { requireOrgSession } from "@/server/phase1/org-session";

export default async function SalesLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return (
      <AccessDeniedPanel
        title="Sales"
        description="Your role does not include sales and lead intake. If you need access, ask an organization administrator."
      />
    );
  }
  return <>{children}</>;
}
