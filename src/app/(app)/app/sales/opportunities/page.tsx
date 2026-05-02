import Link from "next/link";
import { OpportunityStatus } from "@prisma/client";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listOpportunitiesForOrg } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import { formatOpportunityPriority, formatOpportunityStatus } from "@/lib/format-enums";

const STATUS_OPTIONS: (OpportunityStatus | "ALL")[] = [
  "ALL",
  OpportunityStatus.NEW,
  OpportunityStatus.QUALIFIED,
  OpportunityStatus.INFO_GATHERING,
  OpportunityStatus.SITE_VISIT_NEEDED,
  OpportunityStatus.QUOTE_DRAFT_READY,
  OpportunityStatus.QUOTE_DRAFT_CREATED,
  OpportunityStatus.LOST,
  OpportunityStatus.NO_QUOTE,
  OpportunityStatus.ARCHIVED,
];

export default async function OpportunitiesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireOrgSession();
  const sp = await searchParams;
  const raw = sp.status;
  const statusFilter =
    raw && STATUS_OPTIONS.includes(raw as OpportunityStatus | "ALL") ? (raw as OpportunityStatus | "ALL") : "ALL";

  const rows = await listOpportunitiesForOrg(
    ctx.organizationId,
    statusFilter === "ALL" ? undefined : (statusFilter as OpportunityStatus),
  );

  const base = "/app/sales/opportunities";

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link href="/app/customers" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Customers
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Opportunities</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Lead intake and pre-quote work. Execution tasks and sold jobs stay out of this lane until later phases.
          </p>
        </div>
        <Button asChild className="w-fit rounded-sm">
          <Link href="/app/sales/opportunities/new">Create opportunity</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
        {STATUS_OPTIONS.map((s) => {
          const href = s === "ALL" ? base : `${base}?status=${s}`;
          const active = statusFilter === s;
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card/30 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
              }`}
            >
              {s === "ALL" ? "All" : formatOpportunityStatus(s)}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-card/30 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No opportunities match this view</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Start from a customer record or create a new opportunity to capture service type, scope intent, and intake
            tasks.
          </p>
          <Button asChild className="mt-6 rounded-sm">
            <Link href="/app/sales/opportunities/new">Create opportunity</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground md:table-cell">Service</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Priority</th>
                <th className="hidden px-4 py-3 font-medium text-muted-foreground lg:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/20">
              {rows.map((o) => (
                <tr key={o.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/app/sales/opportunities/${o.id}`} className="font-medium text-primary hover:underline">
                      {o.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link href={`/app/customers/${o.customer.id}`} className="hover:text-foreground hover:underline">
                      {o.customer.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatOpportunityStatus(o.status)}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{o.serviceType}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                    {formatOpportunityPriority(o.priority)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{o.updatedAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
