"use server";

import { revalidatePath } from "next/cache";
import { requireOrgSession } from "@/server/phase1/org-session";
import type { QuoteActionResult } from "@/server/phase2/quote-mutations";
import {
  quoteMutationArchiveQuoteWorkTemplate,
  quoteMutationRestoreQuoteWorkTemplate,
  quoteMutationUpdateQuoteWorkTemplateMetadata,
} from "@/server/phase3/template-mutations";

function revalidateLibrary() {
  revalidatePath("/app/sales/templates");
}

export async function archiveWorkTemplateFromLibrary(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationArchiveQuoteWorkTemplate(ctx, formData);
  if (r.ok) revalidateLibrary();
  return r;
}

export async function restoreWorkTemplateFromLibrary(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationRestoreQuoteWorkTemplate(ctx, formData);
  if (r.ok) revalidateLibrary();
  return r;
}

export async function updateWorkTemplateMetadataFromLibrary(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateQuoteWorkTemplateMetadata(ctx, formData);
  if (r.ok) revalidateLibrary();
  return r;
}
