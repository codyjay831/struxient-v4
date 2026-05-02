"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CustomerContactType,
  PricingMode,
  QuoteAssumptionVisibility,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskStatus,
  QuoteWorkTemplateKind,
} from "@prisma/client";
import type { QuoteSendReadinessItem } from "@/server/phase2/quote-readiness";
import type { QuoteCustomerPreviewDTO, QuotePreviewWorkspaceResolution } from "@/server/phase2/customer-preview";
import {
  addQuoteAssumption,
  addQuoteLineExecutionStage,
  addQuoteLineExecutionTask,
  addQuoteLineItem,
  addQuoteTask,
  logQuotePreviewed,
  markQuoteLineRemoved,
  markQuoteReadyToSend,
  markQuoteSent,
  removeQuoteAssumption,
  removeQuoteLineExecutionStage,
  type QuoteActionResult,
  updateQuote,
  updateQuoteAssumption,
  updateQuoteLineExecutionStage,
  updateQuoteLineExecutionTask,
  updateQuoteLineExecutionTaskStatus,
  updateQuoteLineItem,
  updateQuoteTask,
  updateQuoteTaskStatus,
} from "@/app/(app)/app/sales/quotes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { formatContactType, formatQuoteStatus } from "@/lib/format-enums";
import {
  SaveWorkTemplateDialog,
  WorkTemplateInsertDialog,
  type WorkTemplatesBundleDTO,
} from "@/app/(app)/app/sales/quotes/[quoteId]/quote-work-template-ui";

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function ActionError({ state }: { state: QuoteActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-sm text-destructive" role="alert">
      {state.error}
    </p>
  );
}

function ReadinessRow({ item }: { item: QuoteSendReadinessItem }) {
  const tone =
    item.status === "FAIL"
      ? "text-destructive"
      : item.severity === "WARNING"
        ? "text-amber-400"
        : "text-muted-foreground";
  return (
    <li className="flex flex-col gap-1 border-b border-border py-3 last:border-0 sm:flex-row sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.explanation}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          Fix: {item.fixLocation} · {item.severity}
        </p>
      </div>
      <span className={`shrink-0 text-xs font-semibold ${tone}`}>{item.status.replace(/_/g, " ")}</span>
    </li>
  );
}

function PreviewLogger({ quoteId }: { quoteId: string }) {
  const [state, action] = useActionState(logQuotePreviewed, undefined);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const fd = new FormData();
    fd.set("quoteId", quoteId);
    void action(fd);
  }, [action, quoteId]);
  return <ActionError state={state} />;
}

export type QuoteWorkspaceProps = {
  organizationName: string;
  quote: {
    id: string;
    displayNumber: number;
    status: QuoteStatus;
    title: string;
    serviceAddressText: string | null;
    serviceAddressTbd: boolean;
    scopeIntent: string;
    scopeSummary: string | null;
    customerFacingIntro: string | null;
    internalNotes: string | null;
    pricingSubtotalCents: number | null;
    totalCents: number | null;
    sentAt: string | null;
    customerId: string;
    opportunityId: string;
    ownerUserId: string | null;
    customer: {
      id: string;
      displayName: string;
      contacts: { id: string; type: string; value: string; isPrimary: boolean; label: string | null }[];
    };
    opportunity: { id: string; title: string; serviceType: string };
    lineItems: {
      id: string;
      title: string;
      customerDescription: string;
      quantity: string;
      unitPriceCents: number | null;
      lineTotalCents: number | null;
      pricingMode: PricingMode;
      lineMode: QuoteLineMode;
      sortOrder: number;
      internalNotes: string | null;
      sourceTemplateId: string | null;
      sourceTemplateKind: QuoteWorkTemplateKind | null;
      sourceTemplateVersion: number | null;
      sourceTemplateName: string | null;
      executionStages: {
        id: string;
        title: string;
        sortOrder: number;
        internalNotes: string | null;
        tasks: {
          id: string;
          title: string;
          description: string | null;
          status: QuoteTaskStatus;
          isRequired: boolean;
          sortOrder: number;
          assignedRole: string | null;
          estimatedDurationMinutes: number | null;
          customerVisible: boolean;
          customerLabel: string | null;
          internalNotes: string | null;
        }[];
      }[];
    }[];
    /** Internal quote-prep checklist only. */
    tasks: {
      id: string;
      title: string;
      description: string | null;
      status: QuoteTaskStatus;
      isRequired: boolean;
      sortOrder: number;
      assignedRole: string | null;
      estimatedDurationMinutes: number | null;
      customerVisible: boolean;
      customerLabel: string | null;
      internalNotes: string | null;
    }[];
    assumptions: {
      id: string;
      visibility: QuoteAssumptionVisibility;
      text: string;
      sortOrder: number;
      quoteLineItemId: string | null;
    }[];
  };
  readiness: QuoteSendReadinessItem[];
  sendBlocked: boolean;
  warningCount: number;
  activity: { id: string; eventType: string; summary: string; createdAt: string }[];
  members: { id: string; label: string }[];
  previewResolution: QuotePreviewWorkspaceResolution;
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
};

export function QuoteWorkspace(props: QuoteWorkspaceProps) {
  const {
    quote,
    readiness,
    sendBlocked,
    warningCount,
    activity,
    members,
    previewResolution,
    workTemplates,
    canManageWorkTemplates,
  } = props;
  const isSent = quote.status === QuoteStatus.SENT;
  const preview = previewResolution.kind === "SENT_SNAPSHOT_MISSING" ? null : previewResolution.preview;
  const snapshotIntegrityError = previewResolution.kind === "SENT_SNAPSHOT_MISSING";
  const [headerState, headerAction] = useActionState(updateQuote, undefined);
  const [readyState, readyAction] = useActionState(markQuoteReadyToSend, undefined);
  const [sentState, sentAction] = useActionState(markQuoteSent, undefined);

  const headline = sendBlocked
    ? "Send blocked — resolve checklist blockers"
    : warningCount > 0
      ? "Ready to proceed with warnings — review checklist"
      : "Send readiness satisfied";

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6">
      <div className="space-y-2">
        <Link href="/app/sales/opportunities" className="text-xs font-medium text-muted-foreground hover:text-foreground">
          ← Sales
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{quote.title}</h1>
          <span className="rounded-sm border border-border bg-muted/30 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Quote #{quote.displayNumber}
          </span>
          <span className="rounded-sm border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
            {formatQuoteStatus(quote.status)}
          </span>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Single workspace for commercial scope, dormant quote-plan execution (not active field work), readiness, and
          internal customer preview.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
          <span className="text-foreground">
            Total: <span className="font-semibold tabular-nums">{fmtMoney(quote.totalCents)}</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className={sendBlocked ? "text-destructive" : "text-emerald-400"}>{headline}</span>
        </div>
        {!isSent ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <form action={readyAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <Button type="submit" variant="secondary" className="rounded-sm" disabled={sendBlocked}>
                Mark ready to send
              </Button>
            </form>
            <form action={sentAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <Button type="submit" className="rounded-sm" disabled={sendBlocked}>
                Mark sent
              </Button>
            </form>
          </div>
        ) : (
          <p className="pt-2 text-xs text-muted-foreground">
            Sent {quote.sentAt ? new Date(quote.sentAt).toLocaleString() : ""}. Structural edits are locked; internal
            notes may still be updated below.
          </p>
        )}
        <ActionError state={readyState} />
        <ActionError state={sentState} />
      </div>

      <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Quote header</h2>
        <form action={headerAction} className="grid gap-4 md:grid-cols-2">
          <input type="hidden" name="quoteId" value={quote.id} />
          {isSent ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="q-internal">Internal notes</Label>
              <Textarea id="q-internal" name="internalNotes" defaultValue={quote.internalNotes ?? ""} rows={4} className="rounded-sm" />
              <Button type="submit" className="rounded-sm">
                Save internal notes
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-title">Title</Label>
                <Input id="q-title" name="title" defaultValue={quote.title} required className="rounded-sm" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-scope">Scope intent</Label>
                <Textarea id="q-scope" name="scopeIntent" defaultValue={quote.scopeIntent} required rows={3} className="rounded-sm" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-sum">Scope summary (optional)</Label>
                <Textarea id="q-sum" name="scopeSummary" defaultValue={quote.scopeSummary ?? ""} rows={2} className="rounded-sm" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-intro">Customer-facing intro (optional)</Label>
                <Textarea id="q-intro" name="customerFacingIntro" defaultValue={quote.customerFacingIntro ?? ""} rows={2} className="rounded-sm" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-addr">Service address</Label>
                <Textarea id="q-addr" name="serviceAddressText" defaultValue={quote.serviceAddressText ?? ""} rows={2} className="rounded-sm" />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="serviceAddressTbd" value="true" defaultChecked={quote.serviceAddressTbd} />
                  Service location not yet determined
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-owner">Owner</Label>
                <select
                  id="q-owner"
                  name="ownerUserId"
                  defaultValue={quote.ownerUserId ?? ""}
                  className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-status">Pipeline status</Label>
                <select
                  id="q-status"
                  name="status"
                  defaultValue={quote.status}
                  className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm"
                >
                  {[QuoteStatus.DRAFT, QuoteStatus.MISSING_INFO, QuoteStatus.NEEDS_REVIEW, QuoteStatus.READY_TO_SEND].map(
                    (s) => (
                      <option key={s} value={s}>
                        {formatQuoteStatus(s)}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="q-internal">Internal notes</Label>
                <Textarea id="q-internal" name="internalNotes" defaultValue={quote.internalNotes ?? ""} rows={3} className="rounded-sm" />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" className="rounded-sm">
                  Save header
                </Button>
              </div>
            </>
          )}
          <ActionError state={headerState} />
        </form>
      </section>

      <section className="space-y-3 rounded-sm border border-border bg-card/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Customer + job context</h2>
        <p className="text-sm text-foreground">{quote.customer.displayName}</p>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Contacts</p>
          {quote.customer.contacts.length === 0 ? (
            <p>No active contacts. Add methods on the customer record.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {quote.customer.contacts.map((c) => (
                <li key={c.id}>
                  {formatContactType(c.type as CustomerContactType)}: {c.value}
                  {c.label ? ` (${c.label})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Opportunity: </span>
          {quote.opportunity.title} · {quote.opportunity.serviceType}
        </p>
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <Link href={`/app/customers/${quote.customer.id}`} className="text-primary hover:underline">
            Customer record
          </Link>
          <Link href={`/app/sales/opportunities/${quote.opportunity.id}`} className="text-primary hover:underline">
            Opportunity intake
          </Link>
        </div>
      </section>

      <LineItemsSection
        quoteId={quote.id}
        lines={quote.lineItems}
        isSent={isSent}
        workTemplates={workTemplates}
        canManageWorkTemplates={canManageWorkTemplates}
      />
      <QuotePrepSection quoteId={quote.id} tasks={quote.tasks} isSent={isSent} />
      <AssumptionsSection quoteId={quote.id} lines={quote.lineItems} assumptions={quote.assumptions} isSent={isSent} />

      <section className="space-y-3 rounded-sm border border-border bg-card/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Pricing</h2>
        <p className="text-sm text-foreground">
          Subtotal: <span className="tabular-nums font-medium">{fmtMoney(quote.pricingSubtotalCents)}</span>
        </p>
        <p className="text-sm text-foreground">
          Total: <span className="tabular-nums font-medium">{fmtMoney(quote.totalCents)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Non-fixed modes are shown clearly on each line and in the internal preview. Tax, margin, and payments are out
          of scope for this release.
        </p>
      </section>

      <section className="space-y-3 rounded-sm border border-border bg-card/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Send readiness</h2>
        <p className="text-xs text-muted-foreground">Computed on the server. Blockers prevent Mark ready and Mark sent.</p>
        <ul className="rounded-sm border border-border bg-background/40">
          {readiness.map((r) => (
            <ReadinessRow key={r.key} item={r} />
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-sm border border-primary/25 bg-primary/5 p-5">
        <h2 className="text-sm font-semibold text-foreground">Internal preview</h2>
        <p className="text-xs text-muted-foreground">
          This is what the customer-facing proposal will include. Not a customer portal—internal staff only.
        </p>
        {snapshotIntegrityError ? (
          <div
            className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground"
            role="status"
          >
            <p className="font-medium text-amber-200">Sent snapshot integrity issue</p>
            <p className="mt-2 text-muted-foreground">
              This quote is marked sent but the frozen customer preview snapshot is missing or invalid. A live rebuild is
              not shown by design. Contact engineering or restore snapshot data before relying on this record.
            </p>
          </div>
        ) : (
          <>
            <PreviewLogger quoteId={quote.id} />
            {preview ? <PreviewBody preview={preview} /> : <p className="text-sm text-muted-foreground">No preview data.</p>}
          </>
        )}
      </section>

      <section className="space-y-3 rounded-sm border border-border bg-card/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-sm border border-border">
            {activity.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium uppercase tracking-wide">{e.eventType.replace(/_/g, " ")}</span>
                  <time>{new Date(e.createdAt).toLocaleString()}</time>
                </div>
                <p className="mt-1 text-sm text-foreground">{e.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PreviewBody({ preview }: { preview: QuoteCustomerPreviewDTO }) {
  return (
    <div className="space-y-4 rounded-sm border border-border bg-background/80 p-4 text-sm">
      <p className="text-xs text-muted-foreground">{preview.organizationName}</p>
      <p className="text-base font-semibold text-foreground">
        {preview.quoteTitle} · #{preview.displayNumber}
      </p>
      <p className="text-muted-foreground">{preview.customerDisplayName}</p>
      <Separator />
      <p className="text-foreground">{preview.serviceAddressSummary}</p>
      {preview.scopeSummary ? <p className="text-muted-foreground">{preview.scopeSummary}</p> : null}
      {preview.customerFacingIntro ? <p className="leading-relaxed text-foreground">{preview.customerFacingIntro}</p> : null}
      <ul className="space-y-3">
        {preview.lineItems.map((l, i) => (
          <li key={i} className="rounded-sm border border-border/80 p-3">
            <p className="font-medium text-foreground">{l.title}</p>
            <p className="mt-1 text-muted-foreground">{l.customerDescription}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Qty {l.quantityDisplay} · {l.pricingPresentation}
            </p>
            {l.customerVisibleAssumptions.length ? (
              <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                {l.customerVisibleAssumptions.map((a, j) => (
                  <li key={j}>{a}</li>
                ))}
              </ul>
            ) : null}
            {(l.customerVisibleExecutionHighlights ?? []).length ? (
              <div className="mt-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Customer-visible milestones</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {(l.customerVisibleExecutionHighlights ?? []).map((h, j) => (
                    <li key={j}>{h.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {preview.customerVisibleQuoteAssumptions.length ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Assumptions</p>
          <ul className="list-disc pl-4 text-sm text-muted-foreground">
            {preview.customerVisibleQuoteAssumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.plannedCustomerHighlights.length ? (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Customer-visible milestones (legacy)</p>
          <ul className="list-disc pl-4 text-sm text-muted-foreground">
            {preview.plannedCustomerHighlights.map((m, i) => (
              <li key={i}>{m.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {preview.statusLabel} · {new Date(preview.asOf).toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">
        Subtotal {preview.subtotalCents != null ? fmtMoney(preview.subtotalCents) : "—"} · Total{" "}
        {preview.totalCents != null ? fmtMoney(preview.totalCents) : "—"}
      </p>
    </div>
  );
}

function LineItemsSection({
  quoteId,
  lines,
  isSent,
  workTemplates,
  canManageWorkTemplates,
}: {
  quoteId: string;
  lines: QuoteWorkspaceProps["quote"]["lineItems"];
  isSent: boolean;
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
}) {
  const [addState, addAction] = useActionState(addQuoteLineItem, undefined);
  return (
    <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <h2 className="text-sm font-semibold text-foreground">Line items</h2>
      <p className="text-xs text-muted-foreground">Commercial scope lives on lines—not on a separate scope page.</p>
      {lines.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          No line items yet. Add the first priced line to describe what the customer is buying.
        </p>
      ) : (
        <div className="space-y-6">
          {lines.map((l) => (
            <LineItemEditor
              key={l.id}
              quoteId={quoteId}
              line={l}
              isSent={isSent}
              workTemplates={workTemplates}
              canManageWorkTemplates={canManageWorkTemplates}
            />
          ))}
        </div>
      )}
      {!isSent ? (
        <>
          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add line item</h3>
            <WorkTemplateInsertDialog
              quoteId={quoteId}
              insertKind="line"
              items={workTemplates.line}
              canManageTemplates={canManageWorkTemplates}
              title="Insert line from template"
              emptyTitle="No line templates yet"
              emptyBody="Save an existing line (with its execution plan) as a template, then insert it here as editable quote-owned work."
              trigger={
                <Button type="button" variant="outline" size="sm" className="rounded-sm text-xs">
                  Add from template
                </Button>
              }
            />
          </div>
          <form action={addAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="quoteId" value={quoteId} />
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input name="title" required className="rounded-sm" placeholder="e.g. Install EV charger" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Customer description</Label>
              <Textarea name="customerDescription" required rows={2} className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input name="quantity" defaultValue="1" required className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label>Unit price (cents)</Label>
              <Input name="unitPriceCents" type="number" min={0} className="rounded-sm" placeholder="185000" />
            </div>
            <div className="space-y-2">
              <Label>Pricing mode</Label>
              <select name="pricingMode" className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm" defaultValue={PricingMode.FIXED_PRICE}>
                {Object.values(PricingMode).map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Line mode</Label>
              <select name="lineMode" className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm" defaultValue={QuoteLineMode.REQUIRED}>
                {Object.values(QuoteLineMode).map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Internal notes</Label>
              <Textarea name="internalNotes" rows={2} className="rounded-sm" />
            </div>
            <Button type="submit" className="rounded-sm md:col-span-2">
              Add line item
            </Button>
            <ActionError state={addState} />
          </form>
        </>
      ) : null}
    </section>
  );
}

function LineItemExecutionPlanning({
  quoteId,
  line,
  workTemplates,
  canManageWorkTemplates,
}: {
  quoteId: string;
  line: QuoteWorkspaceProps["quote"]["lineItems"][number];
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
}) {
  const stages = [...line.executionStages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quoted execution plan (dormant)</h4>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Execution tasks always live under a stage (never directly on the line). Add a stage first, then add tasks inside
        it. Tasks stay internal until you mark them customer-visible with a label for the internal preview.
      </p>
      {stages.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No stages yet. Create a stage (for example Permit or Install), then add tasks under that stage.
        </p>
      ) : (
        <ul className="space-y-4">
          {stages.map((s) => (
            <LineExecutionStageEditor
              key={s.id}
              quoteId={quoteId}
              lineId={line.id}
              stage={s}
              workTemplates={workTemplates}
              canManageWorkTemplates={canManageWorkTemplates}
            />
          ))}
        </ul>
      )}
      <AddExecutionStageForm
        quoteId={quoteId}
        lineItemId={line.id}
        workTemplates={workTemplates}
        canManageWorkTemplates={canManageWorkTemplates}
      />
    </div>
  );
}

function AddExecutionStageForm({
  quoteId,
  lineItemId,
  workTemplates,
  canManageWorkTemplates,
}: {
  quoteId: string;
  lineItemId: string;
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
}) {
  const [st, act] = useActionState(addQuoteLineExecutionStage, undefined);
  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border/80 bg-muted/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">New stage</p>
        <WorkTemplateInsertDialog
          quoteId={quoteId}
          insertKind="stage"
          lineItemId={lineItemId}
          items={workTemplates.stage}
          canManageTemplates={canManageWorkTemplates}
          title="Insert stage from template"
          emptyTitle="No stage templates yet"
          emptyBody="Save an existing stage and its tasks as a template, then insert a copy under this line."
          trigger={
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-sm text-xs">
              Add stage from template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="lineItemId" value={lineItemId} />
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">New stage title</Label>
          <Input name="title" required className="rounded-sm" placeholder="e.g. Permitting" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Stage internal notes (optional)</Label>
          <Textarea name="internalNotes" rows={2} className="rounded-sm" />
        </div>
        <Button type="submit" size="sm" variant="secondary" className="rounded-sm md:col-span-2">
          Add stage
        </Button>
        <ActionError state={st} />
      </form>
    </div>
  );
}

function LineExecutionStageEditor({
  quoteId,
  lineId,
  stage,
  workTemplates,
  canManageWorkTemplates,
}: {
  quoteId: string;
  lineId: string;
  stage: QuoteWorkspaceProps["quote"]["lineItems"][number]["executionStages"][number];
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
}) {
  const [st, act] = useActionState(updateQuoteLineExecutionStage, undefined);
  const [rmSt, rmAct] = useActionState(removeQuoteLineExecutionStage, undefined);
  const tasks = [...stage.tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return (
    <li className="rounded-sm border border-border/80 bg-background/40 p-3">
      <div className="mb-2 flex flex-wrap justify-end gap-2">
        <SaveWorkTemplateDialog
          quoteId={quoteId}
          saveKind="stage"
          lineItemId={lineId}
          stageId={stage.id}
          defaultName={stage.title}
          trigger={
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-sm text-xs text-muted-foreground">
              Save stage as template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="lineItemId" value={lineId} />
        <input type="hidden" name="stageId" value={stage.id} />
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Stage title</Label>
          <Input name="title" defaultValue={stage.title} required className="rounded-sm" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Stage internal notes</Label>
          <Textarea name="internalNotes" defaultValue={stage.internalNotes ?? ""} rows={2} className="rounded-sm" />
        </div>
        <Button type="submit" size="sm" variant="secondary" className="rounded-sm md:col-span-2">
          Save stage
        </Button>
        <ActionError state={st} />
      </form>
      <form action={rmAct} className="mt-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="stageId" value={stage.id} />
        <Button type="submit" size="sm" variant="outline" className="rounded-sm">
          Remove stage
        </Button>
        <ActionError state={rmSt} />
      </form>
      <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">Tasks in this stage</p>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks in this stage yet.</p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => (
              <LineExecutionTaskEditor key={t.id} quoteId={quoteId} stageId={stage.id} task={t} />
            ))}
          </ul>
        )}
        <AddLineExecutionTaskForm
          quoteId={quoteId}
          stageId={stage.id}
          workTemplates={workTemplates}
          canManageWorkTemplates={canManageWorkTemplates}
        />
      </div>
    </li>
  );
}

function AddLineExecutionTaskForm({
  quoteId,
  stageId,
  workTemplates,
  canManageWorkTemplates,
}: {
  quoteId: string;
  stageId: string;
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
}) {
  const [st, act] = useActionState(addQuoteLineExecutionTask, undefined);
  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border/60 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase text-muted-foreground">New task</p>
        <WorkTemplateInsertDialog
          quoteId={quoteId}
          insertKind="task"
          stageId={stageId}
          items={workTemplates.task}
          canManageTemplates={canManageWorkTemplates}
          title="Insert task from template"
          emptyTitle="No task templates yet"
          emptyBody="Save an individual execution task as a template, then insert a copy into this stage."
          trigger={
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-sm text-xs">
              Add task from template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="stageId" value={stageId} />
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Task title</Label>
          <Input name="title" required className="rounded-sm" placeholder="e.g. Submit permit application" />
        </div>
      <div className="space-y-2 md:col-span-2">
        <Label className="text-xs">Description</Label>
        <Textarea name="description" rows={2} className="rounded-sm" />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
        <input type="checkbox" name="isRequired" />
        Required for readiness (line-level)
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
        <input type="checkbox" name="customerVisible" />
        Customer-visible (internal preview)
      </label>
      <div className="space-y-2 md:col-span-2">
        <Label className="text-xs">Customer label (if visible)</Label>
        <Input name="customerLabel" className="rounded-sm" />
      </div>
        <Button type="submit" size="sm" className="rounded-sm md:col-span-2">
          Add task
        </Button>
        <ActionError state={st} />
      </form>
    </div>
  );
}

function LineExecutionTaskEditor({
  quoteId,
  stageId,
  task,
}: {
  quoteId: string;
  stageId: string;
  task: QuoteWorkspaceProps["quote"]["lineItems"][number]["executionStages"][number]["tasks"][number];
}) {
  const [st, act] = useActionState(updateQuoteLineExecutionTask, undefined);
  const [stStatus, actStatus] = useActionState(updateQuoteLineExecutionTaskStatus, undefined);
  return (
    <li className="rounded-sm border border-border p-2">
      <div className="mb-2 flex justify-end">
        <SaveWorkTemplateDialog
          quoteId={quoteId}
          saveKind="task"
          stageId={stageId}
          taskId={task.id}
          defaultName={task.title}
          trigger={
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-sm text-xs text-muted-foreground">
              Save task as template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="stageId" value={stageId} />
        <input type="hidden" name="taskId" value={task.id} />
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Title</Label>
          <Input name="title" defaultValue={task.title} required className="rounded-sm" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea name="description" defaultValue={task.description ?? ""} rows={2} className="rounded-sm" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="isRequired" defaultChecked={task.isRequired} />
          Required
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
          <input type="checkbox" name="customerVisible" defaultChecked={task.customerVisible} />
          Customer-visible
        </label>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Customer label</Label>
          <Input name="customerLabel" defaultValue={task.customerLabel ?? ""} className="rounded-sm" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-xs">Internal notes</Label>
          <Textarea name="internalNotes" defaultValue={task.internalNotes ?? ""} rows={2} className="rounded-sm" />
        </div>
        <Button type="submit" size="sm" className="rounded-sm md:col-span-2">
          Save task
        </Button>
        <ActionError state={st} />
      </form>
      <form action={actStatus} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="taskId" value={task.id} />
        <Label className="text-xs text-muted-foreground">Status</Label>
        <select name="status" defaultValue={task.status} className="h-9 rounded-sm border border-input bg-background px-2 text-sm">
          {Object.values(QuoteTaskStatus).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" className="rounded-sm">
          Update status
        </Button>
        <ActionError state={stStatus} />
      </form>
    </li>
  );
}

function LineItemEditor({
  quoteId,
  line,
  isSent,
  workTemplates,
  canManageWorkTemplates,
}: {
  quoteId: string;
  line: QuoteWorkspaceProps["quote"]["lineItems"][number];
  isSent: boolean;
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
}) {
  const [st, action] = useActionState(updateQuoteLineItem, undefined);
  const [rmSt, rmAction] = useActionState(markQuoteLineRemoved, undefined);
  if (isSent) {
    return (
      <div className="rounded-sm border border-border p-4 opacity-80">
        <p className="font-medium text-foreground">{line.title}</p>
        <p className="text-xs text-muted-foreground">{line.lineMode}</p>
      </div>
    );
  }
  return (
    <div className="rounded-sm border border-border p-4">
      {line.sourceTemplateName ? (
        <p className="mb-3 text-[11px] text-muted-foreground">
          Inserted from template: <span className="font-medium text-foreground/90">{line.sourceTemplateName}</span>
          {line.sourceTemplateVersion != null ? ` (v${line.sourceTemplateVersion})` : null}
        </p>
      ) : null}
      <div className="mb-3 flex justify-end">
        <SaveWorkTemplateDialog
          quoteId={quoteId}
          saveKind="line"
          lineItemId={line.id}
          defaultName={line.title}
          trigger={
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-sm text-xs text-muted-foreground">
              Save line as template
            </Button>
          }
        />
      </div>
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="lineItemId" value={line.id} />
        <div className="space-y-2 md:col-span-2">
          <Label>Title</Label>
          <Input name="title" defaultValue={line.title} required className="rounded-sm" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Customer description</Label>
          <Textarea name="customerDescription" defaultValue={line.customerDescription} required rows={2} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input name="quantity" defaultValue={line.quantity} required className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label>Unit price (cents)</Label>
          <Input name="unitPriceCents" type="number" min={0} defaultValue={line.unitPriceCents ?? ""} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label>Pricing mode</Label>
          <select name="pricingMode" defaultValue={line.pricingMode} className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm">
            {Object.values(PricingMode).map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Line mode</Label>
          <select name="lineMode" defaultValue={line.lineMode} className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm">
            {Object.values(QuoteLineMode).map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Internal notes</Label>
          <Textarea name="internalNotes" defaultValue={line.internalNotes ?? ""} rows={2} className="rounded-sm" />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" size="sm" className="rounded-sm">
            Save line
          </Button>
        </div>
        <ActionError state={st} />
      </form>
      {line.lineMode !== QuoteLineMode.REMOVED ? (
        <LineItemExecutionPlanning
          quoteId={quoteId}
          line={line}
          workTemplates={workTemplates}
          canManageWorkTemplates={canManageWorkTemplates}
        />
      ) : null}
      {line.lineMode !== QuoteLineMode.REMOVED ? (
        <form action={rmAction} className="mt-2">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="lineItemId" value={line.id} />
          <Button type="submit" size="sm" variant="outline" className="rounded-sm">
            Mark removed
          </Button>
        </form>
      ) : null}
      <ActionError state={rmSt} />
    </div>
  );
}

function QuotePrepSection({
  quoteId,
  tasks,
  isSent,
}: {
  quoteId: string;
  tasks: QuoteWorkspaceProps["quote"]["tasks"];
  isSent: boolean;
}) {
  const prep = tasks;
  const [addSt, addAct] = useActionState(addQuoteTask, undefined);
  return (
    <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <h2 className="text-sm font-semibold text-foreground">Quote-prep / internal review</h2>
      <p className="text-xs text-muted-foreground">Sales and estimator tasks only—not field runtime work.</p>
      {prep.length === 0 ? (
        <p className="rounded-sm border border-dashed border-border bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
          No quote-prep tasks. Add margin review, manager approval, or other internal gates as needed.
        </p>
      ) : (
        <ul className="space-y-4">
          {prep.map((t) => (
            <QuoteTaskEditor key={t.id} quoteId={quoteId} task={t} isSent={isSent} />
          ))}
        </ul>
      )}
      {!isSent ? (
        <>
          <Separator />
          <form action={addAct} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="quoteId" value={quoteId} />
            <div className="space-y-2 md:col-span-2">
              <Label>Title</Label>
              <Input name="title" required className="rounded-sm" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea name="description" rows={2} className="rounded-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
              <input type="checkbox" name="isRequired" />
              Required before send
            </label>
            <Button type="submit" className="rounded-sm md:col-span-2">
              Add quote-prep task
            </Button>
            <ActionError state={addSt} />
          </form>
        </>
      ) : null}
    </section>
  );
}

function QuoteTaskEditor({
  quoteId,
  task,
  isSent,
}: {
  quoteId: string;
  task: QuoteWorkspaceProps["quote"]["tasks"][number];
  isSent: boolean;
}) {
  const [st, act] = useActionState(updateQuoteTask, undefined);
  const [stStatus, actStatus] = useActionState(updateQuoteTaskStatus, undefined);
  if (isSent) {
    return (
      <li className="rounded-sm border border-border p-3">
        <p className="font-medium text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">Quote prep</p>
      </li>
    );
  }
  return (
    <li className="rounded-sm border border-border p-3">
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="taskId" value={task.id} />
        <div className="space-y-2 md:col-span-2">
          <Label>Title</Label>
          <Input name="title" defaultValue={task.title} required className="rounded-sm" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Description</Label>
          <Textarea name="description" defaultValue={task.description ?? ""} rows={2} className="rounded-sm" />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="isRequired" defaultChecked={task.isRequired} />
          Required
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
          <input type="checkbox" name="customerVisible" defaultChecked={task.customerVisible} />
          Customer-visible
        </label>
        <div className="space-y-2 md:col-span-2">
          <Label>Customer label</Label>
          <Input name="customerLabel" defaultValue={task.customerLabel ?? ""} className="rounded-sm" />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Internal notes</Label>
          <Textarea name="internalNotes" defaultValue={task.internalNotes ?? ""} rows={2} className="rounded-sm" />
        </div>
        <Button type="submit" size="sm" className="rounded-sm md:col-span-2">
          Save task
        </Button>
        <ActionError state={st} />
      </form>
      <form action={actStatus} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="taskId" value={task.id} />
        <Label className="text-xs text-muted-foreground">Status</Label>
        <select name="status" defaultValue={task.status} className="h-9 rounded-sm border border-input bg-background px-2 text-sm">
          {Object.values(QuoteTaskStatus).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" className="rounded-sm">
          Update status
        </Button>
        <ActionError state={stStatus} />
      </form>
    </li>
  );
}

function AssumptionsSection({
  quoteId,
  lines,
  assumptions,
  isSent,
}: {
  quoteId: string;
  lines: QuoteWorkspaceProps["quote"]["lineItems"];
  assumptions: QuoteWorkspaceProps["quote"]["assumptions"];
  isSent: boolean;
}) {
  const [addSt, addAct] = useActionState(addQuoteAssumption, undefined);
  return (
    <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <h2 className="text-sm font-semibold text-foreground">Assumptions</h2>
      {assumptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assumptions recorded.</p>
      ) : (
        <ul className="space-y-4">
          {assumptions.map((a) => (
            <AssumptionRow key={a.id} quoteId={quoteId} lines={lines} a={a} isSent={isSent} />
          ))}
        </ul>
      )}
      {!isSent ? (
        <>
          <Separator />
          <form action={addAct} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="quoteId" value={quoteId} />
            <div className="space-y-2 md:col-span-2">
              <Label>Text</Label>
              <Textarea name="text" required rows={2} className="rounded-sm" />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <select name="visibility" className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm" defaultValue={QuoteAssumptionVisibility.CUSTOMER_VISIBLE}>
                {Object.values(QuoteAssumptionVisibility).map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Line (optional)</Label>
              <select name="quoteLineItemId" className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm" defaultValue="">
                <option value="">Quote-level</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="rounded-sm md:col-span-2">
              Add assumption
            </Button>
            <ActionError state={addSt} />
          </form>
        </>
      ) : null}
    </section>
  );
}

function AssumptionRow({
  quoteId,
  lines,
  a,
  isSent,
}: {
  quoteId: string;
  lines: QuoteWorkspaceProps["quote"]["lineItems"];
  a: QuoteWorkspaceProps["quote"]["assumptions"][number];
  isSent: boolean;
}) {
  const [st, act] = useActionState(updateQuoteAssumption, undefined);
  const [rm, rmAct] = useActionState(removeQuoteAssumption, undefined);
  if (isSent) {
    return (
      <li className="rounded-sm border border-border p-3 text-sm">
        <span className="text-xs font-semibold uppercase text-muted-foreground">{a.visibility.replace(/_/g, " ")}</span>
        <p className="mt-1 text-foreground">{a.text}</p>
      </li>
    );
  }
  return (
    <li className="rounded-sm border border-border p-3">
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="assumptionId" value={a.id} />
        <div className="space-y-2 md:col-span-2">
          <Label>Text</Label>
          <Textarea name="text" defaultValue={a.text} required rows={2} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label>Visibility</Label>
          <select name="visibility" defaultValue={a.visibility} className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm">
            {Object.values(QuoteAssumptionVisibility).map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Line</Label>
          <select name="quoteLineItemId" defaultValue={a.quoteLineItemId ?? ""} className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm">
            <option value="">Quote-level</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" size="sm" className="rounded-sm">
            Save
          </Button>
        </div>
        <ActionError state={st} />
      </form>
      <form action={rmAct} className="mt-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="assumptionId" value={a.id} />
        <Button type="submit" size="sm" variant="outline" className="rounded-sm">
          Remove
        </Button>
        <ActionError state={rm} />
      </form>
    </li>
  );
}
