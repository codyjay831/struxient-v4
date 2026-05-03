import { CustomerBackLink, CustomerWorkspaceShell, MetadataPill } from "@/components/customers/customer-area";

export default function NewCustomerLoading() {
  return (
    <CustomerWorkspaceShell>
      <nav className="mb-4">
        <CustomerBackLink />
      </nav>
      <header className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">New customer</h1>
            <MetadataPill variant="outline">Customer record</MetadataPill>
          </div>
          <div className="h-4 max-w-2xl animate-pulse rounded bg-muted/50" />
          <div className="h-4 max-w-xl animate-pulse rounded bg-muted/40" />
        </div>
      </header>
      <div className="grid animate-pulse gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="h-48 rounded-md border border-border/50 bg-muted/20" />
          <div className="h-40 rounded-md border border-border/50 bg-muted/20" />
          <div className="h-10 w-40 rounded-md bg-muted/40" />
        </div>
        <div className="space-y-4">
          <div className="h-32 rounded-md border border-border/50 bg-muted/20" />
          <div className="h-28 rounded-md border border-border/50 bg-muted/20" />
        </div>
      </div>
    </CustomerWorkspaceShell>
  );
}
