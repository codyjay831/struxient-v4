import { CustomerBackLink, CustomerPageHeader, CustomerWorkspaceShell, MetadataPill } from "@/components/customers/customer-area";
import { CustomerCreateForm } from "./customer-create-form";

export default function NewCustomerPage() {
  return (
    <CustomerWorkspaceShell>
      <nav className="mb-4" aria-label="Breadcrumb">
        <CustomerBackLink />
      </nav>
      <CustomerPageHeader
        title="New customer"
        subtitle="Create a durable operational record — the system-wide anchor for who you are working with, before or after any single sale or job."
        badge={<MetadataPill variant="outline">Customer record</MetadataPill>}
      />
      <CustomerCreateForm />
    </CustomerWorkspaceShell>
  );
}
