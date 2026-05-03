import {
  PricingMode,
  QuoteAssumptionVisibility,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskStatus,
} from "@prisma/client";
import { z } from "zod";

const nonEmptyId = z.string().trim().min(1, "Required");

export const createQuoteDraftFromOpportunitySchema = z.object({
  opportunityId: nonEmptyId,
});

export const updateQuoteDraftSchema = z
  .object({
    quoteId: nonEmptyId,
    title: z.string().trim().min(1, "Title is required").max(300),
    serviceAddressText: z.string().max(2000).optional().nullable(),
    serviceAddressTbd: z.coerce.boolean(),
    scopeIntent: z.string().trim().min(1, "Scope intent is required").max(10_000),
    scopeSummary: z.string().trim().max(10_000).optional().nullable(),
    customerFacingIntro: z.string().trim().max(10_000).optional().nullable(),
    internalNotes: z.string().trim().max(10_000).optional().nullable(),
    status: z.nativeEnum(QuoteStatus).optional(),
    ownerUserId: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.serviceAddressTbd) {
      const t = data.serviceAddressText?.trim() ?? "";
      if (t.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a service address or mark location as not yet determined.",
          path: ["serviceAddressText"],
        });
      }
    }
    if (data.status) {
      const allowed: QuoteStatus[] = [
        QuoteStatus.DRAFT,
        QuoteStatus.MISSING_INFO,
        QuoteStatus.NEEDS_REVIEW,
        QuoteStatus.READY_TO_SEND,
      ];
      if (!allowed.includes(data.status)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use Mark ready or Mark sent actions for status changes from this form.",
          path: ["status"],
        });
      }
    }
  });

/** Draft quote: title, internal scope, service location, pipeline, owner — not customer proposal text. */
export const updateQuoteDraftBasicsSchema = z
  .object({
    quoteId: nonEmptyId,
    title: z.string().trim().min(1, "Title is required").max(300),
    serviceAddressText: z.string().max(2000).optional().nullable(),
    serviceAddressTbd: z.coerce.boolean(),
    scopeIntent: z.string().trim().min(1, "Scope intent is required").max(10_000),
    internalNotes: z.string().trim().max(10_000).optional().nullable(),
    status: z.nativeEnum(QuoteStatus).optional(),
    ownerUserId: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.serviceAddressTbd) {
      const t = data.serviceAddressText?.trim() ?? "";
      if (t.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a service address or mark location as not yet determined.",
          path: ["serviceAddressText"],
        });
      }
    }
    if (data.status) {
      const allowed: QuoteStatus[] = [
        QuoteStatus.DRAFT,
        QuoteStatus.MISSING_INFO,
        QuoteStatus.NEEDS_REVIEW,
        QuoteStatus.READY_TO_SEND,
      ];
      if (!allowed.includes(data.status)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use Mark ready or Mark sent actions for status changes from this form.",
          path: ["status"],
        });
      }
    }
  });

/** Draft quote: customer-facing proposal copy (not frozen until send). */
export const updateQuoteDraftProposalSchema = z.object({
  quoteId: nonEmptyId,
  scopeSummary: z.string().trim().max(10_000).optional().nullable(),
  customerFacingIntro: z.string().trim().max(10_000).optional().nullable(),
});

export const updateQuoteInternalNotesSchema = z.object({
  quoteId: nonEmptyId,
  internalNotes: z.string().trim().max(10_000).optional().nullable(),
});

export const addQuoteLineItemSchema = z.object({
  quoteId: nonEmptyId,
  title: z.string().trim().min(1).max(500),
  customerDescription: z.string().trim().min(1, "Customer description is required").max(10_000),
  quantity: z.string().trim().min(1),
  unitPriceCents: z.coerce.number().int().optional().nullable(),
  pricingMode: z.nativeEnum(PricingMode),
  lineMode: z.nativeEnum(QuoteLineMode),
  internalNotes: z.string().trim().max(10_000).optional().nullable(),
});

export const updateQuoteLineItemSchema = addQuoteLineItemSchema.extend({
  lineItemId: nonEmptyId,
});

export const markQuoteLineRemovedSchema = z.object({
  quoteId: nonEmptyId,
  lineItemId: nonEmptyId,
});

/** Quote-prep tasks only (internal sales/admin). */
export const addQuoteTaskSchema = z.object({
  quoteId: nonEmptyId,
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(10_000).optional().nullable(),
  isRequired: z.coerce.boolean().optional(),
  assignedRole: z.string().trim().max(120).optional().nullable(),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional().nullable(),
  customerVisible: z.coerce.boolean().optional(),
  customerLabel: z.string().trim().max(200).optional().nullable(),
  internalNotes: z.string().trim().max(10_000).optional().nullable(),
});

export const updateQuoteTaskSchema = addQuoteTaskSchema.extend({
  taskId: nonEmptyId,
});

export const addQuoteLineExecutionStageSchema = z.object({
  quoteId: nonEmptyId,
  lineItemId: nonEmptyId,
  title: z.string().trim().min(1).max(500),
  internalNotes: z.string().trim().max(10_000).optional().nullable(),
});

export const updateQuoteLineExecutionStageSchema = addQuoteLineExecutionStageSchema.extend({
  stageId: nonEmptyId,
});

export const removeQuoteLineExecutionStageSchema = z.object({
  quoteId: nonEmptyId,
  stageId: nonEmptyId,
});

/** Planned runtime evidence gate (Phase 13 v1 JSON); coerced from FormData in mutations. */
export const quoteLineExecutionEvidenceFormSchema = z.object({
  evidenceRequired: z.boolean(),
  minAcceptedEvidenceCount: z.coerce.number().int().min(1).max(10),
  allowJobLevelEvidence: z.boolean(),
});

export const addQuoteLineExecutionTaskSchema = z
  .object({
    quoteId: nonEmptyId,
    stageId: nonEmptyId,
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(10_000).optional().nullable(),
    isRequired: z.coerce.boolean().optional(),
    assignedRole: z.string().trim().max(120).optional().nullable(),
    estimatedDurationMinutes: z.coerce.number().int().positive().optional().nullable(),
    customerVisible: z.coerce.boolean().optional(),
    customerLabel: z.string().trim().max(200).optional().nullable(),
    internalNotes: z.string().trim().max(10_000).optional().nullable(),
  })
  .merge(quoteLineExecutionEvidenceFormSchema);

export const updateQuoteLineExecutionTaskSchema = addQuoteLineExecutionTaskSchema.extend({
  taskId: nonEmptyId,
});

export const updateQuoteLineExecutionTaskStatusSchema = z.object({
  quoteId: nonEmptyId,
  taskId: nonEmptyId,
  status: z.nativeEnum(QuoteTaskStatus),
});

export const updateQuoteTaskStatusSchema = z.object({
  quoteId: nonEmptyId,
  taskId: nonEmptyId,
  status: z.nativeEnum(QuoteTaskStatus),
});

export const addQuoteAssumptionSchema = z.object({
  quoteId: nonEmptyId,
  quoteLineItemId: z.string().trim().optional().nullable(),
  visibility: z.nativeEnum(QuoteAssumptionVisibility),
  text: z.string().trim().min(1, "Assumption text is required").max(10_000),
});

export const updateQuoteAssumptionSchema = addQuoteAssumptionSchema.extend({
  assumptionId: nonEmptyId,
});

export const removeQuoteAssumptionSchema = z.object({
  quoteId: nonEmptyId,
  assumptionId: nonEmptyId,
});

export const markQuoteLifecycleSchema = z.object({
  quoteId: nonEmptyId,
});

export const logQuotePreviewedSchema = z.object({
  quoteId: nonEmptyId,
});

export function parsePositiveQuantity(raw: string): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw.trim();
  if (!t) return { ok: false, message: "Quantity is required." };
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: "Enter a positive quantity." };
  }
  return { ok: true, value: t };
}
