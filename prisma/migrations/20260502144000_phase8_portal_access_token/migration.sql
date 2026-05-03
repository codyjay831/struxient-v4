-- Phase 8: Customer portal — scoped access tokens (hash-only storage; one active token per quote).

CREATE TABLE "PortalAccessToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "jobId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalAccessToken_tokenHash_key" ON "PortalAccessToken"("tokenHash");

CREATE INDEX "PortalAccessToken_organizationId_idx" ON "PortalAccessToken"("organizationId");
CREATE INDEX "PortalAccessToken_organizationId_customerId_idx" ON "PortalAccessToken"("organizationId", "customerId");
CREATE INDEX "PortalAccessToken_organizationId_quoteId_idx" ON "PortalAccessToken"("organizationId", "quoteId");
CREATE INDEX "PortalAccessToken_organizationId_jobId_idx" ON "PortalAccessToken"("organizationId", "jobId");

ALTER TABLE "PortalAccessToken" ADD CONSTRAINT "PortalAccessToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccessToken" ADD CONSTRAINT "PortalAccessToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PortalAccessToken" ADD CONSTRAINT "PortalAccessToken_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccessToken" ADD CONSTRAINT "PortalAccessToken_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortalAccessToken" ADD CONSTRAINT "PortalAccessToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One non-revoked token per quote. Regeneration sets revokedAt on the prior row before inserting the next.
CREATE UNIQUE INDEX "PortalAccessToken_one_active_per_quote_idx" ON "PortalAccessToken"("quoteId") WHERE ("revokedAt" IS NULL);
