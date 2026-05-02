import { QuoteWorkTemplateKind } from "@prisma/client";
import { z } from "zod";

const nonEmptyId = z.string().trim().min(1, "Required");

export const saveQuoteWorkTemplateBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  tagsRaw: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((s) => (s?.trim() ? s.trim() : null)),
});

export const saveLineItemAsTemplateSchema = saveQuoteWorkTemplateBaseSchema.extend({
  quoteId: nonEmptyId,
  lineItemId: nonEmptyId,
});

export const saveStageAsTemplateSchema = saveQuoteWorkTemplateBaseSchema.extend({
  quoteId: nonEmptyId,
  lineItemId: nonEmptyId,
  stageId: nonEmptyId,
});

export const saveExecutionTaskAsTemplateSchema = saveQuoteWorkTemplateBaseSchema.extend({
  quoteId: nonEmptyId,
  stageId: nonEmptyId,
  taskId: nonEmptyId,
});

export const archiveQuoteWorkTemplateSchema = z.object({
  templateId: nonEmptyId,
});

export const insertLineItemTemplateSchema = z.object({
  quoteId: nonEmptyId,
  templateId: nonEmptyId,
});

export const insertStageTemplateSchema = z.object({
  quoteId: nonEmptyId,
  lineItemId: nonEmptyId,
  templateId: nonEmptyId,
});

export const insertTaskTemplateSchema = z.object({
  quoteId: nonEmptyId,
  stageId: nonEmptyId,
  templateId: nonEmptyId,
});

export const listTemplatesSchema = z.object({
  kind: z.nativeEnum(QuoteWorkTemplateKind).optional(),
});

export const updateQuoteWorkTemplateMetadataSchema = z.object({
  templateId: nonEmptyId,
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  tagsRaw: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((s) => (s?.trim() ? s.trim() : null)),
});

export const restoreQuoteWorkTemplateSchema = z.object({
  templateId: nonEmptyId,
});

export const templateLibrarySearchSchema = z.object({
  kind: z.preprocess(
    (v) => (v === "all" || v === "" || v == null ? undefined : v),
    z.nativeEnum(QuoteWorkTemplateKind).optional(),
  ),
  q: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined),
    z.string().max(200).optional(),
  ),
  status: z.enum(["active", "archived", "all"]).optional().default("active"),
  selected: z.string().trim().min(1).optional(),
});

export function parseTagsFromRaw(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.length > 40) continue;
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= 20) break;
  }
  return out;
}
