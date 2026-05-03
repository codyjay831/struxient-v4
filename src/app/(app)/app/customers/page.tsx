import Link from "next/link";
import type { CustomerContactType } from "@prisma/client";
import { FileText } from "lucide-react";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listCustomersForOrg } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import { formatContactType, formatCustomerKind, formatCustomerStatus } from "@/lib/format-enums";
import {
  CustomerEmptyState,
  CustomerPageHeader,
  CustomerWorkspaceShell,
  MetadataPill,
} from "@/components/customers/customer-area";

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

  return (
    <CustomerWorkspaceShell>
      <CustomerPageHeader
        title="Customers"
        subtitle="Operational CRM records for every person and organization you serve — linked to opportunities, quotes, jobs, and portal activity."
        actions={
          <Button asChild className="rounded-md font-semibold">
            <Link href="/app/customers/new">Create customer</Link>
          </Button>
        }
      />

      {customers.length === 0 ? (
        <CustomerEmptyState
          title="No customer records yet"
          description="A customer in Struxient is a durable record: it can exist before a lead, after a sale, or from import. Start here so every opportunity and quote stays tied to the right party."
        >
          <Button asChild className="rounded-md font-semibold">
            <Link href="/app/customers/new">Create customer</Link>
          </Button>
        </CustomerEmptyState>
      ) : (
        <ul className="grid gap-3">
          {customers.map((c) => {
            const contacts = contactSummary(c.contactMethods);
            const hasNotes = Boolean(c.notes?.trim());
            return (
              <li key={c.id}>
                <Link
                  href={`/app/customers/${c.id}`}
                  className="group block rounded-md border border-border/80 bg-card/30 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-card/50 dark:bg-card/20 dark:hover:bg-card/35"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                          {c.displayName}
                        </span>
                        <MetadataPill variant="outline">{formatCustomerKind(c.kind)}</MetadataPill>
                        <MetadataPill variant="muted">{formatCustomerStatus(c.status)}</MetadataPill>
                        {hasNotes ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                            title="Has internal notes"
                          >
                            <FileText className="size-3" aria-hidden />
                            Notes
                          </span>
                        ) : null}
                      </div>
                      {contacts ? (
                        <p className="truncate text-xs text-muted-foreground">{contacts}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No active contacts on file</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 text-right text-[11px] tabular-nums text-muted-foreground sm:text-xs">
                      <span>Updated {formatShortDate(c.updatedAt)}</span>
                      <span>Created {formatShortDate(c.createdAt)}</span>
                      <span className="font-medium text-foreground/90">
                        {c.contactMethods.length} contact{c.contactMethods.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CustomerWorkspaceShell>
  );
}
