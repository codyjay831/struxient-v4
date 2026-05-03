import type { Customer, Quote, QuoteAssumption, QuoteLineExecutionTask, QuoteLineItem } from "@prisma/client";

import { PricingMode, QuoteAssumptionVisibility, QuoteLineMode, QuoteStatus } from "@prisma/client";

import { z } from "zod";

import { formatQuoteStatus } from "@/lib/format-enums";
import { isQuoteCustomerPreviewFrozen } from "@/lib/quote-lifecycle";
import {
  completionRequirementsV1Schema,
  parseJobTaskCompletionRequirements,
} from "@/server/phase13/completion-requirements";



export type QuoteCustomerPreviewLine = {

  title: string;

  customerDescription: string;

  quantityDisplay: string;

  pricingPresentation: string;

  customerVisibleAssumptions: string[];

  /** Customer-visible labels from this line's quoted execution plan (internal preview only). */

  customerVisibleExecutionHighlights: { label: string }[];

};



export type QuoteCustomerPreviewDTO = {

  organizationName: string;

  quoteTitle: string;

  displayNumber: number;

  customerDisplayName: string;

  serviceAddressSummary: string;

  scopeSummary: string | null;

  scopeIntent: string;

  customerFacingIntro: string | null;

  lineItems: QuoteCustomerPreviewLine[];

  customerVisibleQuoteAssumptions: string[];

  /**

   * @deprecated Legacy quote-level highlights; preserved for older SENT snapshots only.

   * New previews use `lineItems[].customerVisibleExecutionHighlights`.

   */

  plannedCustomerHighlights: { label: string }[];

  subtotalCents: number | null;

  totalCents: number | null;

  statusLabel: string;

  asOf: string;

};



const quoteCustomerPreviewLineSchema = z.object({

  title: z.string(),

  customerDescription: z.string(),

  quantityDisplay: z.string(),

  pricingPresentation: z.string(),

  customerVisibleAssumptions: z.array(z.string()),

  customerVisibleExecutionHighlights: z

    .array(z.object({ label: z.string() }))

    .optional()

    .default([]),

});



/** Validates persisted customer preview objects (SENT snapshot `preview` field). */

export const quoteCustomerPreviewDTOSchema = z.object({

  organizationName: z.string(),

  quoteTitle: z.string(),

  displayNumber: z.number(),

  customerDisplayName: z.string(),

  serviceAddressSummary: z.string(),

  scopeSummary: z.string().nullable(),

  scopeIntent: z.string(),

  customerFacingIntro: z.string().nullable(),

  lineItems: z.array(quoteCustomerPreviewLineSchema),

  customerVisibleQuoteAssumptions: z.array(z.string()),

  plannedCustomerHighlights: z.array(z.object({ label: z.string() })).optional().default([]),

  subtotalCents: z.number().nullable(),

  totalCents: z.number().nullable(),

  statusLabel: z.string(),

  asOf: z.string(),

});



/** Full v1 sent snapshot persisted on the quote row. */

export const sentQuoteSnapshotV1Schema = z.object({

  version: z.literal(1),

  sentAt: z.string(),

  quoteId: z.string(),

  displayNumber: z.number().int(),

  preview: quoteCustomerPreviewDTOSchema,

});



export type SentQuoteSnapshotV1 = z.infer<typeof sentQuoteSnapshotV1Schema>;

/** Frozen internal line execution graph for future job seeding (staff-only; not customer-facing). */
const sentInternalExecutionTaskSnapshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  isRequired: z.boolean(),
  sortOrder: z.number(),
  assignedRole: z.string().nullable().optional(),
  estimatedDurationMinutes: z.number().nullable().optional(),
  customerVisible: z.boolean(),
  customerLabel: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  /** Frozen planned evidence completion gate (Phase 13 v1). Omitted on legacy v2 snapshots. */
  completionRequirementsJson: z.union([z.null(), completionRequirementsV1Schema]).optional(),
});

const sentInternalExecutionStageSnapshotSchema = z.object({
  id: z.string(),
  title: z.string(),
  sortOrder: z.number(),
  internalNotes: z.string().nullable().optional(),
  tasks: z.array(sentInternalExecutionTaskSnapshotSchema),
});

export const sentInternalExecutionPlanSchema = z.object({
  lines: z.array(
    z.object({
      quoteLineItemId: z.string(),
      title: z.string(),
      sortOrder: z.number(),
      stages: z.array(sentInternalExecutionStageSnapshotSchema),
    }),
  ),
});

export type SentInternalExecutionPlan = z.infer<typeof sentInternalExecutionPlanSchema>;

/** Full v2 sent snapshot: customer preview plus internal execution plan. */
export const sentQuoteSnapshotV2Schema = z.object({
  version: z.literal(2),
  sentAt: z.string(),
  quoteId: z.string(),
  displayNumber: z.number().int(),
  preview: quoteCustomerPreviewDTOSchema,
  internalExecutionPlan: sentInternalExecutionPlanSchema,
});

export type SentQuoteSnapshotV2 = z.infer<typeof sentQuoteSnapshotV2Schema>;

export type SentQuoteSnapshotValidated = SentQuoteSnapshotV1 | SentQuoteSnapshotV2;

export type LineItemForInternalExecutionSnapshot = Pick<QuoteLineItem, "id" | "title" | "sortOrder" | "lineMode"> & {
  executionStages: {
    id: string;
    title: string;
    sortOrder: number;
    internalNotes: string | null;
    tasks: Pick<
      QuoteLineExecutionTask,
      | "id"
      | "title"
      | "description"
      | "status"
      | "isRequired"
      | "sortOrder"
      | "assignedRole"
      | "estimatedDurationMinutes"
      | "customerVisible"
      | "customerLabel"
      | "internalNotes"
      | "completionRequirementsJson"
    >[];
  }[];
};

/**
 * Builds the internal execution snapshot from live line rows (non-removed lines only).
 * Tasks always live under a stage in the Phase 2B model — this structure preserves that invariant for job seeding.
 */
export function buildInternalExecutionPlanFromLineItems(
  lineItems: LineItemForInternalExecutionSnapshot[],
): SentInternalExecutionPlan {
  const lines = lineItems
    .filter((l) => l.lineMode !== QuoteLineMode.REMOVED)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((l) => ({
      quoteLineItemId: l.id,
      title: l.title,
      sortOrder: l.sortOrder,
      stages: [...l.executionStages]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
        .map((s) => ({
          id: s.id,
          title: s.title,
          sortOrder: s.sortOrder,
          internalNotes: s.internalNotes,
          tasks: [...s.tasks]
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
            .map((t) => {
              const req = parseJobTaskCompletionRequirements(t.completionRequirementsJson);
              const base = {
                id: t.id,
                title: t.title,
                description: t.description,
                status: String(t.status),
                isRequired: t.isRequired,
                sortOrder: t.sortOrder,
                assignedRole: t.assignedRole,
                estimatedDurationMinutes: t.estimatedDurationMinutes,
                customerVisible: t.customerVisible,
                customerLabel: t.customerLabel,
                internalNotes: t.internalNotes,
              };
              return req.kind === "valid" ? { ...base, completionRequirementsJson: req.v1 } : base;
            }),
        })),
    }));
  return { lines };
}

/** Parse nested `preview` from `sentSnapshotJson` (integrity / frozen workspace). Supports v1 and v2. */
export function parseSentSnapshotPreviewDto(sentSnapshotJson: unknown): QuoteCustomerPreviewDTO | null {
  if (sentSnapshotJson == null || typeof sentSnapshotJson !== "object") return null;
  const raw = sentSnapshotJson as { version?: unknown; preview?: unknown };
  if (raw.version === 2) {
    const r = sentQuoteSnapshotV2Schema.safeParse(sentSnapshotJson);
    return r.success ? r.data.preview : null;
  }
  const r = quoteCustomerPreviewDTOSchema.safeParse(raw.preview);
  return r.success ? r.data : null;
}

/** Parse internal execution plan from a v2 SENT snapshot; v1 returns null. */
export function parseSentSnapshotInternalExecutionPlan(sentSnapshotJson: unknown): SentInternalExecutionPlan | null {
  if (sentSnapshotJson == null || typeof sentSnapshotJson !== "object") return null;
  const raw = sentSnapshotJson as { version?: unknown };
  if (raw.version !== 2) return null;
  const r = sentQuoteSnapshotV2Schema.safeParse(sentSnapshotJson);
  return r.success ? r.data.internalExecutionPlan : null;
}

/** Validate snapshot before persisting as `sentSnapshotJson`. Accepts v1 (legacy) or v2. */
export function parseValidatedSentQuoteSnapshot(snapshot: unknown): SentQuoteSnapshotValidated | null {
  const v2 = sentQuoteSnapshotV2Schema.safeParse(snapshot);
  if (v2.success) return v2.data;
  const v1 = sentQuoteSnapshotV1Schema.safeParse(snapshot);
  return v1.success ? v1.data : null;
}

/** @deprecated Prefer {@link parseValidatedSentQuoteSnapshot} for reads; v2 is written on send. */
export function parseValidatedSentQuoteSnapshotV1(snapshot: unknown): SentQuoteSnapshotV1 | null {
  const r = sentQuoteSnapshotV1Schema.safeParse(snapshot);
  return r.success ? r.data : null;
}



export type QuotePreviewWorkspaceResolution =

  | { kind: "live"; preview: QuoteCustomerPreviewDTO }

  | { kind: "frozen"; preview: QuoteCustomerPreviewDTO }

  | { kind: "SENT_SNAPSHOT_MISSING" };



/**

 * Workspace preview: non-SENT uses live builder; SENT uses frozen snapshot only (no live fallback).

 */

export function getQuotePreviewForWorkspace(params: {

  quoteStatus: QuoteStatus;

  sentSnapshotJson: unknown;

  liveParams: Parameters<typeof buildQuoteCustomerPreviewDTO>[0];

}): QuotePreviewWorkspaceResolution {

  const { quoteStatus, sentSnapshotJson, liveParams } = params;

  if (!isQuoteCustomerPreviewFrozen(quoteStatus)) {
    return { kind: "live", preview: buildQuoteCustomerPreviewDTO(liveParams) };
  }

  const frozen = parseSentSnapshotPreviewDto(sentSnapshotJson);

  if (!frozen) return { kind: "SENT_SNAPSHOT_MISSING" };

  return { kind: "frozen", preview: frozen };

}



export function formatLinePricingPresentation(line: Pick<QuoteLineItem, "pricingMode" | "unitPriceCents" | "lineTotalCents" | "quantity">): string {

  const qty = Number(line.quantity);

  const qLabel = Number.isInteger(qty) ? String(qty) : String(line.quantity);



  switch (line.pricingMode) {

    case PricingMode.FIXED_PRICE: {

      const unit = line.unitPriceCents;

      if (unit == null) return "Fixed price — amount pending";

      const unitStr = (unit / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });

      const totalCents = line.lineTotalCents ?? Math.round(Number(line.quantity) * unit);

      const totalStr = (totalCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });

      return `${totalStr} total (${unitStr} × ${qLabel})`;

    }

    case PricingMode.PRICE_ON_REQUEST:

      return "Price on request";

    case PricingMode.ALLOWANCE:

      return "Allowance";

    case PricingMode.INCLUDED:

      return "Included";

    case PricingMode.NO_CHARGE:

      return "No charge";

    default:

      return String(line.pricingMode);

  }

}



function lineTotalsForSubtotal(lines: Pick<QuoteLineItem, "lineMode" | "pricingMode" | "unitPriceCents" | "quantity" | "lineTotalCents">[]) {

  let sub = 0;

  let any = false;

  for (const l of lines) {

    if (l.lineMode === QuoteLineMode.REMOVED) continue;

    if (l.pricingMode !== PricingMode.FIXED_PRICE) continue;

    const unit = l.unitPriceCents;

    if (unit == null) continue;

    const q = Number(l.quantity);

    if (!Number.isFinite(q)) continue;

    const total = Math.round(q * unit);

    sub += total;

    any = true;

  }

  return any ? sub : null;

}



export type QuotePreviewLineWithExecution = Pick<

  QuoteLineItem,

  "id" | "title" | "customerDescription" | "quantity" | "pricingMode" | "unitPriceCents" | "lineTotalCents" | "lineMode"

> & {

  executionStages?: {

    tasks: Pick<QuoteLineExecutionTask, "customerVisible" | "customerLabel">[];

  }[];

};



function customerVisibleExecutionHighlightsForLine(line: QuotePreviewLineWithExecution): { label: string }[] {

  const stages = line.executionStages ?? [];

  const out: { label: string }[] = [];

  for (const s of stages) {

    for (const t of s.tasks ?? []) {

      if (t.customerVisible && t.customerLabel?.trim()) {

        out.push({ label: t.customerLabel.trim() });

      }

    }

  }

  return out;

}



/**

 * Customer-safe projection for internal preview and sent snapshot payload.

 * Omits internal notes, quote-prep tasks, internal assumptions, and non–customer-visible execution tasks.

 */

export function buildQuoteCustomerPreviewDTO(params: {

  organizationName: string;

  quote: Pick<

    Quote,

    | "title"

    | "displayNumber"

    | "status"

    | "serviceAddressText"

    | "serviceAddressTbd"

    | "scopeSummary"

    | "scopeIntent"

    | "customerFacingIntro"

    | "pricingSubtotalCents"

    | "totalCents"

  >;

  customer: Pick<Customer, "displayName">;

  lineItems: QuotePreviewLineWithExecution[];

  assumptions: Pick<QuoteAssumption, "quoteLineItemId" | "visibility" | "text">[];

  asOfDate?: Date;

}): QuoteCustomerPreviewDTO {

  const { organizationName, quote, customer, lineItems, assumptions, asOfDate = new Date() } = params;



  const addr =

    quote.serviceAddressTbd && !quote.serviceAddressText?.trim()

      ? "Service location to be determined"

      : quote.serviceAddressText?.trim() || "Address on file";



  const visibleAssumptionsByLine = new Map<string, string[]>();

  const quoteLevel: string[] = [];

  for (const a of assumptions) {

    if (a.visibility !== QuoteAssumptionVisibility.CUSTOMER_VISIBLE) continue;

    if (a.quoteLineItemId) {

      const arr = visibleAssumptionsByLine.get(a.quoteLineItemId) ?? [];

      arr.push(a.text.trim());

      visibleAssumptionsByLine.set(a.quoteLineItemId, arr);

    } else {

      quoteLevel.push(a.text.trim());

    }

  }



  const visibleLines = lineItems.filter((l) => l.lineMode !== QuoteLineMode.REMOVED);

  const lineDtos: QuoteCustomerPreviewLine[] = visibleLines.map((l) => ({

    title: l.title.trim(),

    customerDescription: l.customerDescription.trim(),

    quantityDisplay: String(l.quantity),

    pricingPresentation: formatLinePricingPresentation(l),

    customerVisibleAssumptions: visibleAssumptionsByLine.get(l.id) ?? [],

    customerVisibleExecutionHighlights: customerVisibleExecutionHighlightsForLine(l),

  }));



  const sub = quote.pricingSubtotalCents ?? lineTotalsForSubtotal(lineItems);

  const tot = quote.totalCents ?? sub;



  return {

    organizationName,

    quoteTitle: quote.title.trim(),

    displayNumber: quote.displayNumber,

    customerDisplayName: customer.displayName.trim(),

    serviceAddressSummary: addr,

    scopeSummary: quote.scopeSummary?.trim() ? quote.scopeSummary.trim() : null,

    scopeIntent: quote.scopeIntent.trim(),

    customerFacingIntro: quote.customerFacingIntro?.trim() ? quote.customerFacingIntro.trim() : null,

    lineItems: lineDtos,

    customerVisibleQuoteAssumptions: quoteLevel,

    plannedCustomerHighlights: [],

    subtotalCents: sub,

    totalCents: tot,

    statusLabel: formatQuoteStatus(quote.status),

    asOf: asOfDate.toISOString(),

  };

}


