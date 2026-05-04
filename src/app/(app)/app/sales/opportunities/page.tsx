import Link from "next/link";
import { OpportunityStatus } from "@prisma/client";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listOpportunitiesForOrg } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import { formatOpportunityPriority, formatOpportunityStatus } from "@/lib/format-enums";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";

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
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6">
        <WorkspaceCommandHeader
          eyebrow="Sales workspace"
          title="Opportunities"
          description="Lead intake and pre-quote work. Execution tasks and sold jobs stay out of this lane until later phases."
          actions={
            <Button asChild className="rounded-[5px] font-semibold">
              <Link href="/app/sales/opportunities/new">Create opportunity</Link>
            </Button>
          }
          meta={
            <Link href="/app/customers" className="font-medium text-primary hover:underline dark:text-blue-400">
              Customers
            </Link>
          }
        />

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">
            Status
          </span>
          {STATUS_OPTIONS.map((s) => {
            const href = s === "ALL" ? base : `${base}?status=${s}`;
            const active = statusFilter === s;
            return (
              <Link
                key={s}
                href={href}
                className={`rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                    : "border-border bg-card/40 text-muted-foreground hover:border-border hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300"
                }`}
              >
                {s === "ALL" ? "All" : formatOpportunityStatus(s)}
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <WorkspaceEmptyState
            title="No opportunities match this view"
            description="Start from a customer record or create a new opportunity to capture service type, scope intent, and intake tasks."
          >
            <Button asChild className="rounded-[5px] font-semibold">
              <Link href="/app/sales/opportunities/new">Create opportunity</Link>
            </Button>
          </WorkspaceEmptyState>
        ) : (
          <ul className="min-w-0 divide-y divide-border rounded-[6px] border border-border dark:divide-zinc-800/60 dark:border-zinc-800/60">
            {rows.map((o) => (
              <li key={o.id} className="min-w-0 p-3.5 transition-colors hover:bg-muted/30 dark:hover:bg-zinc-900/40 sm:p-4">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Link
                      href={`/app/sales/opportunities/${o.id}`}
                      className="block truncate text-sm font-semibold text-primary hover:underline dark:text-blue-400"
                    >
                      {o.title}
                    </Link>
                    <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      <Link href={`/app/customers/${o.customer.id}`} className="font-medium text-foreground/90 hover:underline dark:text-zinc-300">
                        {o.customer.displayName}
                      </Link>
                      <span className="mx-1.5 text-border dark:text-zinc-700" aria-hidden>
                        ·
                      </span>
                      <span>{o.serviceType}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                      <span className="rounded-[4px] border border-border bg-muted/40 px-1.5 py-0.5 dark:border-zinc-800 dark:bg-zinc-950">
                        {formatOpportunityStatus(o.status)}
                      </span>
                      <span className="rounded-[4px] border border-border px-1.5 py-0.5 dark:border-zinc-800">
                        {formatOpportunityPriority(o.priority)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 text-left text-[11px] tabular-nums text-muted-foreground lg:text-right dark:text-zinc-500">
                    <span>Updated {o.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                    <Link
                      href={`/app/sales/opportunities/${o.id}`}
                      className="font-semibold text-primary hover:underline dark:text-blue-400 lg:ml-auto"
                    >
                      Open workspace →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppWorkspaceCanvas>
  );
}
