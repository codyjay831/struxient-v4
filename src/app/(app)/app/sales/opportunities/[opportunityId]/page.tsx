import Link from "next/link";
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
import { formatQuoteStatus } from "@/lib/format-enums";
import { NextActionCallout, ReadinessPanel } from "./readiness-panel";
import { CreateQuoteDraftForm } from "./create-quote-draft-form";
import { OpportunityIntakeForm } from "./opportunity-intake-form";
import { OpportunityTasksPanel, OpportunityTerminalPanel } from "./opportunity-tasks-and-terminal";

function toDatetimeLocalValue(d: Date | null) {
  if (!d) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="space-y-2">
        <Link href="/app/sales/opportunities" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Opportunities
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{opp.title}</h1>
          <span className="rounded-sm border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
            {opp.status.replace(/_/g, " ")}
          </span>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Intake workspace for this opportunity. Sales and pre-quote tasks stay separate from sold execution.
        </p>
      </div>

      {isClosed ? (
        <div className="rounded-sm border border-border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">This opportunity is closed.</p>
          {opp.status === OpportunityStatus.LOST && opp.lostReason ? (
            <p className="mt-2 text-muted-foreground">
              <span className="font-medium text-foreground">Reason: </span>
              {opp.lostReason}
            </p>
          ) : null}
          {opp.status === OpportunityStatus.NO_QUOTE && opp.noQuoteReason ? (
            <p className="mt-2 text-muted-foreground">
              <span className="font-medium text-foreground">Reason: </span>
              {opp.noQuoteReason}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3 rounded-sm border border-border bg-card/20 p-4">
        <h2 className="text-sm font-semibold text-foreground">Customer</h2>
        <p className="text-sm text-foreground">{opp.customer.displayName}</p>
        <Link href={`/app/customers/${opp.customer.id}`} className="text-sm font-medium text-primary hover:underline">
          Open customer record
        </Link>
      </section>

      <NextActionCallout items={readinessItems} isClosed={isClosed} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Intake details</h2>
        <OpportunityIntakeForm opportunity={intake} members={members} disabled={isClosed} />
      </section>

      <ReadinessPanel items={readinessItems} />

      {canAuthorQuotes(ctx.role) && !isClosed && opp.quotes.length > 0 ? (
        <section className="space-y-3 rounded-sm border border-border bg-card/10 p-4">
          <h2 className="text-sm font-semibold text-foreground">Quotes</h2>
          <ul className="space-y-2">
            {opp.quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium text-foreground">
                    Quote #{q.displayNumber}: {q.title}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatQuoteStatus(q.status)}</span>
                </div>
                <Link href={`/app/sales/quotes/${q.id}`} className="text-primary hover:underline">
                  Open workspace
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canAuthorQuotes(ctx.role) && !isClosed && ready && !hasActiveDraft ? (
        <section className="space-y-3 rounded-sm border border-primary/30 bg-primary/5 p-5">
          <h2 className="text-sm font-semibold text-foreground">Create quote draft</h2>
          <p className="text-sm text-muted-foreground">
            Intake checks passed. Start a quote in the workspace—line items, planned execution, readiness, and
            internal preview are all edited there.
          </p>
          <CreateQuoteDraftForm opportunityId={opp.id} />
        </section>
      ) : null}

      {canAuthorQuotes(ctx.role) && !isClosed && ready && hasActiveDraft ? (
        <div className="rounded-sm border border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
          An active quote draft already exists for this opportunity. Open it from the list above—only one active
          draft is allowed until the quote is sent.
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Intake checklist</h2>
        <p className="text-xs text-muted-foreground">
          Sales and pre-quote tasks only. They do not become field runtime tasks and are not job execution work.
        </p>
        <OpportunityTasksPanel opportunityId={opp.id} tasks={tasksForClient} members={members} disabled={isClosed} />
      </section>

      {!isClosed ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Close outcome</h2>
          <OpportunityTerminalPanel opportunityId={opp.id} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        <div className="rounded-sm border border-border bg-card/10">
          {activity.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {e.eventType.replace(/_/g, " ")}
                    </span>
                    <time className="text-xs text-muted-foreground">{e.createdAt.toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{e.summary}</p>
                  {e.actor ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(e.actor.name ?? e.actor.email) ?? "System"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
