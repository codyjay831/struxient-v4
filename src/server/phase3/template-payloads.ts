import { PricingMode, QuoteLineMode, QuoteWorkTemplateKind } from "@prisma/client";
import { z } from "zod";

import { parseJobTaskCompletionRequirements } from "@/server/phase13/completion-requirements";

/** Stored in `QuoteWorkTemplate.payloadJson` when `payloadVersion === 1`. */
export const TEMPLATE_PAYLOAD_VERSION = 1 as const;

const nonEmptyTrimmed = z.string().trim().min(1);
const optionalText = z
  .string()
  .max(10_000)
  .optional()
  .nullable()
  .transform((s) => {
    if (s == null) return null;
    const t = s.trim();
    return t.length ? t : null;
  });

const optionalShortText = z
  .string()
  .max(200)
  .optional()
  .nullable()
  .transform((s) => {
    if (s == null) return null;
    const t = s.trim();
    return t.length ? t : null;
  });

export const templateTagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .optional()
  .default([])
  .transform((arr) => arr.map((t) => t.trim()).filter(Boolean));

const templateExecutionTaskPayloadFieldsSchema = z.object({
  title: nonEmptyTrimmed.max(500),
  description: optionalText,
  isRequired: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional(),
  assignedRole: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((s) => (s?.trim() ? s.trim() : null)),
  estimatedDurationMinutes: z.coerce.number().int().positive().optional().nullable(),
  customerVisible: z.boolean().optional().default(false),
  customerLabel: optionalShortText,
  internalNotes: optionalText,
  /** Optional strict v1 evidence gate; omitted when absent or logically cleared. */
  completionRequirementsJson: z.unknown().optional().nullable(),
});

export const templateExecutionTaskPayloadSchema = templateExecutionTaskPayloadFieldsSchema
  .superRefine((data, ctx) => {
    const raw = data.completionRequirementsJson;
    if (raw === undefined || raw === null) return;
    const p = parseJobTaskCompletionRequirements(raw);
    if (p.kind === "invalid") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: p.reason,
        path: ["completionRequirementsJson"],
      });
    }
  })
  .transform((data) => {
    const { completionRequirementsJson, ...rest } = data;
    if (completionRequirementsJson === undefined || completionRequirementsJson === null) {
      return rest;
    }
    const p = parseJobTaskCompletionRequirements(completionRequirementsJson);
    if (p.kind === "none" || p.kind === "invalid") {
      return rest;
    }
    return { ...rest, completionRequirementsJson: p.v1 };
  });

export type TemplateExecutionTaskPayload = z.infer<typeof templateExecutionTaskPayloadSchema>;

export const lineItemPlanLinePayloadSchema = z.object({
  title: nonEmptyTrimmed.max(500),
  customerDescription: nonEmptyTrimmed.max(10_000),
  quantity: z.coerce.number().positive().max(1_000_000).optional().default(1),
  pricingMode: z.nativeEnum(PricingMode).optional().default(PricingMode.FIXED_PRICE),
  unitPriceCents: z.coerce.number().int().min(0).optional().nullable(),
  lineTotalCents: z.coerce.number().int().min(0).optional().nullable(),
  lineMode: z.nativeEnum(QuoteLineMode).optional().default(QuoteLineMode.REQUIRED),
  internalNotes: optionalText,
});

export const lineItemPlanStagePayloadSchema = z.object({
  title: nonEmptyTrimmed.max(500),
  internalNotes: optionalText,
  sortOrder: z.number().int().optional(),
  tasks: z.array(templateExecutionTaskPayloadSchema).default([]),
});

export const lineItemWithPlanPayloadSchema = z.object({
  line: lineItemPlanLinePayloadSchema,
  stages: z.array(lineItemPlanStagePayloadSchema).default([]),
});

export type LineItemWithPlanPayload = z.infer<typeof lineItemWithPlanPayloadSchema>;

export const stageWithTasksPayloadSchema = z.object({
  stage: z.object({
    title: nonEmptyTrimmed.max(500),
    internalNotes: optionalText,
  }),
  tasks: z.array(templateExecutionTaskPayloadSchema).min(0).default([]),
});

export type StageWithTasksPayload = z.infer<typeof stageWithTasksPayloadSchema>;

export const taskOnlyPayloadSchema = z.object({
  task: templateExecutionTaskPayloadSchema,
});

export type TaskOnlyPayload = z.infer<typeof taskOnlyPayloadSchema>;

export function parseTagsJson(raw: unknown): string[] {
  const r = templateTagsSchema.safeParse(raw);
  return r.success ? r.data : [];
}

export function parseLineItemWithPlanPayload(payloadJson: unknown): LineItemWithPlanPayload {
  const r = lineItemWithPlanPayloadSchema.safeParse(payloadJson);
  if (!r.success) {
    throw new Error(r.error.issues[0]?.message ?? "Invalid LINE_ITEM_WITH_PLAN payload.");
  }
  return r.data;
}

export function parseStageWithTasksPayload(payloadJson: unknown): StageWithTasksPayload {
  const r = stageWithTasksPayloadSchema.safeParse(payloadJson);
  if (!r.success) {
    throw new Error(r.error.issues[0]?.message ?? "Invalid STAGE_WITH_TASKS payload.");
  }
  return r.data;
}

export function parseTaskOnlyPayload(payloadJson: unknown): TaskOnlyPayload {
  const r = taskOnlyPayloadSchema.safeParse(payloadJson);
  if (!r.success) {
    throw new Error(r.error.issues[0]?.message ?? "Invalid TASK payload.");
  }
  return r.data;
}

export function validatePayloadForKind(
  kind: QuoteWorkTemplateKind,
  payloadJson: unknown,
): LineItemWithPlanPayload | StageWithTasksPayload | TaskOnlyPayload {
  if (kind === QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN) {
    return parseLineItemWithPlanPayload(payloadJson);
  }
  if (kind === QuoteWorkTemplateKind.STAGE_WITH_TASKS) {
    return parseStageWithTasksPayload(payloadJson);
  }
  if (kind === QuoteWorkTemplateKind.TASK) {
    return parseTaskOnlyPayload(payloadJson);
  }
  throw new Error("Unknown template kind.");
}

/** Re-parse and return strict JSON-serializable object for persistence. */
export function normalizePayloadJson(
  kind: QuoteWorkTemplateKind,
  payloadJson: unknown,
): Record<string, unknown> {
  const v = validatePayloadForKind(kind, payloadJson);
  return JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
}
