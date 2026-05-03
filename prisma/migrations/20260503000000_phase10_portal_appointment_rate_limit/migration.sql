-- Phase 10: appointment confirmation enum + portal POST rate limit buckets

ALTER TYPE "CustomerPortalSubmissionType" ADD VALUE 'APPOINTMENT_CONFIRMATION';

CREATE TABLE "PortalActionRateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalActionRateLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalActionRateLimit_key_action_windowStart_key" ON "PortalActionRateLimit"("key", "action", "windowStart");
CREATE INDEX "PortalActionRateLimit_key_idx" ON "PortalActionRateLimit"("key");
CREATE INDEX "PortalActionRateLimit_windowStart_idx" ON "PortalActionRateLimit"("windowStart");
