"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CustomerContactType,
  JobStatus,
  PricingMode,
  QuoteAssumptionVisibility,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskStatus,
  QuoteWorkTemplateKind,
} from "@prisma/client";
import type { QuoteSendReadinessItem } from "@/server/phase2/quote-readiness";
import type { QuoteCustomerPreviewDTO, QuotePreviewWorkspaceResolution } from "@/server/phase2/customer-preview";
import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";
import type { QuoteActionResult } from "@/server/phase2/quote-mutations";
import {
  addQuoteAssumption,
  addQuoteLineExecutionStage,
  addQuoteLineExecutionTask,
  addQuoteLineItem,
  addQuoteTask,
  logQuotePreviewed,
  markQuoteLineRemoved,
  activateAcceptedQuoteAsJob,
  markQuoteAccepted,
  markQuoteReadyToSend,
  markQuoteSent,
  removeQuoteAssumption,
  removeQuoteLineExecutionStage,
  updateQuote,
  updateQuoteDraftBasics,
  updateQuoteDraftProposal,
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
import { StaffPortalLinkPanel } from "@/components/customer-portal/staff-portal-link-panel";
import {
  StaffCustomerPortalSubmissionsPanel,
  type StaffEvidencePromotionContext,
  type StaffPortalSubmissionListItem,
} from "@/components/customer-portal/staff-customer-portal-submissions-panel";
import { formatContactType, formatQuoteStatus } from "@/lib/format-enums";
import { isQuoteStructurallyLocked } from "@/lib/quote-lifecycle";
import {
  SaveWorkTemplateDialog,
  WorkTemplateInsertDialog,
  type WorkTemplatesBundleDTO,
} from "@/app/(app)/app/sales/quotes/[quoteId]/quote-work-template-ui";
import type { QuoteWorkbenchStep } from "./quote-workbench-ui";
import {
  QuoteWorkbenchCanvas,
  QuoteWorkbenchCommandBar,
  QuoteWorkbenchIntelligencePanel,
  QuoteWorkbenchMobileSteps,
  QuoteWorkbenchPanelFrame,
  QuoteWorkbenchStepRail,
  quoteWorkbenchInputClass,
  quoteWorkbenchSelectClass,
  quoteWorkbenchTextareaClass,
} from "./quote-workbench-ui";

export type QuoteWorkspaceDefaultSection = QuoteWorkbenchStep;

function fmtMoney(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function clipText(s: string | null | undefined, max: number) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function ActionError({ state }: { state: QuoteActionResult | undefined }) {
  if (!state || state.ok) return null;
  return (
    <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
      {state.error}
    </p>
  );
}

function PlannedTaskEvidenceRequirementFields({
  completionRequirement,
}: {
  completionRequirement?: CompletionRequirementDto;
}) {
  const active = completionRequirement?.state === "active";
  const min = completionRequirement?.state === "active" ? completionRequirement.minAcceptedCount : 1;
  const allowJob = completionRequirement?.state === "active" ? completionRequirement.allowJobLevelEvidence : false;
  return (
    <div className="space-y-2 rounded-[5px] border border-border dark:border-zinc-800/60 bg-muted/40 dark:bg-zinc-950/40 p-2 md:col-span-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">After-sale completion gate</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">
        Planned for job execution after the quote is sold. Accepted evidence is enforced when completing the runtime task
        (Phase 13 gate). Not shown on the customer-facing quote preview unless this task is customer-visible with a label
        for highlights only.
      </p>
      {completionRequirement?.state === "invalid" ? (
        <p className="text-[11px] text-amber-800 dark:text-amber-400" role="status">
          Stored requirement is invalid: {completionRequirement.message}. Clear the toggle and save to remove it, or set
          valid values.
        </p>
      ) : null}
      <label className="flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400">
        <input type="checkbox" name="evidenceRequired" defaultChecked={active} />
        Require accepted evidence before this task can be completed on the job
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Minimum accepted evidence</Label>
          <Input
            type="number"
            name="minAcceptedEvidenceCount"
            min={1}
            max={10}
            defaultValue={min}
            className={quoteWorkbenchInputClass()}
          />
        </div>
        <label className="flex items-end gap-2 pb-1 text-xs text-muted-foreground dark:text-zinc-400">
          <input type="checkbox" name="allowJobLevelEvidence" defaultChecked={allowJob} />
          Allow job-level accepted evidence to count
        </label>
      </div>
    </div>
  );
}

function PlannedTaskEvidenceReadOnly({ dto }: { dto: CompletionRequirementDto }) {
  if (dto.state === "none") {
    return (
      <p className="text-[11px] text-muted-foreground dark:text-zinc-500">No accepted-evidence completion gate for this planned task.</p>
    );
  }
  if (dto.state === "invalid") {
    return <p className="text-[11px] text-amber-800 dark:text-amber-400">Invalid stored requirement: {dto.message}</p>;
  }
  return (
    <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
      After activation, {dto.minAcceptedCount} accepted evidence record(s) required before this runtime task can be
      completed.
      {dto.allowJobLevelEvidence ? " Job-level accepted evidence may count." : ""} Internal only.
    </p>
  );
}

function ReadinessRow({ item }: { item: QuoteSendReadinessItem }) {
  const isFail = item.severity === "BLOCKER" && item.status === "FAIL";
  const isWarn = item.severity === "WARNING" && item.status !== "PASS";
  const tone = isFail
    ? "text-destructive dark:text-red-300"
    : isWarn
      ? "text-amber-800 dark:text-amber-300/90"
      : "text-muted-foreground dark:text-zinc-500";
  return (
    <li
      className={`flex flex-col gap-2 rounded-[5px] border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
        isFail
          ? "border-destructive/30 bg-destructive/10 dark:border-red-500/25 dark:bg-red-950/20"
          : isWarn
            ? "border-amber-500/50 bg-amber-500/10 dark:border-amber-500/20 dark:bg-amber-950/10"
            : "border-border bg-muted/30 dark:border-zinc-800/50 dark:bg-zinc-950/30"
      }`}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground dark:text-zinc-100">{item.label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">{item.explanation}</p>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
          {item.fixLocation} · {item.severity}
        </p>
      </div>
      <span className={`shrink-0 font-mono text-[10px] font-semibold uppercase ${tone}`}>{item.status.replace(/_/g, " ")}</span>
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
    startTransition(() => {
      void action(fd);
    });
  }, [action, quoteId]);
  return <ActionError state={state} />;
}

export type QuoteWorkspaceProps = {
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
          completionRequirement: CompletionRequirementDto;
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
    acceptedAt: string | null;
    activatedAt: string | null;
    job: { id: string; displayNumber: number; status: JobStatus } | null;
  };
  readiness: QuoteSendReadinessItem[];
  sendBlocked: boolean;
  warningCount: number;
  activity: { id: string; eventType: string; summary: string; createdAt: string }[];
  members: { id: string; label: string }[];
  previewResolution: QuotePreviewWorkspaceResolution;
  workTemplates: WorkTemplatesBundleDTO;
  canManageWorkTemplates: boolean;
  customerPortal: {
    showSection: boolean;
    hasActiveToken: boolean;
    lastViewedAt: string | null;
    canCreateLink: boolean;
    canRevokeRegenerateLink: boolean;
  };
  customerPortalSubmissions?: {
    items: StaffPortalSubmissionListItem[];
    newCount: number;
    canView: boolean;
    canManage: boolean;
    canManageJobEvidence?: boolean;
    evidencePromotion?: StaffEvidencePromotionContext;
  };
  defaultExpandedSection: QuoteWorkspaceDefaultSection;
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
    customerPortal,
    customerPortalSubmissions,
    defaultExpandedSection,
  } = props;
  /** True after send through activation: quote structure and commercial snapshot are frozen here. */
  const isSent = isQuoteStructurallyLocked(quote.status);
  const preview = previewResolution.kind === "SENT_SNAPSHOT_MISSING" ? null : previewResolution.preview;
  const snapshotIntegrityError = previewResolution.kind === "SENT_SNAPSHOT_MISSING";
  const [headerState, headerAction] = useActionState(updateQuote, undefined);
  const [basicsState, basicsAction] = useActionState(updateQuoteDraftBasics, undefined);
  const [proposalState, proposalAction] = useActionState(updateQuoteDraftProposal, undefined);
  const [readyState, readyAction] = useActionState(markQuoteReadyToSend, undefined);
  const [sentState, sentAction] = useActionState(markQuoteSent, undefined);
  const [acceptState, acceptAction] = useActionState(markQuoteAccepted, undefined);
  const [activateState, activateAction] = useActionState(activateAcceptedQuoteAsJob, undefined);

  const headline = sendBlocked
    ? "Send blocked — resolve checklist blockers"
    : warningCount > 0
      ? "Ready to proceed with warnings — review checklist"
      : "Send readiness satisfied";

  const activeLines = quote.lineItems.filter((l) => l.lineMode !== QuoteLineMode.REMOVED);
  let stageCount = 0;
  let lineExecTaskCount = 0;
  for (const l of activeLines) {
    for (const s of l.executionStages) {
      stageCount += 1;
      lineExecTaskCount += s.tasks.length;
    }
  }
  const prepTaskCount = quote.tasks.length;
  const blockers = readiness.filter((i) => i.severity === "BLOCKER" && i.status === "FAIL");
  const firstBlocker = blockers[0];
  const nextActionLine = firstBlocker
    ? `Next: ${firstBlocker.label} — ${clipText(firstBlocker.explanation, 120)}`
    : warningCount > 0
      ? `Next: Review ${warningCount} readiness warning(s) before send.`
      : "Next: Review proposal preview and line totals, then mark ready to send.";

  const linePricingIssues = readiness.some(
    (i) => i.key === "line_price_fixed" && i.status === "FAIL",
  );
  const lineTitleIssues = readiness.some((i) => i.key === "line_title" && i.status === "FAIL");

  const proposalHasText = Boolean((quote.scopeSummary ?? "").trim() || (quote.customerFacingIntro ?? "").trim());
  const basicsNeedAttention = !quote.title.trim() || !quote.scopeIntent.trim();
  const addressIncomplete = !quote.serviceAddressTbd && !(quote.serviceAddressText ?? "").trim();
  const prepReadinessFail = readiness.some((i) => i.key === "quote_prep_required" && i.status === "FAIL");
  const readinessTone = sendBlocked ? "block" : warningCount > 0 ? "warn" : "ok";

  const [step, setStep] = useState<QuoteWorkbenchStep>(defaultExpandedSection);
  useEffect(() => {
    setStep(defaultExpandedSection);
  }, [quote.id, defaultExpandedSection]);

  const stepCounts: Partial<Record<QuoteWorkbenchStep, string | number>> = {
    lines: activeLines.length,
    execution: prepTaskCount,
    activity: activity.length,
    ...(blockers.length > 0 ? { readiness: blockers.length } : {}),
  };

  const stepFlags: Partial<Record<QuoteWorkbenchStep, "attention" | "ok" | "muted">> = {
    basics: basicsNeedAttention || addressIncomplete ? "attention" : "ok",
    lines: activeLines.length === 0 || linePricingIssues || lineTitleIssues ? "attention" : "ok",
    execution: prepReadinessFail ? "attention" : "ok",
    readiness: sendBlocked ? "attention" : "ok",
    proposal: proposalHasText ? "ok" : "muted",
    activity: "muted",
  };

  const intelPanel = (
    <QuoteWorkbenchIntelligencePanel
      total={fmtMoney(quote.totalCents)}
      subtotal={fmtMoney(quote.pricingSubtotalCents)}
      status={formatQuoteStatus(quote.status)}
      readinessOk={!sendBlocked}
      lineCount={activeLines.length}
      stageCount={stageCount}
      lineTaskCount={lineExecTaskCount}
      prepCount={prepTaskCount}
      blockerCount={blockers.length}
      nextAction={nextActionLine}
      onJumpProposal={() => setStep("proposal")}
    />
  );

  const primaryActions = !isSent ? (
    <>
      <form action={readyAction} className="inline">
        <input type="hidden" name="quoteId" value={quote.id} />
        <Button
          type="submit"
          variant="secondary"
          disabled={sendBlocked}
          className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground hover:bg-secondary/80 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700/80 disabled:opacity-40"
        >
          Mark ready to send
        </Button>
      </form>
      <form action={sentAction} className="inline">
        <input type="hidden" name="quoteId" value={quote.id} />
        <Button
          type="submit"
          disabled={sendBlocked}
          className="h-8 rounded-[5px] bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          Mark sent
        </Button>
      </form>
    </>
  ) : null;

  const sentLifecycle = isSent ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
        Sent {quote.sentAt ? new Date(quote.sentAt).toLocaleString() : ""}. Scope frozen — internal notes in Basics.
      </p>
      {quote.status === QuoteStatus.SENT ? (
        <form action={acceptAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="quoteId" value={quote.id} />
          <Button type="submit" variant="secondary" className="h-8 rounded-[5px] text-xs">
            Mark accepted
          </Button>
        </form>
      ) : null}
      {quote.status === QuoteStatus.ACCEPTED && !quote.job ? (
        <form action={activateAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="quoteId" value={quote.id} />
          <Button type="submit" className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90">
            Create job
          </Button>
        </form>
      ) : null}
      {quote.job ? (
        <Link href={`/app/jobs/${quote.job.id}`} className="text-xs font-medium text-primary hover:text-primary/80 dark:text-blue-400 dark:hover:text-blue-300">
          Open job #{quote.job.displayNumber}
        </Link>
      ) : null}
    </div>
  ) : null;

  const actionErrors = (
    <div className="flex flex-col gap-1">
      <ActionError state={readyState} />
      <ActionError state={sentState} />
      <ActionError state={acceptState} />
      <ActionError state={activateState} />
    </div>
  );

  return (
    <QuoteWorkbenchCanvas>
      <QuoteWorkbenchCommandBar
        salesHref="/app/sales"
        quoteTitle={quote.title}
        displayNumber={quote.displayNumber}
        statusLabel={formatQuoteStatus(quote.status)}
        customerName={quote.customer.displayName}
        opportunityTitle={quote.opportunity.title}
        serviceType={quote.opportunity.serviceType}
        totalLabel={fmtMoney(quote.totalCents)}
        readinessHeadline={headline}
        readinessTone={readinessTone}
        nextAction={nextActionLine}
        isSent={isSent}
        primaryActions={primaryActions}
        sentLifecycle={sentLifecycle}
        actionErrors={actionErrors}
      />
      <div className="mt-4 min-w-0 max-w-full lg:hidden">{intelPanel}</div>
      <QuoteWorkbenchMobileSteps active={step} onSelect={setStep} />
      <div className="mt-4 grid min-w-0 max-w-full gap-5 lg:mt-6 lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,15.5rem)] lg:items-start lg:gap-6">
        <aside className="hidden min-w-0 lg:block lg:pr-1">
          <QuoteWorkbenchStepRail active={step} onSelect={setStep} counts={stepCounts} flags={stepFlags} />
        </aside>
        <main className="min-h-[min(70vh,640px)] min-w-0 border-t border-border pt-5 dark:border-zinc-800/50 lg:border-t-0 lg:pt-1">
          {step === "basics" ? (
            <QuoteWorkbenchPanelFrame
              kicker="Setup"
              title="Quote basics"
              subtitle="Identity, internal scope intent, service location, pipeline, owner. Internal notes stay low-noise."
            >
              <div className="rounded-[5px] border border-border dark:border-zinc-800/60 bg-muted/40 dark:bg-zinc-950/40 p-3 text-xs text-muted-foreground dark:text-zinc-400">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Context</p>
                <p className="mt-1 text-sm text-foreground dark:text-zinc-200">{quote.customer.displayName}</p>
                <div className="mt-2">
                  {quote.customer.contacts.length === 0 ? (
                    <p>No active contacts — add on the customer record.</p>
                  ) : (
                    <ul className="space-y-1">
                      {quote.customer.contacts.map((c) => (
                        <li key={c.id}>
                          {formatContactType(c.type as CustomerContactType)}: {c.value}
                          {c.label ? ` (${c.label})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="mt-2 text-muted-foreground dark:text-zinc-500">
                  <span className="text-foreground/90 dark:text-zinc-300">{quote.opportunity.title}</span> · {quote.opportunity.serviceType}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 font-medium text-primary dark:text-blue-400">
                  <Link href={`/app/customers/${quote.customer.id}`} className="hover:text-primary/80 dark:hover:text-blue-300">
                    Customer
                  </Link>
                  <Link href={`/app/sales/opportunities/${quote.opportunity.id}`} className="hover:text-primary/80 dark:hover:text-blue-300">
                    Opportunity
                  </Link>
                </div>
              </div>
              {isSent ? (
                <form action={headerAction} className="grid max-w-2xl gap-3">
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor="q-internal-frozen" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Internal notes
                    </Label>
                    <Textarea
                      id="q-internal-frozen"
                      name="internalNotes"
                      defaultValue={quote.internalNotes ?? ""}
                      rows={4}
                      className={quoteWorkbenchTextareaClass()}
                    />
                    <Button type="submit" size="sm" className="h-8 w-fit rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90">
                      Save internal notes
                    </Button>
                  </div>
                  <ActionError state={headerState} />
                </form>
              ) : (
                <form action={basicsAction} className="grid max-w-2xl gap-3 md:grid-cols-2">
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="q-title" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Title
                    </Label>
                    <Input id="q-title" name="title" defaultValue={quote.title} required className={quoteWorkbenchInputClass()} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="q-scope" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Internal scope intent
                    </Label>
                    <Textarea
                      id="q-scope"
                      name="scopeIntent"
                      defaultValue={quote.scopeIntent}
                      required
                      rows={2}
                      className={quoteWorkbenchTextareaClass()}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="q-addr" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Service address
                    </Label>
                    <Textarea
                      id="q-addr"
                      name="serviceAddressText"
                      defaultValue={quote.serviceAddressText ?? ""}
                      rows={2}
                      className={quoteWorkbenchTextareaClass()}
                    />
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground dark:text-zinc-500">
                      <input type="checkbox" name="serviceAddressTbd" value="true" defaultChecked={quote.serviceAddressTbd} />
                      Location not yet determined
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-owner" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Owner
                    </Label>
                    <select
                      id="q-owner"
                      name="ownerUserId"
                      defaultValue={quote.ownerUserId ?? ""}
                      className={quoteWorkbenchSelectClass() + " w-full"}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-status" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Pipeline
                    </Label>
                    <select
                      id="q-status"
                      name="status"
                      defaultValue={quote.status}
                      className={quoteWorkbenchSelectClass() + " w-full"}
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
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="q-internal" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Internal notes
                    </Label>
                    <Textarea
                      id="q-internal"
                      name="internalNotes"
                      defaultValue={quote.internalNotes ?? ""}
                      rows={2}
                      className={quoteWorkbenchTextareaClass()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" size="sm" className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90">
                      Save basics
                    </Button>
                  </div>
                  <ActionError state={basicsState} />
                </form>
              )}
            </QuoteWorkbenchPanelFrame>
          ) : null}

          {step === "proposal" ? (
            <QuoteWorkbenchPanelFrame
              kicker="Customer-facing"
              title="Proposal content"
              subtitle="These fields shape the internal customer preview — not a live portal."
            >
              {!isSent ? (
                <form action={proposalAction} className="grid max-w-2xl gap-3">
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor="q-sum" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Scope summary (optional)
                    </Label>
                    <Textarea
                      id="q-sum"
                      name="scopeSummary"
                      defaultValue={quote.scopeSummary ?? ""}
                      rows={2}
                      className={quoteWorkbenchTextareaClass()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="q-intro" className="text-[11px] text-muted-foreground dark:text-zinc-500">
                      Customer-facing intro (optional)
                    </Label>
                    <Textarea
                      id="q-intro"
                      name="customerFacingIntro"
                      defaultValue={quote.customerFacingIntro ?? ""}
                      rows={2}
                      className={quoteWorkbenchTextareaClass()}
                    />
                  </div>
                  <Button type="submit" size="sm" className="h-8 w-fit rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90">
                    Save proposal
                  </Button>
                  <ActionError state={proposalState} />
                </form>
              ) : (
                <p className="text-sm text-muted-foreground dark:text-zinc-500">Proposal copy is frozen after send.</p>
              )}
              <AssumptionsSection quoteId={quote.id} lines={quote.lineItems} assumptions={quote.assumptions} isSent={isSent} />
              <div className="space-y-2 rounded-[5px] border border-primary/20 bg-primary/[0.06] p-4 dark:border-blue-500/25 dark:bg-blue-950/20">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-300/90">
                  Internal preview
                </h3>
                {snapshotIntegrityError ? (
                  <div
                    className="rounded-[5px] border border-amber-600/50 bg-amber-500/10 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100"
                    role="status"
                  >
                    <p className="font-medium">Sent snapshot integrity issue</p>
                    <p className="mt-1 text-xs text-amber-900 dark:text-amber-200/80">Frozen snapshot missing or invalid — live rebuild not shown.</p>
                  </div>
                ) : (
                  <>
                    <PreviewLogger quoteId={quote.id} />
                    {preview ? <PreviewBody preview={preview} /> : <p className="text-sm text-muted-foreground dark:text-zinc-500">No preview data.</p>}
                  </>
                )}
              </div>
            </QuoteWorkbenchPanelFrame>
          ) : null}

          {step === "lines" ? (
            <QuoteWorkbenchPanelFrame
              kicker="Commercial"
              title="Line items"
              subtitle="What the customer is buying — pricing and descriptions. Execution planning lives under each line."
            >
              <LineItemsSection
                quoteId={quote.id}
                lines={quote.lineItems}
                isSent={isSent}
                workTemplates={workTemplates}
                canManageWorkTemplates={canManageWorkTemplates}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border dark:border-zinc-800/50 pt-4 font-mono text-sm">
                <span className="text-muted-foreground dark:text-zinc-500">Roll-up</span>
                <span className="text-foreground dark:text-zinc-200">
                  Subtotal <span className="tabular-nums text-foreground dark:text-white">{fmtMoney(quote.pricingSubtotalCents)}</span>
                  <span className="mx-2 text-border dark:text-zinc-700">|</span>
                  Total <span className="tabular-nums text-primary dark:text-blue-300">{fmtMoney(quote.totalCents)}</span>
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground dark:text-zinc-600">Non-fixed modes are labeled on each line and in preview.</p>
            </QuoteWorkbenchPanelFrame>
          ) : null}

          {step === "execution" ? (
            <QuoteWorkbenchPanelFrame
              kicker="Internal · Before send"
              title="Quote-prep work"
              subtitle="Sales / estimator checklist — not purchased line work. Line-level stages and tasks are edited under each commercial line."
            >
              <QuotePrepSection quoteId={quote.id} tasks={quote.tasks} isSent={isSent} />
            </QuoteWorkbenchPanelFrame>
          ) : null}

          {step === "readiness" ? (
            <QuoteWorkbenchPanelFrame
              kicker="Server checklist"
              title="Readiness & send"
              subtitle="Computed on the server. Blockers disable Mark ready and Mark sent."
            >
              {firstBlocker ? (
                <div className="mb-4 rounded-[5px] border border-destructive/30 bg-destructive/5 px-3 py-2.5 dark:border-red-500/30 dark:bg-red-950/25">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive dark:text-red-300/90">Top blocker</p>
                  <p className="mt-0.5 text-sm font-medium text-destructive-foreground dark:text-red-100">{firstBlocker.label}</p>
                  <p className="mt-1 text-xs text-destructive/90 dark:text-red-200/80">{firstBlocker.explanation}</p>
                </div>
              ) : null}
              {!isSent ? (
                <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border dark:border-zinc-800/50 pb-4">
                  <form action={readyAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      disabled={sendBlocked}
                      className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground disabled:opacity-40 dark:border-zinc-600/60 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      Mark ready to send
                    </Button>
                  </form>
                  <form action={sentAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={sendBlocked}
                      className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    >
                      Mark sent
                    </Button>
                  </form>
                  {sendBlocked ? (
                    <span className="text-[11px] text-muted-foreground dark:text-zinc-500">Disabled until checklist passes.</span>
                  ) : null}
                </div>
              ) : null}
              <ul className="space-y-2">
                {readiness.map((r) => (
                  <ReadinessRow key={r.key} item={r} />
                ))}
              </ul>
            </QuoteWorkbenchPanelFrame>
          ) : null}

          {step === "activity" ? (
            <QuoteWorkbenchPanelFrame kicker="Audit" title="Activity" subtitle="Events recorded for this quote workspace.">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground dark:text-zinc-500">No events yet.</p>
              ) : (
                <ul className="divide-y divide-border dark:divide-zinc-800/60">
                  {activity.map((e) => (
                    <li key={e.id} className="py-3 first:pt-0">
                      <div className="flex flex-wrap justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                        <span>{e.eventType.replace(/_/g, " ")}</span>
                        <time className="font-mono text-muted-foreground dark:text-zinc-500">{new Date(e.createdAt).toLocaleString()}</time>
                      </div>
                      <p className="mt-1 text-sm text-foreground dark:text-zinc-200">{e.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </QuoteWorkbenchPanelFrame>
          ) : null}
        </main>
        <aside className="hidden min-w-0 lg:block">{intelPanel}</aside>
      </div>

      <div className="mt-10 space-y-6 border-t border-border dark:border-zinc-800/40 pt-8">
        {customerPortal.showSection ? (
          <StaffPortalLinkPanel
            quoteId={quote.id}
            hasActiveToken={customerPortal.hasActiveToken}
            lastViewedAt={customerPortal.lastViewedAt}
            canCreateLink={customerPortal.canCreateLink}
            canRevokeRegenerateLink={customerPortal.canRevokeRegenerateLink}
          />
        ) : null}
        {customerPortalSubmissions?.canView ? (
          <StaffCustomerPortalSubmissionsPanel
            newCount={customerPortalSubmissions.newCount}
            submissions={customerPortalSubmissions.items}
            canManage={customerPortalSubmissions.canManage}
            canManageJobEvidence={customerPortalSubmissions.canManageJobEvidence ?? false}
            evidencePromotion={customerPortalSubmissions.evidencePromotion}
          />
        ) : null}
      </div>
    </QuoteWorkbenchCanvas>
  );
}

function PreviewBody({ preview }: { preview: QuoteCustomerPreviewDTO }) {
  return (
    <div className="space-y-4 rounded-[5px] border border-border bg-card p-4 text-sm text-card-foreground dark:border-zinc-800/60 dark:bg-zinc-950">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-zinc-600">{preview.organizationName}</p>
      <p className="text-base font-semibold tracking-tight text-foreground dark:text-white">
        {preview.quoteTitle} · #{preview.displayNumber}
      </p>
      <p className="text-xs text-muted-foreground dark:text-zinc-500">{preview.customerDisplayName}</p>
      <Separator className="bg-border dark:bg-zinc-800/80" />
      <p className="text-xs text-foreground/90 dark:text-zinc-300">{preview.serviceAddressSummary}</p>
      {preview.scopeSummary ? <p className="text-xs text-muted-foreground dark:text-zinc-500">{preview.scopeSummary}</p> : null}
      {preview.customerFacingIntro ? <p className="text-sm leading-relaxed text-foreground dark:text-zinc-200">{preview.customerFacingIntro}</p> : null}
      <ul className="space-y-2">
        {preview.lineItems.map((l, i) => (
          <li key={i} className="rounded-[5px] border border-border dark:border-zinc-800/70 bg-muted/40 dark:bg-zinc-950/50 p-3">
            <p className="text-sm font-medium text-foreground dark:text-white">{l.title}</p>
            <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-500">{l.customerDescription}</p>
            <p className="mt-2 font-mono text-[11px] text-primary dark:text-blue-300/90">
              Qty {l.quantityDisplay} · {l.pricingPresentation}
            </p>
            {l.customerVisibleAssumptions.length ? (
              <ul className="mt-2 list-disc pl-4 text-[11px] text-muted-foreground dark:text-zinc-500">
                {l.customerVisibleAssumptions.map((a, j) => (
                  <li key={j}>{a}</li>
                ))}
              </ul>
            ) : null}
            {(l.customerVisibleExecutionHighlights ?? []).length ? (
              <div className="mt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Customer-visible milestones</p>
                <ul className="mt-1 list-disc pl-4 text-[11px] text-muted-foreground dark:text-zinc-500">
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
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Assumptions</p>
          <ul className="list-disc pl-4 text-xs text-muted-foreground dark:text-zinc-500">
            {preview.customerVisibleQuoteAssumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {preview.plannedCustomerHighlights.length ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Customer-visible milestones (legacy)</p>
          <ul className="list-disc pl-4 text-xs text-muted-foreground dark:text-zinc-500">
            {preview.plannedCustomerHighlights.map((m, i) => (
              <li key={i}>{m.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="font-mono text-[10px] text-muted-foreground dark:text-zinc-600">
        {preview.statusLabel} · {new Date(preview.asOf).toLocaleString()}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground dark:text-zinc-600">
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
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
        Commercial lines define what the customer is buying. Stages and tasks for delivery live under each line in the
        execution plan panel.
      </p>
      {lines.length === 0 ? (
        <p className="rounded-[5px] border border-dashed border-border dark:border-zinc-700/60 bg-muted/30 dark:bg-zinc-950/30 px-4 py-6 text-sm text-muted-foreground dark:text-zinc-500">
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
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">Add line item</h3>
            <WorkTemplateInsertDialog
              quoteId={quoteId}
              insertKind="line"
              items={workTemplates.line}
              canManageTemplates={canManageWorkTemplates}
              title="Insert line from template"
              emptyTitle="No line templates yet"
              emptyBody="Save an existing line (with its execution plan) as a template, then insert it here as editable quote-owned work."
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-[5px] border-input dark:border-zinc-700/80 bg-transparent text-[11px] text-foreground/90 dark:text-zinc-300 hover:bg-muted/80 dark:hover:bg-zinc-900/80"
                >
                  Add from template
                </Button>
              }
            />
          </div>
          <form action={addAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="quoteId" value={quoteId} />
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Title</Label>
              <Input name="title" required className={quoteWorkbenchInputClass()} placeholder="e.g. Install EV charger" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Customer description</Label>
              <Textarea name="customerDescription" required rows={2} className={quoteWorkbenchTextareaClass()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Quantity</Label>
              <Input name="quantity" defaultValue="1" required className={quoteWorkbenchInputClass()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Unit price (cents)</Label>
              <Input name="unitPriceCents" type="number" min={0} className={quoteWorkbenchInputClass()} placeholder="185000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Pricing mode</Label>
              <select name="pricingMode" className={quoteWorkbenchSelectClass() + " w-full"} defaultValue={PricingMode.FIXED_PRICE}>
                {Object.values(PricingMode).map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Line mode</Label>
              <select name="lineMode" className={quoteWorkbenchSelectClass() + " w-full"} defaultValue={QuoteLineMode.REQUIRED}>
                {Object.values(QuoteLineMode).map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Internal notes</Label>
              <Textarea name="internalNotes" rows={2} className={quoteWorkbenchTextareaClass()} />
            </div>
            <Button type="submit" className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90 md:col-span-2">
              Add line item
            </Button>
            <ActionError state={addState} />
          </form>
        </>
      ) : null}
    </div>
  );
}

function LineItemExecutionPlanningReadOnly({ line }: { line: QuoteWorkspaceProps["quote"]["lineItems"][number] }) {
  const stages = [...line.executionStages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  if (stages.length === 0) return null;
  return (
    <div className="mt-3 border-t border-border dark:border-zinc-800/50 pt-3">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/70">Execution plan (frozen)</p>
      <ul className="space-y-3">
        {stages.map((s) => {
          const tasks = [...s.tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
          return (
            <li key={s.id} className="rounded-[5px] border border-border bg-muted/60 p-2.5 dark:border-zinc-800/60 dark:bg-zinc-950/90">
              <p className="text-xs font-medium text-foreground dark:text-zinc-200">{s.title}</p>
              <ul className="mt-2 space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="border-l-2 border-primary/50 pl-2 dark:border-blue-500/35">
                    <p className="text-xs text-foreground/90 dark:text-zinc-300">{t.title}</p>
                    <PlannedTaskEvidenceReadOnly dto={t.completionRequirement} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
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
    <div className="mt-4 space-y-3 border-t border-border bg-muted/50 px-4 py-4 dark:border-zinc-800/50 dark:bg-zinc-950/80">
      <h4 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/80">Execution plan for this line</h4>
      <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">
        Stages sequence internal work; tasks under each stage are operational checklists—not pricing rows. Add a stage,
        then add tasks. Customer-visible tasks need a label for the internal preview only.
      </p>
      {stages.length === 0 ? (
        <p className="text-xs text-muted-foreground dark:text-zinc-500">
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
    <div className="space-y-2 rounded-[5px] border border-dashed border-border bg-muted/40 p-3 dark:border-zinc-700/50 dark:bg-zinc-950/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">New stage</p>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-[5px] border-input dark:border-zinc-700/80 bg-transparent text-[11px] text-foreground/90 dark:text-zinc-300 hover:bg-muted/80 dark:hover:bg-zinc-900/80"
            >
              Add stage from template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="lineItemId" value={lineItemId} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">New stage title</Label>
          <Input name="title" required className={quoteWorkbenchInputClass()} placeholder="e.g. Permitting" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Stage internal notes (optional)</Label>
          <Textarea name="internalNotes" rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <Button type="submit" size="sm" className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground hover:bg-secondary/80 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700/80 md:col-span-2">
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
    <li className="rounded-[5px] border border-border dark:border-zinc-800/60 bg-muted/40 dark:bg-zinc-950/40 p-3">
      <div className="mb-2 flex flex-wrap justify-end gap-2">
        <SaveWorkTemplateDialog
          quoteId={quoteId}
          saveKind="stage"
          lineItemId={lineId}
          stageId={stage.id}
          defaultName={stage.title}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-[5px] text-[11px] text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Save stage as template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="lineItemId" value={lineId} />
        <input type="hidden" name="stageId" value={stage.id} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Stage title</Label>
          <Input name="title" defaultValue={stage.title} required className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Stage internal notes</Label>
          <Textarea name="internalNotes" defaultValue={stage.internalNotes ?? ""} rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <Button type="submit" size="sm" className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground hover:bg-secondary/80 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700/80 md:col-span-2">
          Save stage
        </Button>
        <ActionError state={st} />
      </form>
      <form action={rmAct} className="mt-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="stageId" value={stage.id} />
        <Button type="submit" size="sm" variant="outline" className="h-8 rounded-[5px] border-input dark:border-zinc-700/80 text-xs text-foreground/90 dark:text-zinc-300 hover:bg-muted/70 dark:hover:bg-zinc-900/60">
          Remove stage
        </Button>
        <ActionError state={rmSt} />
      </form>
      <div className="mt-3 space-y-3 border-t border-border dark:border-zinc-800/50 pt-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">Tasks in this stage</p>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground dark:text-zinc-500">No tasks in this stage yet.</p>
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
    <div className="space-y-2 rounded-[5px] border border-dashed border-border bg-muted/40 p-2.5 dark:border-zinc-700/45 dark:bg-zinc-950/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">New task</p>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-[5px] border-input dark:border-zinc-700/80 bg-transparent text-[11px] text-foreground/90 dark:text-zinc-300 hover:bg-muted/80 dark:hover:bg-zinc-900/80"
            >
              Add task from template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="stageId" value={stageId} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Task title</Label>
          <Input name="title" required className={quoteWorkbenchInputClass()} placeholder="e.g. Submit permit application" />
        </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Description</Label>
        <Textarea name="description" rows={2} className={quoteWorkbenchTextareaClass()} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400 md:col-span-2">
        <input type="checkbox" name="isRequired" />
        Required for readiness (line-level)
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400 md:col-span-2">
        <input type="checkbox" name="customerVisible" />
        Customer-visible (internal preview)
      </label>
      <div className="space-y-1.5 md:col-span-2">
        <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Customer label (if visible)</Label>
        <Input name="customerLabel" className={quoteWorkbenchInputClass()} />
      </div>
        <PlannedTaskEvidenceRequirementFields />
        <Button type="submit" size="sm" className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90 md:col-span-2">
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
    <li className="rounded-[4px] border border-border bg-muted/60 p-2 dark:border-zinc-800/70 dark:bg-zinc-950/90">
      <div className="mb-2 flex justify-end">
        <SaveWorkTemplateDialog
          quoteId={quoteId}
          saveKind="task"
          stageId={stageId}
          taskId={task.id}
          defaultName={task.title}
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-[5px] text-[11px] text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Save task as template
            </Button>
          }
        />
      </div>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="stageId" value={stageId} />
        <input type="hidden" name="taskId" value={task.id} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Title</Label>
          <Input name="title" defaultValue={task.title} required className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Description</Label>
          <Textarea name="description" defaultValue={task.description ?? ""} rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400">
          <input type="checkbox" name="isRequired" defaultChecked={task.isRequired} />
          Required
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground dark:text-zinc-400 md:col-span-2">
          <input type="checkbox" name="customerVisible" defaultChecked={task.customerVisible} />
          Customer-visible
        </label>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Customer label</Label>
          <Input name="customerLabel" defaultValue={task.customerLabel ?? ""} className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Internal notes</Label>
          <Textarea name="internalNotes" defaultValue={task.internalNotes ?? ""} rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <PlannedTaskEvidenceRequirementFields completionRequirement={task.completionRequirement} />
        <Button type="submit" size="sm" className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground hover:bg-secondary/80 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700/80 md:col-span-2">
          Save task
        </Button>
        <ActionError state={st} />
      </form>
      <form action={actStatus} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="taskId" value={task.id} />
        <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Status</Label>
        <select name="status" defaultValue={task.status} className={quoteWorkbenchSelectClass()}>
          {Object.values(QuoteTaskStatus).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground hover:bg-secondary/80 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700/80">
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
      <div className="overflow-hidden rounded-[6px] border border-border bg-card text-card-foreground ring-1 ring-inset ring-border/60 dark:border-zinc-800/70 dark:bg-zinc-950 dark:ring-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border dark:border-zinc-800/50 px-4 py-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/90">Commercial · frozen</p>
            <p className="mt-1 text-sm font-semibold text-foreground dark:text-white">{line.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-zinc-500">{line.lineMode}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Line total</p>
            <p className="font-mono text-sm font-semibold text-primary dark:text-blue-200/90">{fmtMoney(line.lineTotalCents)}</p>
          </div>
        </div>
        <div className="px-4 py-3">
          {line.lineMode !== QuoteLineMode.REMOVED ? <LineItemExecutionPlanningReadOnly line={line} /> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[6px] border border-border bg-card text-card-foreground ring-1 ring-inset ring-border/60 dark:border-zinc-800/70 dark:bg-zinc-950 dark:ring-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border dark:border-zinc-800/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/90">Commercial line</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground dark:text-white" title={line.title}>
            {line.title}
          </p>
          {line.sourceTemplateName ? (
            <p className="mt-2 text-[11px] text-muted-foreground dark:text-zinc-500">
              Template: <span className="text-foreground/90 dark:text-zinc-300">{line.sourceTemplateName}</span>
              {line.sourceTemplateVersion != null ? ` v${line.sourceTemplateVersion}` : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <SaveWorkTemplateDialog
            quoteId={quoteId}
            saveKind="line"
            lineItemId={line.id}
            defaultName={line.title}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                Save as template
              </Button>
            }
          />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Line total</p>
            <p className="font-mono text-sm font-semibold text-primary dark:text-blue-200/90">{fmtMoney(line.lineTotalCents)}</p>
          </div>
        </div>
      </div>
      <form action={action} className="grid gap-3 border-t border-border bg-muted/20 px-4 py-4 dark:border-zinc-800/40 dark:bg-zinc-950/40 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="lineItemId" value={line.id} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Title</Label>
          <Input name="title" defaultValue={line.title} required className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Customer description</Label>
          <Textarea
            name="customerDescription"
            defaultValue={line.customerDescription}
            required
            rows={2}
            className={quoteWorkbenchTextareaClass()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Qty</Label>
          <Input name="quantity" defaultValue={line.quantity} required className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Unit (¢)</Label>
          <Input
            name="unitPriceCents"
            type="number"
            min={0}
            defaultValue={line.unitPriceCents ?? ""}
            className={quoteWorkbenchInputClass()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Pricing</Label>
          <select name="pricingMode" defaultValue={line.pricingMode} className={quoteWorkbenchSelectClass() + " w-full"}>
            {Object.values(PricingMode).map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Line mode</Label>
          <select name="lineMode" defaultValue={line.lineMode} className={quoteWorkbenchSelectClass() + " w-full"}>
            {Object.values(QuoteLineMode).map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Internal notes</Label>
          <Textarea name="internalNotes" defaultValue={line.internalNotes ?? ""} rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" size="sm" className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90">
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
        <form action={rmAction} className="border-t border-border dark:border-zinc-800/50 px-4 py-3">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="lineItemId" value={line.id} />
          <Button type="submit" size="sm" variant="outline" className="h-8 rounded-[5px] border-input dark:border-zinc-700/80 text-xs text-muted-foreground dark:text-zinc-400 hover:bg-muted/70 dark:hover:bg-zinc-900/60">
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
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
        Internal preparation before send — reviews, approvals, gates. Not commercial line items; not field runtime work.
      </p>
      {prep.length === 0 ? (
        <p className="rounded-[5px] border border-dashed border-amber-600/50 bg-amber-500/10 px-4 py-5 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/10 dark:text-amber-200/80">
          No quote-prep tasks yet. Add internal gates (e.g. margin review) if your process requires them.
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
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Title</Label>
              <Input name="title" required className={quoteWorkbenchInputClass()} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Description</Label>
              <Textarea name="description" rows={2} className={quoteWorkbenchTextareaClass()} />
            </div>
            <label className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200/70 md:col-span-2">
              <input type="checkbox" name="isRequired" />
              Required before send
            </label>
            <Button
              type="submit"
              className="h-8 rounded-[5px] bg-amber-600 text-xs text-amber-50 hover:bg-amber-600/90 dark:bg-amber-600/90 dark:hover:bg-amber-500 md:col-span-2"
            >
              Add quote-prep task
            </Button>
            <ActionError state={addSt} />
          </form>
        </>
      ) : null}
    </div>
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
      <li className="rounded-[5px] border border-amber-500/40 bg-amber-500/10 p-3 dark:border-amber-900/30 dark:bg-amber-950/10">
        <p className="font-medium text-amber-950 dark:text-amber-50">{task.title}</p>
        <p className="text-xs text-amber-800 dark:text-amber-200/60">Quote-prep task</p>
      </li>
    );
  }
  return (
    <li className="rounded-[5px] border border-amber-600/45 bg-amber-500/[0.12] p-3 dark:border-amber-900/35 dark:bg-amber-950/15">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/80">Quote-prep task</p>
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="taskId" value={task.id} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-amber-900 dark:text-amber-200/70">Title</Label>
          <Input name="title" defaultValue={task.title} required className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-amber-900 dark:text-amber-200/70">Description</Label>
          <Textarea name="description" defaultValue={task.description ?? ""} rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <label className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200/60">
          <input type="checkbox" name="isRequired" defaultChecked={task.isRequired} />
          Required
        </label>
        <label className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200/60 md:col-span-2">
          <input type="checkbox" name="customerVisible" defaultChecked={task.customerVisible} />
          Customer-visible
        </label>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-amber-900 dark:text-amber-200/70">Customer label</Label>
          <Input name="customerLabel" defaultValue={task.customerLabel ?? ""} className={quoteWorkbenchInputClass()} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-amber-900 dark:text-amber-200/70">Internal notes</Label>
          <Textarea name="internalNotes" defaultValue={task.internalNotes ?? ""} rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <Button
          type="submit"
          size="sm"
          className="h-8 rounded-[5px] border border-amber-800/50 bg-amber-100 text-xs text-amber-950 hover:bg-amber-200/90 md:col-span-2 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/50"
        >
          Save task
        </Button>
        <ActionError state={st} />
      </form>
      <form action={actStatus} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="taskId" value={task.id} />
        <Label className="text-[11px] text-amber-900 dark:text-amber-200/70">Status</Label>
        <select name="status" defaultValue={task.status} className={quoteWorkbenchSelectClass()}>
          {Object.values(QuoteTaskStatus).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="sm"
          className="h-8 rounded-[5px] border border-amber-800/50 bg-amber-100 text-xs text-amber-950 hover:bg-amber-200/90 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/50"
        >
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
    <div className="space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">Assumptions</h3>
      {assumptions.length === 0 ? (
        <p className="text-sm text-muted-foreground dark:text-zinc-500">No assumptions recorded.</p>
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
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Text</Label>
              <Textarea name="text" required rows={2} className={quoteWorkbenchTextareaClass()} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Visibility</Label>
              <select name="visibility" className={quoteWorkbenchSelectClass() + " w-full"} defaultValue={QuoteAssumptionVisibility.CUSTOMER_VISIBLE}>
                {Object.values(QuoteAssumptionVisibility).map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Line (optional)</Label>
              <select name="quoteLineItemId" className={quoteWorkbenchSelectClass() + " w-full"} defaultValue="">
                <option value="">Quote-level</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="h-8 rounded-[5px] bg-primary text-xs text-primary-foreground hover:bg-primary/90 md:col-span-2">
              Add assumption
            </Button>
            <ActionError state={addSt} />
          </form>
        </>
      ) : null}
    </div>
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
      <li className="rounded-[5px] border border-border dark:border-zinc-800/60 bg-muted/30 dark:bg-zinc-950/30 p-3 text-sm">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">{a.visibility.replace(/_/g, " ")}</span>
        <p className="mt-1 text-foreground dark:text-zinc-200">{a.text}</p>
      </li>
    );
  }
  return (
    <li className="rounded-[5px] border border-border dark:border-zinc-800/60 bg-muted/30 dark:bg-zinc-950/25 p-3">
      <form action={act} className="grid gap-2 md:grid-cols-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="assumptionId" value={a.id} />
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Text</Label>
          <Textarea name="text" defaultValue={a.text} required rows={2} className={quoteWorkbenchTextareaClass()} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Visibility</Label>
          <select name="visibility" defaultValue={a.visibility} className={quoteWorkbenchSelectClass() + " w-full"}>
            {Object.values(QuoteAssumptionVisibility).map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground dark:text-zinc-500">Line</Label>
          <select name="quoteLineItemId" defaultValue={a.quoteLineItemId ?? ""} className={quoteWorkbenchSelectClass() + " w-full"}>
            <option value="">Quote-level</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" size="sm" className="h-8 rounded-[5px] border border-border bg-secondary text-xs text-secondary-foreground hover:bg-secondary/80 dark:border-zinc-600/60 dark:bg-zinc-800/80 dark:text-zinc-100 dark:hover:bg-zinc-700/80">
            Save
          </Button>
        </div>
        <ActionError state={st} />
      </form>
      <form action={rmAct} className="mt-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="assumptionId" value={a.id} />
        <Button type="submit" size="sm" variant="outline" className="h-8 rounded-[5px] border-input dark:border-zinc-700/80 text-xs text-muted-foreground dark:text-zinc-400 hover:bg-muted/70 dark:hover:bg-zinc-900/60">
          Remove
        </Button>
        <ActionError state={rm} />
      </form>
    </li>
  );
}
