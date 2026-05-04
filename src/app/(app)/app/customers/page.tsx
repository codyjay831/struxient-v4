import Link from "next/link";
import type { CustomerContactType } from "@prisma/client";
import { FileText } from "lucide-react";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listCustomersForOrg } from "@/server/phase1/queries";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canViewJobsWorkspace } from "@/lib/phase4-permissions";
import { Button } from "@/components/ui/button";
import { formatContactType, formatCustomerKind, formatCustomerStatus } from "@/lib/format-enums";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { workspaceListShellClass } from "@/components/workspace/workspace-surface-tokens";
import { MetadataPill } from "@/components/customers/customer-area";
import { cn } from "@/lib/utils";

function contactSummary(
  methods: { type: CustomerContactType; value: string; isPrimary: boolean; archivedAt: Date | null }[],
) {
  const active = methods.filter((m) => !m.archivedAt);
  if (active.length === 0) return null;
  const primary = active.find((m) => m.isPrimary) ?? active[0];
  const more = active.length > 1 ? ` · +${active.length - 1} more` : "";
  return `${formatContactType(primary.type)}: ${primary.value}${more}`;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function CustomersListPage() {
  const ctx = await requireOrgSession();
  const customers = await listCustomersForOrg(ctx.organizationId);
  const showQuoteCounts = canAuthorQuotes(ctx.role);
  const showJobCounts = canViewJobsWorkspace(ctx.role);

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          eyebrow="Customer record"
          title="Customers"
          description="Operational index for every party you serve — the anchor before opportunities, quotes, jobs, and field work. Records stay scoped to your organization."
          actions={
            <Button asChild className="rounded-[5px] font-semibold">
              <Link href="/app/customers/new">Create customer</Link>
            </Button>
          }
        />

        {customers.length === 0 ? (
          <WorkspaceEmptyState
            title="No customer records yet"
            description="A customer in Struxient is a durable record: it can exist before a lead, after a sale, or from import. Start here so every opportunity and quote stays tied to the right party."
          >
            <Button asChild className="rounded-[5px] font-semibold">
              <Link href="/app/customers/new">Create customer</Link>
            </Button>
          </WorkspaceEmptyState>
        ) : (
          <ul className={workspaceListShellClass()}>
            {customers.map((c) => {
              const contacts = contactSummary(c.contactMethods);
              const hasNotes = Boolean(c.notes?.trim());
              const { opportunities: oppN, quotes: quoteN, jobs: jobN } = c._count;
              return (
                <li key={c.id} className="min-w-0 transition-colors hover:bg-muted/25 dark:hover:bg-zinc-900/40">
                  <Link
                    href={`/app/customers/${c.id}`}
                    className="flex min-w-0 flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-primary hover:underline dark:text-blue-400">
                          {c.displayName}
                        </span>
                        <MetadataPill variant="outline">{formatCustomerKind(c.kind)}</MetadataPill>
                        <MetadataPill variant="muted">{formatCustomerStatus(c.status)}</MetadataPill>
                        {hasNotes ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-[4px] border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/50"
                            title="Has internal notes"
                          >
                            <FileText className="size-3" aria-hidden />
                            Notes
                          </span>
                        ) : null}
                      </div>
                      {contacts ? (
                        <p className="truncate text-xs text-muted-foreground dark:text-zinc-500">{contacts}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground dark:text-zinc-500">No active contacts on file</p>
                      )}
                      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[11px] tabular-nums text-muted-foreground dark:text-zinc-500">
                        <span>
                          <span className="font-medium text-foreground/90 dark:text-zinc-300">Opportunities</span> {oppN}
                        </span>
                        {showQuoteCounts ? (
                          <span>
                            <span className="text-border dark:text-zinc-700" aria-hidden>
                              ·
                            </span>
                            <span className="font-medium text-foreground/90 dark:text-zinc-300">Quotes</span> {quoteN}
                          </span>
                        ) : null}
                        {showJobCounts ? (
                          <span>
                            <span className="text-border dark:text-zinc-700" aria-hidden>
                              ·
                            </span>
                            <span className="font-medium text-foreground/90 dark:text-zinc-300">Jobs</span> {jobN}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex shrink-0 flex-col gap-1 text-right text-[11px] tabular-nums text-muted-foreground sm:text-xs",
                        "dark:text-zinc-500",
                      )}
                    >
                      <span>
                        Updated <span className="text-foreground/80 dark:text-zinc-400">{formatShortDate(c.updatedAt)}</span>
                      </span>
                      <span>
                        Created <span className="text-foreground/80 dark:text-zinc-400">{formatShortDate(c.createdAt)}</span>
                      </span>
                      <span className="font-medium text-foreground/90 dark:text-zinc-300">
                        {c.contactMethods.length} active contact{c.contactMethods.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppWorkspaceCanvas>
  );
}
