/**
 * Phase 4: quote acceptance and orchestration of job creation from sent snapshot v2 (commercial preview frozen; proposed work-plan seed for job rows).
 */
import { QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canActivateAcceptedQuoteAsJob, canMarkQuoteAccepted } from "@/lib/phase4-permissions";
import { sentQuoteSnapshotV2Schema } from "@/server/phase2/customer-preview";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import { markQuoteLifecycleSchema } from "@/server/phase2/validation";
import type { QuoteActionResult } from "@/server/phase2/quote-mutations";
import { zodActionFailure } from "@/server/phase2/quote-mutations";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { recordQuoteActivity } from "@/server/phase2/record-quote-activity";
import { initializeJobFromAcceptedQuoteInTransaction } from "@/server/phase4/job-activation";

function acceptanceBlockedReason(status: QuoteStatus): string | null {
  if (status === QuoteStatus.SENT) return null;
  if (status === QuoteStatus.ACCEPTED || status === QuoteStatus.ACTIVATED) {
    return "This quote is already past acceptance.";
  }
  if (status === QuoteStatus.DECLINED || status === QuoteStatus.REVISED) {
    return "Declined or revised quotes cannot be marked accepted from this action.";
  }
  return "Only a sent quote can be marked accepted.";
}

export async function quoteMutationMarkAccepted(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canMarkQuoteAccepted(ctx.role)) {
    return { ok: false, error: "You do not have permission to record quote acceptance." };
  }

  const parsed = markQuoteLifecycleSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };

  const blocked = acceptanceBlockedReason(quote.status);
  if (blocked) {
    return { ok: false, error: blocked };
  }

  const snap = sentQuoteSnapshotV2Schema.safeParse(quote.sentSnapshotJson);
  if (!snap.success) {
    return { ok: false, error: "Acceptance requires a valid sent snapshot (version 2)." };
  }

  const prevStatus = quote.status;
  const acceptedAt = new Date();
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: QuoteStatus.ACCEPTED,
      acceptedAt,
      acceptedBy: { connect: { id: ctx.userId } },
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_ACCEPTED,
    summary: `Quote #${quote.displayNumber} marked accepted (office record)`,
    payload: { quoteId: quote.id },
  });
  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_STATUS_CHANGED,
    summary: `Status: ${prevStatus} → ${QuoteStatus.ACCEPTED}`,
    payload: { fromStatus: prevStatus, toStatus: QuoteStatus.ACCEPTED },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationInitializeJobFromAcceptedQuote(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canActivateAcceptedQuoteAsJob(ctx.role)) {
    return { ok: false, error: "You do not have permission to create a job from an accepted quote." };
  }

  const parsed = markQuoteLifecycleSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const quoteId = parsed.data.quoteId;
  const existingJob = await prisma.job.findUnique({ where: { quoteId } });
  if (existingJob) {
    return { ok: false, error: "A job already exists for this quote." };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status !== QuoteStatus.ACCEPTED) {
    return { ok: false, error: "Create a job only from an accepted quote." };
  }

  const r = await initializeJobFromAcceptedQuoteInTransaction(ctx, quote);
  if (!r.ok) {
    return { ok: false, error: r.error };
  }
  return { ok: true, quoteId: quote.id, opportunityId: r.opportunityId, jobId: r.jobId };
}
