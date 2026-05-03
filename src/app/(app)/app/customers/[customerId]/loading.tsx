import { CustomerBackLink, CustomerWorkspaceShell } from "@/components/customers/customer-area";

export default function CustomerDetailLoading() {
  return (
    <CustomerWorkspaceShell>
      <nav className="mb-4">
        <CustomerBackLink />
      </nav>
      <div className="animate-pulse space-y-6 border-b border-border/50 pb-6">
        <div className="h-9 w-64 max-w-full rounded-md bg-muted/50" />
        <div className="h-4 w-full max-w-2xl rounded-md bg-muted/35" />
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-md bg-muted/40" />
          <div className="h-6 w-16 rounded-md bg-muted/40" />
        </div>
      </div>
      <div className="mt-6 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-md border border-border/50 bg-muted/15" />
        ))}
      </div>
    </CustomerWorkspaceShell>
  );
}
