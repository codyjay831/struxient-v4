import { requireOrgSession } from "@/server/phase1/org-session";
import { listCustomersForOrg, listOrganizationMembers } from "@/server/phase1/queries";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
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
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
        <WorkspaceCommandHeader
          back={{ href: "/app/sales/opportunities", label: "Opportunities" }}
          eyebrow="Sales workspace"
          title="New opportunity"
          description="Capture who wants what, where work would occur, and how you heard about them. This becomes the intake workspace for quote preparation in a later release."
        />
        <OpportunityCreateForm customers={customers} members={members} defaultCustomerId={defaultCustomerId} />
      </div>
    </AppWorkspaceCanvas>
  );
}
