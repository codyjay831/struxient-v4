import { CustomerWorkspaceShell } from "@/components/customers/customer-area";

export default function CustomersLoading() {
  return (
    <CustomerWorkspaceShell>
      <div className="animate-pulse space-y-6">
        <div className="space-y-3 border-b border-border/50 pb-6">
          <div className="h-8 w-48 max-w-full rounded-md bg-muted/50" />
          <div className="h-4 w-full max-w-2xl rounded-md bg-muted/40" />
          <div className="h-9 w-36 rounded-md bg-muted/50" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[5.5rem] rounded-md border border-border/40 bg-muted/20" />
          ))}
        </div>
      </div>
    </CustomerWorkspaceShell>
  );
}
