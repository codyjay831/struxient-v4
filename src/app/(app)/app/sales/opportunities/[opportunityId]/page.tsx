import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { OpportunityStatus, QuoteStatus } from "@prisma/client";
import { requireOrgSession } from "@/server/phase1/org-session";
import { getOpportunityDetail, listOpportunityActivity, listOrganizationMembers } from "@/server/phase1/queries";
import {
  activeContactMethods,
  allQuoteDraftBlockersPass,
  computeQuoteDraftReadiness,
} from "@/server/phase1/readiness";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { formatOpportunityStatus, formatQuoteStatus } from "@/lib/format-enums";
import { NextActionCallout, ReadinessPanel } from "./readiness-panel";
import { CreateQuoteDraftForm } from "./create-quote-draft-form";
import { OpportunityIntakeWorkspace } from "./opportunity-intake-workspace";
import { OpportunityTasksPanel, OpportunityTerminalPanel } from "./opportunity-tasks-and-terminal";
import { MetadataPill } from "@/components/customers/customer-area";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspacePanelFrame } from "@/components/workspace/workspace-panel-frame";
import { WorkspaceSummaryPanel } from "@/components/workspace/workspace-summary-panel";
import { Button } from "@/components/ui/button";

function toDatetimeLocalValue(d: Date | null) {
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function OpportunityDetailPage({ params }: { params: Promise<{ opportunityId: string }> }) {
  const { opportunityId } = await params;
  const ctx = await requireOrgSession();
  const opp = await getOpportunityDetail(ctx.organizationId, opportunityId);
  if (!opp) {
    notFound();
  }

  const membersRaw = await listOrganizationMembers(ctx.organizationId);
  const members = membersRaw.map((m) => ({
    id: m.user.id,
    label: m.user.name?.trim() ? `${m.user.name} (${m.user.email})` : m.user.email,
  }));

  const activeContacts = activeContactMethods(opp.customer.contactMethods);
  const readinessItems = computeQuoteDraftReadiness({
    opportunity: opp,
    activeContactCount: activeContacts,
    tasks: opp.tasks,
  });
  const ready = allQuoteDraftBlockersPass(readinessItems);

  const activity = await listOpportunityActivity(ctx.organizationId, opp.id);

  const isClosed =
    opp.status === OpportunityStatus.LOST ||
    opp.status === OpportunityStatus.NO_QUOTE ||
    opp.status === OpportunityStatus.ARCHIVED;

  const activeDraftStatuses: QuoteStatus[] = [
    QuoteStatus.DRAFT,
    QuoteStatus.MISSING_INFO,
    QuoteStatus.NEEDS_REVIEW,
    QuoteStatus.READY_TO_SEND,
  ];
  const hasActiveDraft = opp.quotes.some((q) => activeDraftStatuses.includes(q.status));

  const intake = {
    id: opp.id,
    customerId: opp.customerId,
    title: opp.title,
    serviceType: opp.serviceType,
    source: opp.source,
    priority: opp.priority,
    status: opp.status,
    serviceAddressText: opp.serviceAddressText,
    serviceAddressTbd: opp.serviceAddressTbd,
    contactIntakeWaived: opp.contactIntakeWaived,
    scopeIntent: opp.scopeIntent,
    desiredTimeline: opp.desiredTimeline,
    salesOwnerUserId: opp.salesOwnerUserId,
    qualificationStatus: opp.qualificationStatus,
    estimatedValue: opp.estimatedValue?.toString() ?? null,
    followUpAtLocal: toDatetimeLocalValue(opp.followUpAt),
  };

  const tasksForClient = opp.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    kind: t.kind,
    isRequired: t.isRequired,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    assigneeUserId: t.assigneeUserId,
    outcome: t.outcome,
  }));

  const latestQuote = opp.quotes[0];
  const blockerCount = readinessItems.filter((i) => i.status === "FAIL").length;
  const firstBlocking = readinessItems.find((i) => i.status === "FAIL");
  const canQuote = canAuthorQuotes(ctx.role);

  let headerPrimary: ReactNode = null;
  if (canQuote && !isClosed) {
    if (latestQuote) {
      headerPrimary = (
        <Button asChild className="rounded-[5px] font-semibold">
          <Link href={`/app/sales/quotes/${latestQuote.id}`}>Open quote workspace</Link>
        </Button>
      );
    } else if (ready && !hasActiveDraft) {
      headerPrimary = (
        <Button asChild className="rounded-[5px] font-semibold">
          <Link href="#opportunity-create-quote">Create quote draft</Link>
        </Button>
      );
    }
  }

  const contactHint =
    activeContacts > 0
      ? `${activeContacts} active contact${activeContacts === 1 ? "" : "s"} on file`
      : opp.contactIntakeWaived
        ? "Contact intake waived"
        : "No active contacts";

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          back={{ href: "/app/sales/opportunities", label: "Opportunities" }}
          eyebrow="Sales opportunity"
          title={opp.title}
          description="Intake workspace for this opportunity — bridge from customer record into quote authoring. Pre-quote tasks stay separate from sold execution."
          badges={<MetadataPill variant="outline">{formatOpportunityStatus(opp.status)}</MetadataPill>}
          meta={
            <>
              <span>
                <span className="font-medium text-foreground/90">Updated</span>{" "}
                {opp.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span>
                <span className="font-medium text-foreground/90">Created</span>{" "}
                {opp.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span>
                <span className="font-medium text-foreground/90">Quotes</span> {opp.quotes.length}
              </span>
            </>
          }
          actions={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {headerPrimary}
              <Button asChild variant="outline" className="rounded-[5px] font-semibold">
                <Link href={`/app/customers/${opp.customer.id}`}>Customer record</Link>
              </Button>
            </div>
          }
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,17rem)] xl:grid-cols-[minmax(0,1fr)_min(100%,19rem)]">
          <div className="min-w-0 space-y-6">
            {isClosed ? (
              <div className="rounded-[6px] border border-border bg-muted/25 px-4 py-3 text-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
                <p className="font-medium text-foreground dark:text-zinc-100">This opportunity is closed.</p>
                {opp.status === OpportunityStatus.LOST && opp.lostReason ? (
                  <p className="mt-2 text-muted-foreground dark:text-zinc-400">
                    <span className="font-medium text-foreground dark:text-zinc-200">Reason: </span>
                    {opp.lostReason}
                  </p>
                ) : null}
                {opp.status === OpportunityStatus.NO_QUOTE && opp.noQuoteReason ? (
                  <p className="mt-2 text-muted-foreground dark:text-zinc-400">
                    <span className="font-medium text-foreground dark:text-zinc-200">Reason: </span>
                    {opp.noQuoteReason}
                  </p>
                ) : null}
              </div>
            ) : null}

            <WorkspacePanelFrame
              kicker="Customer"
              title={opp.customer.displayName}
              subtitle={contactHint}
            >
              <Button asChild size="sm" variant="secondary" className="rounded-[5px] font-semibold">
                <Link href={`/app/customers/${opp.customer.id}`}>Open customer record</Link>
              </Button>
            </WorkspacePanelFrame>

            {!isClosed ? <NextActionCallout items={readinessItems} isClosed={isClosed} /> : null}

            <section className="min-w-0">
              <WorkspacePanelFrame
                kicker="Intake"
                title="Opportunity overview"
                subtitle="Commercial intent, scope, ownership, and location context. Edit only when you need to change fields — the summary stays scannable day-to-day."
              >
                <OpportunityIntakeWorkspace opportunity={intake} members={members} disabled={isClosed} />
              </WorkspacePanelFrame>
            </section>

            <div id="opportunity-readiness">
              <ReadinessPanel items={readinessItems} />
            </div>

            {canQuote && !isClosed ? (
              <section className="min-w-0" id="opportunity-quotes">
                <WorkspacePanelFrame
                  kicker="Commercial"
                  title="Quotes"
                  subtitle="Quotes for this opportunity open in the quote workspace — pricing, execution prep, readiness, and send controls live there."
                >
                  {opp.quotes.length === 0 ? (
                    <div className="space-y-4">
                      {!ready ? (
                        <WorkspaceEmptyState
                          title="No quotes yet"
                          description="Complete the readiness checks above before you can create a quote draft from this opportunity."
                        />
                      ) : hasActiveDraft ? null : (
                        <WorkspaceEmptyState
                          title="No quotes yet"
                          description="Intake checks passed. Create a quote draft to start pricing and internal prep in the quote workspace."
                        />
                      )}
                      {ready && !hasActiveDraft ? (
                        <div id="opportunity-create-quote" className="rounded-[6px] border border-primary/30 bg-primary/5 p-4 dark:border-blue-500/30 dark:bg-blue-500/[0.06]">
                          <h3 className="text-sm font-semibold text-foreground dark:text-zinc-100">Create quote draft</h3>
                          <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-400">
                            Intake checks passed. Start a quote in the workspace—line items, planned execution, readiness, and
                            internal preview are all edited there.
                          </p>
                          <div className="mt-3">
                            <CreateQuoteDraftForm opportunityId={opp.id} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <ul className="min-w-0 divide-y divide-border rounded-[6px] border border-border dark:divide-zinc-800/60 dark:border-zinc-800/60">
                        {opp.quotes.map((q) => (
                          <li
                            key={q.id}
                            className="min-w-0 p-3.5 transition-colors hover:bg-muted/25 dark:hover:bg-zinc-900/40 sm:p-4"
                          >
                            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <p className="truncate text-sm font-semibold text-foreground dark:text-zinc-100">
                                  #{q.displayNumber}: {q.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground dark:text-zinc-500">
                                  <span className="font-medium text-foreground/90 dark:text-zinc-300">
                                    {formatQuoteStatus(q.status)}
                                  </span>
                                  <span className="text-border dark:text-zinc-700" aria-hidden>
                                    ·
                                  </span>
                                  <span>
                                    {q.sentAt
                                      ? `Sent ${q.sentAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                                      : "Not sent"}
                                  </span>
                                  <span className="text-border dark:text-zinc-700" aria-hidden>
                                    ·
                                  </span>
                                  <span className="font-mono tabular-nums text-foreground/90 dark:text-zinc-300">
                                    Total {formatMoney(q.totalCents)}
                                  </span>
                                </div>
                                <p className="text-[10px] tabular-nums text-muted-foreground dark:text-zinc-600">
                                  Updated {q.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · Created{" "}
                                  {q.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                                </p>
                              </div>
                              <Button asChild size="sm" className="w-fit shrink-0 rounded-[5px] font-semibold lg:self-center">
                                <Link href={`/app/sales/quotes/${q.id}`}>Open workspace</Link>
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {ready && !hasActiveDraft ? (
                        <div id="opportunity-create-quote" className="rounded-[6px] border border-primary/30 bg-primary/5 p-4 dark:border-blue-500/30 dark:bg-blue-500/[0.06]">
                          <h3 className="text-sm font-semibold text-foreground dark:text-zinc-100">Create quote draft</h3>
                          <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-400">
                            Intake checks passed. Start a quote in the workspace—line items, planned execution, readiness, and
                            internal preview are all edited there.
                          </p>
                          <div className="mt-3">
                            <CreateQuoteDraftForm opportunityId={opp.id} />
                          </div>
                        </div>
                      ) : null}
                      {ready && hasActiveDraft ? (
                        <div className="rounded-[6px] border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100/90">
                          An active quote draft already exists for this opportunity. Open it from the list above—only one active
                          draft is allowed until the quote is sent.
                        </div>
                      ) : null}
                    </div>
                  )}
                </WorkspacePanelFrame>
              </section>
            ) : null}

            <section className="min-w-0">
              <WorkspacePanelFrame
                kicker="Intake checklist"
                title="Pre-quote tasks"
                subtitle="Sales and pre-quote tasks only. They do not become field runtime tasks and are not job execution work."
              >
                <OpportunityTasksPanel opportunityId={opp.id} tasks={tasksForClient} members={members} disabled={isClosed} />
              </WorkspacePanelFrame>
            </section>

            {!isClosed ? (
              <section className="min-w-0">
                <WorkspacePanelFrame
                  kicker="Pipeline"
                  title="Close outcome"
                  subtitle="Mark lost, no-quote, or archive when intake is finished."
                >
                  <OpportunityTerminalPanel opportunityId={opp.id} />
                </WorkspacePanelFrame>
              </section>
            ) : null}

            <section className="min-w-0">
              <WorkspacePanelFrame kicker="Audit" title="Activity" subtitle="Staff actions and system events for this opportunity.">
              <div className="overflow-hidden rounded-[6px] border border-border bg-card/20 dark:border-zinc-800/60 dark:bg-zinc-950/25">
                {activity.length === 0 ? (
                  <WorkspaceEmptyState
                    className="border-0 bg-transparent py-8"
                    title="No activity yet"
                    description="Events from intake edits, quote drafts, and pipeline changes will appear here."
                  />
                ) : (
                  <ul className="divide-y divide-border dark:divide-zinc-800/60">
                    {activity.map((e) => (
                      <li key={e.id} className="min-w-0 px-4 py-3.5">
                        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                          <time className="text-[11px] tabular-nums text-muted-foreground dark:text-zinc-500">
                            {e.createdAt.toLocaleString()}
                          </time>
                        </div>
                        <p className="mt-1 text-sm text-foreground dark:text-zinc-200">{e.summary}</p>
                        {e.actor ? (
                          <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-500">
                            {(e.actor.name ?? e.actor.email) ?? "System"}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </WorkspacePanelFrame>
            </section>
          </div>

          <WorkspaceSummaryPanel title="Opportunity brief">
            <div className="space-y-2 text-[11px] text-muted-foreground dark:text-zinc-500">
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Status</span> — {formatOpportunityStatus(opp.status)}
              </p>
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Customer</span> —{" "}
                <Link href={`/app/customers/${opp.customer.id}`} className="text-primary hover:underline dark:text-blue-400">
                  {opp.customer.displayName}
                </Link>
              </p>
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Quotes</span> — {opp.quotes.length}
              </p>
              {latestQuote ? (
                <p className="min-w-0">
                  <span className="font-medium text-foreground dark:text-zinc-200">Latest quote</span> —{" "}
                  <Link
                    href={`/app/sales/quotes/${latestQuote.id}`}
                    className="text-primary hover:underline dark:text-blue-400"
                  >
                    #{latestQuote.displayNumber}
                  </Link>
                  <span className="text-border dark:text-zinc-700"> · </span>
                  {formatQuoteStatus(latestQuote.status)}
                  <span className="text-border dark:text-zinc-700"> · </span>
                  <span className="font-mono tabular-nums">{formatMoney(latestQuote.totalCents)}</span>
                </p>
              ) : null}
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Draft readiness</span> —{" "}
                {ready ? (
                  <span className="text-emerald-700 dark:text-emerald-400">Clear to create quote</span>
                ) : (
                  <span className="text-destructive">
                    {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </div>
            <div className="border-t border-border pt-3 dark:border-zinc-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/90">Next</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground dark:text-zinc-400">
                {isClosed
                  ? "This opportunity is closed — review activity for context."
                  : firstBlocking
                    ? `${firstBlocking.label}: ${firstBlocking.explanation}`
                    : latestQuote
                      ? "Continue in the quote workspace to price, prep execution, and run send readiness."
                      : "Create a quote draft when intake checks are satisfied."}
              </p>
              {canQuote && !isClosed && latestQuote ? (
                <Button asChild size="sm" className="mt-3 w-full rounded-[5px] font-semibold" variant="secondary">
                  <Link href={`/app/sales/quotes/${latestQuote.id}`}>Open latest quote</Link>
                </Button>
              ) : null}
              {canQuote && !isClosed && !latestQuote && ready && !hasActiveDraft ? (
                <Button asChild size="sm" className="mt-3 w-full rounded-[5px] font-semibold" variant="secondary">
                  <Link href="#opportunity-create-quote">Create quote draft</Link>
                </Button>
              ) : null}
            </div>
          </WorkspaceSummaryPanel>
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
