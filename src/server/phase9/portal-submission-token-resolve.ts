import { QuoteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { parseSentSnapshotPreviewDto } from "@/server/phase2/customer-preview";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import { findPortalAccessTokenByTokenHash } from "@/server/phase8/portal-token-queries";

const POST_SEND: QuoteStatus[] = [QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.ACTIVATED];

/**
 * Resolves portal bearer scope for a customer submission POST.
 * Same eligibility as the portal GET view, without updating `lastViewedAt`.
 * Invalid tokens return null (fail closed with generic errors upstream).
 *
 * Future: rate-limit by IP + token hash; see portal-projection GET hardening note.
 */
export type ResolvedPortalSubmissionScope = {
  portalAccessTokenId: string;
  organizationId: string;
  customerId: string;
  quoteId: string;
  jobId: string | null;
};

export async function resolvePortalTokenForSubmission(rawToken: string): Promise<ResolvedPortalSubmissionScope | null> {
  const trimmed = rawToken?.trim();
  if (!trimmed) return null;

  const tokenHash = hashPortalToken(trimmed);
  const row = await findPortalAccessTokenByTokenHash(tokenHash);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const quoteRow = row.quote;
  if (quoteRow.organizationId !== row.organizationId) return null;
  if (quoteRow.customerId !== row.customerId) return null;
  if (!POST_SEND.includes(quoteRow.status)) return null;
  if (row.jobId && quoteRow.jobId && row.jobId !== quoteRow.jobId) return null;

  if (!parseSentSnapshotPreviewDto(quoteRow.sentSnapshotJson)) return null;

  const effectiveJobId = row.jobId ?? quoteRow.jobId ?? null;
  if (effectiveJobId) {
    const job = await prisma.job.findFirst({
      where: {
        id: effectiveJobId,
        organizationId: row.organizationId,
        quoteId: quoteRow.id,
        customerId: row.customerId,
      },
      select: { id: true },
    });
    if (!job) return null;
  }

  return {
    portalAccessTokenId: row.id,
    organizationId: row.organizationId,
    customerId: row.customerId,
    quoteId: quoteRow.id,
    jobId: effectiveJobId,
  };
}
