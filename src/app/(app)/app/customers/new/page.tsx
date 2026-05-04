import { MetadataPill } from "@/components/customers/customer-area";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { ProgressiveCreateShell } from "@/components/workspace/progressive-create-shell";
import { CustomerCreateForm } from "./customer-create-form";

export default function NewCustomerPage() {
  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          back={{ href: "/app/customers", label: "Customers" }}
          eyebrow="Customer record"
          title="New customer"
          description="Creates a durable operational record — the anchor for opportunities, quotes, jobs, contacts, notes, and activity. Nothing is lost if you start lean; add depth as work progresses."
          badges={<MetadataPill variant="outline">Operational record</MetadataPill>}
        />
        <ProgressiveCreateShell
          intentTitle="Start a customer record"
          intentDescription="You only need a display name to begin. Add relationship notes and contact methods after the record exists — everything stays scoped to your organization."
          continueLabel="Enter customer details"
        >
          <CustomerCreateForm />
        </ProgressiveCreateShell>
      </div>
    </AppWorkspaceCanvas>
  );
}
