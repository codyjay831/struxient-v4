import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrgSession } from "@/server/phase1/org-session";
import { getCustomerDetail, listCustomerActivity } from "@/server/phase1/queries";
import { Button } from "@/components/ui/button";
import {
  formatContactType,
  formatCustomerKind,
  formatCustomerStatus,
  formatJobStatus,
  formatOpportunityStatus,
  formatQuoteStatus,
} from "@/lib/format-enums";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canViewJobsWorkspace } from "@/lib/phase4-permissions";
import {
  ContactAddCollapsible,
  ContactMethodWorkspaceRow,
  CustomerProfileWorkspaceSection,
} from "./customer-detail-forms";
import { MetadataPill } from "@/components/customers/customer-area";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspacePanelFrame } from "@/components/workspace/workspace-panel-frame";
import { WorkspaceSummaryPanel } from "@/components/workspace/workspace-summary-panel";
import { workspaceDashedEmptyWellClass, workspaceListShellClass } from "@/components/workspace/workspace-surface-tokens";

function formatDetailDate(d: Date) {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return null;
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const ctx = await requireOrgSession();
  const customer = await getCustomerDetail(ctx.organizationId, customerId);
  if (!customer) {
    notFound();
  }

  const activity = await listCustomerActivity(ctx.organizationId, customer.id);

  const contactsForClient = customer.contactMethods.map((c) => ({
    id: c.id,
    type: c.type,
    value: c.value,
    isPrimary: c.isPrimary,
    okToEmail: c.okToEmail,
    okToSms: c.okToSms,
    label: c.label,
    archivedAt: c.archivedAt ? c.archivedAt.toISOString() : null,
  }));

  const activeContacts = customer.contactMethods.filter((m) => !m.archivedAt).length;
  const primaryContact = customer.contactMethods.find((m) => !m.archivedAt && m.isPrimary);
  const firstActiveContact = customer.contactMethods.find((m) => !m.archivedAt);
  const reachabilityHint = primaryContact ?? firstActiveContact;
  const showQuotes = canAuthorQuotes(ctx.role);
  const showJobs = canViewJobsWorkspace(ctx.role);
  const latestActivity = activity[0];

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          back={{ href: "/app/customers", label: "Customers" }}
          eyebrow="Customer record"
          title={customer.displayName}
          description="Durable operational anchor for this party — contacts and internal notes live here; opportunities, quotes, and jobs link through Sales and execution workspaces."
          badges={
            <>
              <MetadataPill variant="outline">{formatCustomerKind(customer.kind)}</MetadataPill>
              <MetadataPill variant="muted">{formatCustomerStatus(customer.status)}</MetadataPill>
            </>
          }
          actions={
            <Button asChild className="rounded-[5px] font-semibold">
              <Link href={`/app/sales/opportunities/new?customerId=${customer.id}`}>New opportunity</Link>
            </Button>
          }
          meta={
            <>
              <span>
                <span className="font-medium text-foreground/90">Created</span> {formatDetailDate(customer.createdAt)}
              </span>
              <span>
                <span className="font-medium text-foreground/90">Updated</span> {formatDetailDate(customer.updatedAt)}
              </span>
              <span>
                <span className="font-medium text-foreground/90">Contacts</span> {activeContacts} active
              </span>
              <span>
                <span className="font-medium text-foreground/90">Opportunities</span> {customer.opportunities.length}
              </span>
            </>
          }
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,17rem)] xl:grid-cols-[minmax(0,1fr)_min(100%,19rem)]">
          <div className="min-w-0 space-y-6">
            <WorkspacePanelFrame
              kicker="Identity"
              title="Profile & notes"
              subtitle="Display name, kind, lifecycle status, and internal relationship context. Edit when something changes — the summary stays scannable day-to-day."
            >
              <CustomerProfileWorkspaceSection
                customerId={customer.id}
                displayName={customer.displayName}
                kind={customer.kind}
                status={customer.status}
                notes={customer.notes}
              />
            </WorkspacePanelFrame>

            <WorkspacePanelFrame
              kicker="Reachability"
              title="Contact methods"
              subtitle="Phones, emails, and labels used across quotes, scheduling, and customer-facing flows."
            >
              <ContactAddCollapsible customerId={customer.id} />
              <div className="mt-5">
                {customer.contactMethods.length === 0 ? (
                  <div className={workspaceDashedEmptyWellClass()}>
                    <p className="text-sm text-muted-foreground dark:text-zinc-400">
                      No contacts yet. Add at least one email or phone when you have it — you can return after creating
                      opportunities.
                    </p>
                  </div>
                ) : (
                  <ul className={workspaceListShellClass()}>
                    {customer.contactMethods.map((c) => (
                      <ContactMethodWorkspaceRow
                        key={c.id}
                        customerId={customer.id}
                        c={contactsForClient.find((x) => x.id === c.id)!}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </WorkspacePanelFrame>

            <WorkspacePanelFrame
              kicker="Sales"
              title="Opportunities"
              subtitle="Pipeline work tied to this customer — intake and quote readiness live on each opportunity."
            >
              {customer.opportunities.length === 0 ? (
                <div className={workspaceDashedEmptyWellClass()}>
                  <p className="text-sm text-muted-foreground dark:text-zinc-400">
                    No opportunities for this customer yet.{" "}
                    <Link
                      className="font-medium text-primary underline-offset-4 hover:underline dark:text-blue-400"
                      href={`/app/sales/opportunities/new?customerId=${customer.id}`}
                    >
                      Create an opportunity
                    </Link>{" "}
                    to capture lead intake and scope.
                  </p>
                </div>
              ) : (
                <ul className={workspaceListShellClass()}>
                  {customer.opportunities.map((o) => (
                    <li key={o.id} className="min-w-0 p-3.5 transition-colors hover:bg-muted/25 dark:hover:bg-zinc-900/40 sm:p-4">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            href={`/app/sales/opportunities/${o.id}`}
                            className="block truncate text-sm font-semibold text-primary hover:underline dark:text-blue-400"
                          >
                            {o.title}
                          </Link>
                          <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                            <span className="font-medium text-foreground/90 dark:text-zinc-300">{formatOpportunityStatus(o.status)}</span>
                            <span className="mx-1.5 text-border dark:text-zinc-700" aria-hidden>
                              ·
                            </span>
                            <span>{o.serviceType}</span>
                          </p>
                          <p className="text-[10px] tabular-nums text-muted-foreground dark:text-zinc-600">
                            Updated {o.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · Created{" "}
                            {o.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </WorkspacePanelFrame>

            {showQuotes ? (
              <WorkspacePanelFrame
                kicker="Commercial"
                title="Quotes"
                subtitle="Quotes owned by opportunities for this customer — open the workspace for pricing, readiness, and send controls."
              >
                {customer.quotes.length === 0 ? (
                  <div className={workspaceDashedEmptyWellClass()}>
                    <p className="text-sm text-muted-foreground dark:text-zinc-400">
                      No quotes have been created for this customer yet. Quotes are authored from the quote workspace after they exist on an
                      opportunity.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground dark:text-zinc-400">
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline dark:text-blue-400"
                        href={`/app/sales/opportunities/new?customerId=${customer.id}`}
                      >
                        New opportunity
                      </Link>{" "}
                      is the supported path to begin intake that can lead to a quote.
                    </p>
                  </div>
                ) : (
                  <ul className={workspaceListShellClass()}>
                    {customer.quotes.map((q) => {
                      const money = formatMoney(q.totalCents);
                      return (
                        <li key={q.id} className="min-w-0 p-3.5 transition-colors hover:bg-muted/25 dark:hover:bg-zinc-900/40 sm:p-4">
                          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                              <Link
                                href={`/app/sales/quotes/${q.id}`}
                                className="block truncate text-sm font-semibold text-primary hover:underline dark:text-blue-400"
                              >
                                #{q.displayNumber}: {q.title}
                              </Link>
                              <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                                <span className="font-medium text-foreground/90 dark:text-zinc-300">{formatQuoteStatus(q.status)}</span>
                                <span className="mx-1.5 text-border dark:text-zinc-700" aria-hidden>
                                  ·
                                </span>
                                <Link
                                  href={`/app/sales/opportunities/${q.opportunity.id}`}
                                  className="text-primary underline-offset-4 hover:underline dark:text-blue-400"
                                >
                                  {q.opportunity.title}
                                </Link>
                                {money ? (
                                  <>
                                    <span className="mx-1.5 text-border dark:text-zinc-700" aria-hidden>
                                      ·
                                    </span>
                                    <span className="font-mono tabular-nums text-foreground/90 dark:text-zinc-300">{money}</span>
                                  </>
                                ) : null}
                              </p>
                              <p className="text-[10px] tabular-nums text-muted-foreground dark:text-zinc-600">
                                Updated {q.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · Created{" "}
                                {q.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </WorkspacePanelFrame>
            ) : null}

            {showJobs ? (
              <WorkspacePanelFrame
                kicker="Execution"
                title="Jobs"
                subtitle="Activated work from accepted quotes — status and execution live on each job workspace."
              >
                {customer.jobs.length === 0 ? (
                  <div className={workspaceDashedEmptyWellClass()}>
                    <p className="text-sm text-muted-foreground dark:text-zinc-400">No jobs for this customer yet.</p>
                  </div>
                ) : (
                  <ul className={workspaceListShellClass()}>
                    {customer.jobs.map((j) => (
                      <li key={j.id} className="min-w-0 p-3.5 transition-colors hover:bg-muted/25 dark:hover:bg-zinc-900/40 sm:p-4">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <Link
                              href={`/app/jobs/${j.id}`}
                              className="block truncate text-sm font-semibold text-primary hover:underline dark:text-blue-400"
                            >
                              Job #{j.displayNumber}: {j.title}
                            </Link>
                            <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                              <span className="rounded-[4px] border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
                                {formatJobStatus(j.status)}
                              </span>
                            </p>
                            <p className="text-[10px] tabular-nums text-muted-foreground dark:text-zinc-600">
                              Updated {j.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkspacePanelFrame>
            ) : null}

            <WorkspacePanelFrame
              kicker="Audit"
              title="Activity"
              subtitle="Staff actions recorded against this customer and related opportunities."
            >
              <div className="min-w-0 overflow-hidden rounded-[6px] border border-border dark:border-zinc-800/60">
                {activity.length === 0 ? (
                  <p className="px-4 py-5 text-sm text-muted-foreground dark:text-zinc-500">No recorded activity yet.</p>
                ) : (
                  <ul className="divide-y divide-border dark:divide-zinc-800/60">
                    {activity.map((e) => (
                      <li key={e.id} className="min-w-0 px-4 py-3.5">
                        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-500">
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                          <time className="text-[11px] tabular-nums text-muted-foreground dark:text-zinc-500">
                            {e.createdAt.toLocaleString()}
                          </time>
                        </div>
                        <p className="mt-1 text-sm text-foreground dark:text-zinc-200">{e.summary}</p>
                        {e.opportunity ? (
                          <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-500">
                            Opportunity:{" "}
                            <Link
                              href={`/app/sales/opportunities/${e.opportunity.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline dark:text-blue-400"
                            >
                              {e.opportunity.title}
                            </Link>
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </WorkspacePanelFrame>
          </div>

          <WorkspaceSummaryPanel title="At a glance">
            <div className="space-y-2 text-[11px] text-muted-foreground dark:text-zinc-500">
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Kind / status</span> —{" "}
                {formatCustomerKind(customer.kind)}, {formatCustomerStatus(customer.status)}
              </p>
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Primary reach</span> —{" "}
                {reachabilityHint ? (
                  <>
                    {formatContactType(reachabilityHint.type)}: <span className="text-foreground/90">{reachabilityHint.value}</span>
                  </>
                ) : (
                  "None on file"
                )}
              </p>
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Contacts</span> — {activeContacts} active /{" "}
                {customer.contactMethods.length} total
              </p>
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Opportunities</span> — {customer.opportunities.length}
              </p>
              {showQuotes ? (
                <p>
                  <span className="font-medium text-foreground dark:text-zinc-200">Quotes</span> — {customer.quotes.length}
                </p>
              ) : null}
              {showJobs ? (
                <p>
                  <span className="font-medium text-foreground dark:text-zinc-200">Jobs</span> — {customer.jobs.length}
                </p>
              ) : null}
            </div>
            {latestActivity ? (
              <div className="border-t border-border pt-3 dark:border-zinc-800/50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">
                  Latest activity
                </p>
                <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-foreground dark:text-zinc-300">{latestActivity.summary}</p>
                <p className="mt-1 text-[10px] tabular-nums text-muted-foreground dark:text-zinc-600">
                  {latestActivity.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            ) : null}
            <div className="border-t border-border pt-3 dark:border-zinc-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/90">Sales lane</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground dark:text-zinc-500">
                Intake and quoting stay in Sales; this record stays the stable anchor.
              </p>
              <div className="mt-3 flex min-w-0 flex-col gap-2">
                <Button asChild size="sm" variant="secondary" className="w-full justify-center rounded-[5px] font-semibold">
                  <Link href={`/app/sales/opportunities/new?customerId=${customer.id}`}>New opportunity</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="w-full justify-center rounded-[5px] font-semibold">
                  <Link href="/app/sales/opportunities">View pipeline</Link>
                </Button>
              </div>
            </div>
          </WorkspaceSummaryPanel>
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
