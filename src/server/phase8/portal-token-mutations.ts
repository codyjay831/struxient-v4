/**
 * Customer portal bearer tokens: long-lived by default (no `expiresAt` unless set later).
 * Revocation is the primary off switch. Future hardening: optional org-level expiry, rate limits on resolve.
 */
import { Prisma, QuoteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { parseSentSnapshotPreviewDto } from "@/server/phase2/customer-preview";
import { canCreateCustomerPortalLink, canRevokeOrRegenerateCustomerPortalLink } from "@/lib/phase8-permissions";
import { generateRawPortalToken, hashPortalToken } from "@/server/phase8/portal-token-crypto";
import { findActivePortalTokenForQuote } from "@/server/phase8/portal-token-queries";

const POST_SEND: QuoteStatus[] = [QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.ACTIVATED];

export type PortalTokenMutationResult =
  | { ok: true; portalPath?: string }
  | { ok: false; error: string };

async function recordPortalAudit(params: {
  organizationId: string;
  actorUserId: string;
  type: "PORTAL_TOKEN_CREATED" | "PORTAL_TOKEN_REVOKED" | "PORTAL_TOKEN_REGENERATED";
  payload: Record<string, string>;
}) {
  await prisma.auditEvent.create({
    data: {
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      type: params.type,
      payload: params.payload,
    },
  });
}

async function assertQuoteEligibleForPortal(organizationId: string, quoteId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId },
    select: {
      id: true,
      customerId: true,
      status: true,
      jobId: true,
      sentSnapshotJson: true,
    },
  });
  if (!quote) {
    return { ok: false as const, error: "Quote not found." };
  }
  if (!POST_SEND.includes(quote.status)) {
    return { ok: false as const, error: "Portal links can only be created after the proposal is sent." };
  }
  const preview = parseSentSnapshotPreviewDto(quote.sentSnapshotJson);
  if (!preview) {
    return {
      ok: false as const,
      error: "This proposal does not have a valid customer snapshot. Contact support before sharing a portal link.",
    };
  }
  return { ok: true as const, quote };
}

export async function createPortalAccessTokenForQuote(
  ctx: OrgSessionContext,
  quoteId: string,
): Promise<PortalTokenMutationResult> {
  if (!canCreateCustomerPortalLink(ctx.role)) {
    return { ok: false, error: "You do not have permission to create customer portal links." };
  }

  const eligible = await assertQuoteEligibleForPortal(ctx.organizationId, quoteId);
  if (!eligible.ok) return eligible;

  const existing = await findActivePortalTokenForQuote(ctx.organizationId, quoteId);
  if (existing) {
    return {
      ok: false,
      error: "An active portal link already exists for this proposal. Regenerate the link to replace it.",
    };
  }

  const raw = generateRawPortalToken();
  const tokenHash = hashPortalToken(raw);

  try {
    await prisma.portalAccessToken.create({
      data: {
        organizationId: ctx.organizationId,
        customerId: eligible.quote.customerId,
        quoteId: eligible.quote.id,
        jobId: eligible.quote.jobId,
        tokenHash,
        createdByUserId: ctx.userId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: "An active portal link already exists for this proposal. Regenerate the link to replace it.",
      };
    }
    throw e;
  }

  await recordPortalAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    type: "PORTAL_TOKEN_CREATED",
    payload: { quoteId: eligible.quote.id },
  });

  return { ok: true, portalPath: `/portal/${raw}` };
}

export async function revokeActivePortalTokenForQuote(
  ctx: OrgSessionContext,
  quoteId: string,
): Promise<PortalTokenMutationResult> {
  if (!canRevokeOrRegenerateCustomerPortalLink(ctx.role)) {
    return { ok: false, error: "You do not have permission to revoke portal links." };
  }

  const active = await findActivePortalTokenForQuote(ctx.organizationId, quoteId);
  if (!active) {
    return { ok: false, error: "No active portal link was found for this proposal." };
  }

  await prisma.portalAccessToken.update({
    where: { id: active.id },
    data: { revokedAt: new Date() },
  });

  await recordPortalAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    type: "PORTAL_TOKEN_REVOKED",
    payload: { quoteId },
  });

  return { ok: true };
}

export async function regeneratePortalTokenForQuote(
  ctx: OrgSessionContext,
  quoteId: string,
): Promise<PortalTokenMutationResult> {
  if (!canRevokeOrRegenerateCustomerPortalLink(ctx.role)) {
    return { ok: false, error: "You do not have permission to regenerate portal links." };
  }

  const eligible = await assertQuoteEligibleForPortal(ctx.organizationId, quoteId);
  if (!eligible.ok) return eligible;

  const raw = generateRawPortalToken();
  const tokenHash = hashPortalToken(raw);

  await prisma.$transaction(async (tx) => {
    await tx.portalAccessToken.updateMany({
      where: { organizationId: ctx.organizationId, quoteId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.portalAccessToken.create({
      data: {
        organizationId: ctx.organizationId,
        customerId: eligible.quote.customerId,
        quoteId: eligible.quote.id,
        jobId: eligible.quote.jobId,
        tokenHash,
        createdByUserId: ctx.userId,
      },
    });
  });

  await recordPortalAudit({
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    type: "PORTAL_TOKEN_REGENERATED",
    payload: { quoteId: eligible.quote.id },
  });

  return { ok: true, portalPath: `/portal/${raw}` };
}

/**
 * When a job is created after the portal token, attach jobId to the active token row.
 * Org-scoped only; callers must already have verified staff access to the quote/job.
 */
export async function syncActivePortalTokenJobIdForQuote(organizationId: string, quoteId: string): Promise<void> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId },
    select: { jobId: true },
  });
  if (!quote?.jobId) return;

  await prisma.portalAccessToken.updateMany({
    where: {
      organizationId,
      quoteId,
      revokedAt: null,
      jobId: null,
    },
    data: { jobId: quote.jobId },
  });
}
