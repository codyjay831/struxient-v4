"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  quoteMutationAddAssumption,
  quoteMutationAddLineExecutionStage,
  quoteMutationAddLineExecutionTask,
  quoteMutationAddLineItem,
  quoteMutationAddTask,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationLogPreviewed,
  quoteMutationMarkLineRemoved,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
  quoteMutationRemoveAssumption,
  quoteMutationRemoveLineExecutionStage,
  quoteMutationUpdateAssumption,
  quoteMutationUpdateLineExecutionStage,
  quoteMutationUpdateLineExecutionTask,
  quoteMutationUpdateLineExecutionTaskStatus,
  quoteMutationUpdateLineItem,
  quoteMutationUpdateQuote,
  quoteMutationUpdateQuoteDraftBasics,
  quoteMutationUpdateQuoteDraftProposal,
  quoteMutationUpdateTask,
  quoteMutationUpdateTaskStatus,
  zodActionFailure,
} from "@/server/phase2/quote-mutations";
import { quoteMutationSendQuoteToCustomerByEmail } from "@/server/phase2/quote-send-email-mutation";
import type { QuoteActionResult } from "@/server/phase2/quote-mutations";
import {
  quoteMutationArchiveQuoteWorkTemplate,
  quoteMutationInsertLineItemTemplateIntoQuote,
  quoteMutationInsertStageTemplateIntoLine,
  quoteMutationInsertTaskTemplateIntoStage,
  quoteMutationSaveExecutionTaskAsTemplate,
  quoteMutationSaveLineItemAsTemplate,
  quoteMutationSaveStageAsTemplate,
} from "@/server/phase3/template-mutations";
import {
  quoteMutationInitializeJobFromAcceptedQuote,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import {
  createPortalAccessTokenForQuote,
  regeneratePortalTokenForQuote,
  revokeActivePortalTokenForQuote,
  type PortalTokenMutationResult,
} from "@/server/phase8/portal-token-mutations";
import { portalQuoteIdFormSchema } from "@/server/phase8/validation";
import { createQuoteDraftFromOpportunitySchema } from "@/server/phase2/validation";

export async function createQuoteDraftFromOpportunity(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const parsed = createQuoteDraftFromOpportunitySchema.safeParse({
    opportunityId: formData.get("opportunityId"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const r = await quoteMutationCreateDraftFromOpportunity(ctx, parsed.data.opportunityId);
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  if (r.outcome === "existing_draft") {
    redirect(`/app/sales/quotes/${r.quoteId}`);
  }

  revalidatePath(`/app/sales/opportunities/${r.opportunityId}`);
  revalidatePath("/app/sales/opportunities");
  revalidatePath(`/app/customers/${r.customerId}`);
  redirect(`/app/sales/quotes/${r.quoteId}`);
}

function revalidateQuote(quoteId: string) {
  revalidatePath(`/app/sales/quotes/${quoteId}`);
}

export async function updateQuote(_prev: QuoteActionResult | undefined, formData: FormData): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateQuote(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteDraftBasics(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateQuoteDraftBasics(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteDraftProposal(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateQuoteDraftProposal(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function addQuoteLineItem(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationAddLineItem(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteLineItem(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateLineItem(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function markQuoteLineRemoved(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationMarkLineRemoved(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function addQuoteTask(_prev: QuoteActionResult | undefined, formData: FormData): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationAddTask(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteTask(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateTask(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteTaskStatus(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateTaskStatus(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function addQuoteLineExecutionStage(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationAddLineExecutionStage(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteLineExecutionStage(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateLineExecutionStage(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function removeQuoteLineExecutionStage(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationRemoveLineExecutionStage(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function addQuoteLineExecutionTask(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationAddLineExecutionTask(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteLineExecutionTask(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateLineExecutionTask(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteLineExecutionTaskStatus(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateLineExecutionTaskStatus(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function addQuoteAssumption(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationAddAssumption(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function updateQuoteAssumption(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationUpdateAssumption(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function removeQuoteAssumption(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationRemoveAssumption(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function markQuoteReadyToSend(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationMarkReadyToSend(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function markQuoteSent(_prev: QuoteActionResult | undefined, formData: FormData): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationMarkSent(ctx, formData);
  if (r.ok && r.quoteId) {
    revalidateQuote(r.quoteId);
    if (r.opportunityId) {
      revalidatePath(`/app/sales/opportunities/${r.opportunityId}`);
    }
  }
  return r;
}

export async function sendQuoteToCustomerByEmail(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationSendQuoteToCustomerByEmail(ctx, formData);
  if (r.ok && r.quoteId) {
    revalidateQuote(r.quoteId);
    if (r.opportunityId) {
      revalidatePath(`/app/sales/opportunities/${r.opportunityId}`);
    }
    revalidatePath("/app/jobs");
  }
  if (!r.ok && "quoteId" in r && r.quoteId) {
    revalidateQuote(r.quoteId);
    revalidatePath("/app/jobs");
    if ("opportunityId" in r && r.opportunityId) {
      revalidatePath(`/app/sales/opportunities/${r.opportunityId}`);
    }
  }
  return r;
}

export async function markQuoteAccepted(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationMarkAccepted(ctx, formData);
  if (r.ok && r.quoteId) {
    revalidateQuote(r.quoteId);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function activateAcceptedQuoteAsJob(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationInitializeJobFromAcceptedQuote(ctx, formData);
  if (r.ok && r.quoteId) {
    revalidateQuote(r.quoteId);
    revalidatePath("/app/jobs");
    if (r.jobId) {
      revalidatePath(`/app/jobs/${r.jobId}`);
      redirect(`/app/jobs/${r.jobId}`);
    }
  }
  return r;
}

export async function logQuotePreviewed(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  return quoteMutationLogPreviewed(ctx, formData);
}

export async function saveLineItemAsTemplate(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationSaveLineItemAsTemplate(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function saveStageAsTemplate(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationSaveStageAsTemplate(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function saveExecutionTaskAsTemplate(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationSaveExecutionTaskAsTemplate(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function archiveQuoteWorkTemplate(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationArchiveQuoteWorkTemplate(ctx, formData);
  if (r.ok) {
    const qid = formData.get("quoteId");
    if (typeof qid === "string" && qid.trim()) revalidateQuote(qid.trim());
  }
  return r;
}

export async function insertLineItemTemplateIntoQuote(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationInsertLineItemTemplateIntoQuote(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function insertStageTemplateIntoLine(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationInsertStageTemplateIntoLine(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function insertTaskTemplateIntoStage(
  _prev: QuoteActionResult | undefined,
  formData: FormData,
): Promise<QuoteActionResult> {
  const ctx = await requireOrgSession();
  const r = await quoteMutationInsertTaskTemplateIntoStage(ctx, formData);
  if (r.ok && r.quoteId) revalidateQuote(r.quoteId);
  return r;
}

export async function createCustomerPortalLink(
  _prev: PortalTokenMutationResult | undefined,
  formData: FormData,
): Promise<PortalTokenMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = portalQuoteIdFormSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const r = await createPortalAccessTokenForQuote(ctx, parsed.data.quoteId);
  if (r.ok) {
    revalidateQuote(parsed.data.quoteId);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function revokeCustomerPortalLink(
  _prev: PortalTokenMutationResult | undefined,
  formData: FormData,
): Promise<PortalTokenMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = portalQuoteIdFormSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const r = await revokeActivePortalTokenForQuote(ctx, parsed.data.quoteId);
  if (r.ok) {
    revalidateQuote(parsed.data.quoteId);
    revalidatePath("/app/jobs");
  }
  return r;
}

export async function regenerateCustomerPortalLink(
  _prev: PortalTokenMutationResult | undefined,
  formData: FormData,
): Promise<PortalTokenMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = portalQuoteIdFormSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const r = await regeneratePortalTokenForQuote(ctx, parsed.data.quoteId);
  if (r.ok) {
    revalidateQuote(parsed.data.quoteId);
    revalidatePath("/app/jobs");
  }
  return r;
}
