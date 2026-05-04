import { Prisma, QuoteStatus } from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canCreateCustomerPortalLink } from "@/lib/phase8-permissions";
import { isQuoteStructurallyLocked } from "@/lib/quote-lifecycle";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { absolutePortalUrl, describePublicAppBaseUrlForQuoteEmail } from "@/server/email/public-app-url";
import { buildQuoteProposalEmailContent } from "@/server/email/quote-proposal-email-content";
import {
  describeQuoteEmailInfrastructure,
  sendTransactionalEmail,
} from "@/server/email/transactional";
import {
  buildInternalExecutionPlanFromLineItems,
  buildQuoteCustomerPreviewDTO,
  parseValidatedSentQuoteSnapshot,
} from "@/server/phase2/customer-preview";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import { getQuoteWorkspace } from "@/server/phase2/quote-queries";
import { allQuoteSendBlockersPass, evaluateQuoteSendReadiness } from "@/server/phase2/quote-readiness";
import { resolveQuoteSendRecipientEmail } from "@/server/phase2/quote-send-email-recipient";
import { recordQuoteActivity } from "@/server/phase2/record-quote-activity";
import { markQuoteLifecycleSchema } from "@/server/phase2/validation";
import type { QuoteActionResult } from "@/server/phase2/quote-mutations";
import { validateQuoteLineTasksCompletionRequirementsForSend } from "@/server/phase14/quote-completion-requirements";
import { createPortalAccessTokenForQuote } from "@/server/phase8/portal-token-mutations";
import { findActivePortalTokenForQuote } from "@/server/phase8/portal-token-queries";

function zodActionFailure(error: ZodError): { error: string; fieldErrors: Record<string, string[]> } {
  return {
    error: error.issues[0]?.message ?? "Invalid input",
    fieldErrors: error.flatten().fieldErrors as unknown as Record<string, string[]>,
  };
}

export type SendQuoteEmailActionResult =
  | (QuoteActionResult & { ok: true })
  | (QuoteActionResult & { ok: false; emailDeliveryFailed?: boolean });

function sanitizeEmailErrorMessage(msg: string): string {
  return msg.replace(/\s+/g, " ").trim().slice(0, 280);
}

/**
 * Validates, finalizes SENT + v2 snapshot, creates portal token, sends transactional email with portal URL.
 * If the provider fails after the quote is marked SENT, returns `emailDeliveryFailed` so the UI can surface it.
 */
export async function quoteMutationSendQuoteToCustomerByEmail(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<SendQuoteEmailActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  if (!canCreateCustomerPortalLink(ctx.role)) {
    return { ok: false, error: "You do not have permission to create customer portal links for this proposal." };
  }

  const parsed = markQuoteLifecycleSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const infra = describeQuoteEmailInfrastructure();
  if (!infra.ok) {
    return { ok: false, error: infra.message };
  }
  const publicBase = describePublicAppBaseUrlForQuoteEmail();
  if (!publicBase.ok) {
    return { ok: false, error: publicBase.message };
  }

  const full = await getQuoteWorkspace(ctx.organizationId, parsed.data.quoteId);
  if (!full) return { ok: false, error: "Quote not found." };
  if (isQuoteStructurallyLocked(full.status)) {
    return { ok: false, error: "This quote was already sent. Use the customer portal section to copy or regenerate the link." };
  }

  const items = evaluateQuoteSendReadiness({
    quote: full,
    opportunity: full.opportunity,
    customerContacts: full.customer.contactMethods,
    lineItems: full.lineItems,
    quoteTasks: full.tasks,
    assumptions: full.assumptions,
  });
  if (!allQuoteSendBlockersPass(items)) {
    const blockers = items.filter((i) => i.severity === "BLOCKER" && i.status === "FAIL");
    return {
      ok: false,
      error: `Cannot send: ${blockers.map((b) => b.label).join("; ") || "resolve blockers"}.`,
    };
  }

  const completionSend = validateQuoteLineTasksCompletionRequirementsForSend(full.lineItems);
  if (!completionSend.ok) {
    return { ok: false, error: completionSend.error };
  }

  const recipient = resolveQuoteSendRecipientEmail(full.customer.contactMethods);
  if (!recipient.ok) {
    return { ok: false, error: recipient.error };
  }

  const sentAt = new Date();
  const preview = buildQuoteCustomerPreviewDTO({
    organizationName: ctx.organizationName,
    quote: full,
    customer: full.customer,
    lineItems: full.lineItems,
    assumptions: full.assumptions,
    asOfDate: sentAt,
  });
  const internalExecutionPlan = buildInternalExecutionPlanFromLineItems(full.lineItems);
  const snapshot = {
    version: 2 as const,
    sentAt: sentAt.toISOString(),
    quoteId: full.id,
    displayNumber: full.displayNumber,
    preview,
    internalExecutionPlan,
  };
  const validated = parseValidatedSentQuoteSnapshot(snapshot);
  if (!validated) {
    return { ok: false, error: "Quote could not be sent: snapshot validation failed." };
  }

  const prevStatus = full.status;

  await prisma.quote.update({
    where: { id: full.id },
    data: {
      status: QuoteStatus.SENT,
      sentAt,
      sentSnapshotJson: validated as unknown as Prisma.InputJsonValue,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: full.id,
    opportunityId: full.opportunityId,
    customerId: full.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_STATUS_CHANGED,
    summary: `Status: ${prevStatus} → ${QuoteStatus.SENT}`,
    payload: { fromStatus: prevStatus, toStatus: QuoteStatus.SENT, deliveryChannel: "EMAIL" },
  });

  const portal = await createPortalAccessTokenForQuote(ctx, full.id);
  if (!portal.ok || !portal.portalPath) {
    const portalError = portal.ok ? "Unknown error" : portal.error;
    await recordQuoteActivity(prisma, {
      organizationId: ctx.organizationId,
      quoteId: full.id,
      opportunityId: full.opportunityId,
      customerId: full.customerId,
      actorUserId: ctx.userId,
      eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_FAILED,
      summary: "Proposal email not delivered: portal link could not be created",
      payload: {
        recipientEmail: recipient.email,
        errorSummary: sanitizeEmailErrorMessage(portalError),
        stage: "PORTAL_TOKEN",
      },
    });
    return {
      ok: false,
      error:
        portalError ||
        "The quote was marked sent, but a secure customer link could not be created. Create a portal link manually from Customer portal, or contact support.",
      quoteId: full.id,
      opportunityId: full.opportunityId,
      emailDeliveryFailed: true,
    };
  }

  const absolute = absolutePortalUrl(portal.portalPath);
  if (!absolute) {
    await recordQuoteActivity(prisma, {
      organizationId: ctx.organizationId,
      quoteId: full.id,
      opportunityId: full.opportunityId,
      customerId: full.customerId,
      actorUserId: ctx.userId,
      eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_FAILED,
      summary: "Proposal email not delivered: public app URL misconfigured",
      payload: { recipientEmail: recipient.email, stage: "PUBLIC_URL", errorSummary: "Missing STRUXIENT_PUBLIC_APP_URL" },
    });
    return {
      ok: false,
      error:
        "The quote was marked sent, but the public app URL is not configured, so the customer link could not be built for email. Set STRUXIENT_PUBLIC_APP_URL and resend manually from Customer portal.",
      quoteId: full.id,
      opportunityId: full.opportunityId,
      emailDeliveryFailed: true,
    };
  }

  const content = buildQuoteProposalEmailContent({
    organizationName: ctx.organizationName,
    customerDisplayName: full.customer.displayName,
    quoteDisplayNumber: full.displayNumber,
    portalAbsoluteUrl: absolute,
    replyToStaffEmail: ctx.email,
  });

  const send = await sendTransactionalEmail({
    to: recipient.email,
    replyTo: content.replyTo,
    subject: content.subject,
    html: content.html,
    text: content.text,
    metadata: {
      quoteDisplayNumber: String(full.displayNumber),
      organizationId: ctx.organizationId,
    },
  });

  const activeToken = await findActivePortalTokenForQuote(ctx.organizationId, full.id);

  if (!send.ok) {
    await recordQuoteActivity(prisma, {
      organizationId: ctx.organizationId,
      quoteId: full.id,
      opportunityId: full.opportunityId,
      customerId: full.customerId,
      actorUserId: ctx.userId,
      eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_FAILED,
      summary: "Proposal email delivery failed after the quote was marked sent",
      payload: {
        recipientEmail: recipient.email,
        errorSummary: sanitizeEmailErrorMessage(send.error),
        portalAccessTokenId: activeToken?.id ?? null,
        stage: "PROVIDER",
      },
    });
    return {
      ok: false,
      error: `The quote was marked sent, but email delivery failed: ${send.error} Use Customer portal to copy the secure link and send it manually.`,
      quoteId: full.id,
      opportunityId: full.opportunityId,
      emailDeliveryFailed: true,
    };
  }

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: full.id,
    opportunityId: full.opportunityId,
    customerId: full.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_SENT,
    summary: `Proposal sent by email to ${recipient.email}`,
    payload: {
      quoteId: full.id,
      recordMethod: "EMAIL",
      recipientEmail: recipient.email,
      provider: send.provider,
      providerMessageId: send.providerMessageId,
      emailDeliveryMode: send.mode,
      portalAccessTokenId: activeToken?.id ?? null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: full.id,
    opportunityId: full.opportunityId,
    customerId: full.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_SENT,
    summary: `Transactional email accepted by provider (${send.mode})`,
    payload: {
      recipientEmail: recipient.email,
      providerMessageId: send.providerMessageId,
      portalAccessTokenId: activeToken?.id ?? null,
    },
  });

  return { ok: true, quoteId: full.id, opportunityId: full.opportunityId };
}
