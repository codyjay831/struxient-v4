-- Phase 3A: organization-scoped quote/work templates (copy-only seeds).

CREATE TYPE "QuoteWorkTemplateKind" AS ENUM ('LINE_ITEM_WITH_PLAN', 'STAGE_WITH_TASKS', 'TASK');

CREATE TABLE "QuoteWorkTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "QuoteWorkTemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tagsJson" JSONB,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "payloadJson" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteWorkTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteWorkTemplate_organizationId_idx" ON "QuoteWorkTemplate"("organizationId");
CREATE INDEX "QuoteWorkTemplate_organizationId_kind_idx" ON "QuoteWorkTemplate"("organizationId", "kind");
CREATE INDEX "QuoteWorkTemplate_organizationId_archivedAt_idx" ON "QuoteWorkTemplate"("organizationId", "archivedAt");

ALTER TABLE "QuoteWorkTemplate" ADD CONSTRAINT "QuoteWorkTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteWorkTemplate" ADD CONSTRAINT "QuoteWorkTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuoteLineItem" ADD COLUMN "sourceTemplateId" TEXT;
ALTER TABLE "QuoteLineItem" ADD COLUMN "sourceTemplateKind" "QuoteWorkTemplateKind";
ALTER TABLE "QuoteLineItem" ADD COLUMN "sourceTemplateVersion" INTEGER;
ALTER TABLE "QuoteLineItem" ADD COLUMN "sourceTemplateName" TEXT;
