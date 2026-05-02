import Link from "next/link";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listCustomersForOrg, listOrganizationMembers } from "@/server/phase1/queries";
import { OpportunityCreateForm } from "./opportunity-create-form";

export default async function NewOpportunityPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const ctx = await requireOrgSession();
  const sp = await searchParams;
  const customers = await listCustomersForOrg(ctx.organizationId);
  const membersRaw = await listOrganizationMembers(ctx.organizationId);
  const members = membersRaw.map((m) => ({
    id: m.user.id,
    label: m.user.name?.trim() ? `${m.user.name} (${m.user.email})` : m.user.email,
  }));

  const defaultCustomerId =
    sp.customerId && customers.some((c) => c.id === sp.customerId) ? sp.customerId : customers[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="space-y-1">
        <Link href="/app/sales/opportunities" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Opportunities
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">New opportunity</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Capture who wants what, where work would occur, and how you heard about them. This becomes the intake workspace
          for quote preparation in a later release.
        </p>
      </div>
      <OpportunityCreateForm customers={customers} members={members} defaultCustomerId={defaultCustomerId} />
    </div>
  );
}
