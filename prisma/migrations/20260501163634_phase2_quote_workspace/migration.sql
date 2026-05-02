-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'MISSING_INFO', 'NEEDS_REVIEW', 'READY_TO_SEND', 'SENT', 'REVISED', 'DECLINED');

-- CreateEnum
CREATE TYPE "QuoteLineMode" AS ENUM ('REQUIRED', 'OPTIONAL', 'ALTERNATE', 'ALLOWANCE', 'REMOVED');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FIXED_PRICE', 'PRICE_ON_REQUEST', 'ALLOWANCE', 'INCLUDED', 'NO_CHARGE');

-- CreateEnum
CREATE TYPE "QuoteTaskKind" AS ENUM ('QUOTE_PREP', 'PLANNED_EXECUTION');

-- CreateEnum
CREATE TYPE "QuoteTaskStatus" AS ENUM ('NOT_READY', 'READY', 'IN_PROGRESS', 'BLOCKED', 'WAITING', 'NEEDS_REVIEW', 'COMPLETE', 'SKIPPED', 'CANCELED');

-- CreateEnum
CREATE TYPE "QuoteAssumptionVisibility" AS ENUM ('CUSTOMER_VISIBLE', 'INTERNAL_ONLY');

-- AlterEnum
ALTER TYPE "OpportunityStatus" ADD VALUE 'QUOTE_DRAFT_CREATED';

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "displayNumber" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "serviceAddressText" TEXT,
    "serviceAddressTbd" BOOLEAN NOT NULL DEFAULT false,
    "scopeIntent" TEXT NOT NULL,
    "scopeSummary" TEXT,
    "customerFacingIntro" TEXT,
    "internalNotes" TEXT,
    "pricingSubtotalCents" INTEGER,
    "totalCents" INTEGER,
    "sentAt" TIMESTAMP(3),
    "sentSnapshotJson" JSONB,
    "createdById" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerDescription" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPriceCents" INTEGER,
    "lineTotalCents" INTEGER,
    "pricingMode" "PricingMode" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineMode" "QuoteLineMode" NOT NULL DEFAULT 'REQUIRED',
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteLineItemId" TEXT,
    "kind" "QuoteTaskKind" NOT NULL,
    "stageKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuoteTaskStatus" NOT NULL DEFAULT 'NOT_READY',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "assignedRole" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "customerLabel" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAssumption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteLineItemId" TEXT,
    "visibility" "QuoteAssumptionVisibility" NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteAssumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteActivityEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "customerId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quote_organizationId_idx" ON "Quote"("organizationId");

-- CreateIndex
CREATE INDEX "Quote_organizationId_opportunityId_idx" ON "Quote"("organizationId", "opportunityId");

-- CreateIndex
CREATE INDEX "Quote_organizationId_customerId_idx" ON "Quote"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Quote_organizationId_status_idx" ON "Quote"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Quote_organizationId_updatedAt_idx" ON "Quote"("organizationId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_organizationId_displayNumber_key" ON "Quote"("organizationId", "displayNumber");

-- CreateIndex
CREATE INDEX "QuoteLineItem_organizationId_idx" ON "QuoteLineItem"("organizationId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_quoteId_idx" ON "QuoteLineItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_organizationId_quoteId_idx" ON "QuoteLineItem"("organizationId", "quoteId");

-- CreateIndex
CREATE INDEX "QuoteTask_organizationId_idx" ON "QuoteTask"("organizationId");

-- CreateIndex
CREATE INDEX "QuoteTask_quoteId_idx" ON "QuoteTask"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteTask_organizationId_quoteId_idx" ON "QuoteTask"("organizationId", "quoteId");

-- CreateIndex
CREATE INDEX "QuoteAssumption_organizationId_idx" ON "QuoteAssumption"("organizationId");

-- CreateIndex
CREATE INDEX "QuoteAssumption_quoteId_idx" ON "QuoteAssumption"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteActivityEvent_organizationId_quoteId_createdAt_idx" ON "QuoteActivityEvent"("organizationId", "quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteActivityEvent_eventType_createdAt_idx" ON "QuoteActivityEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTask" ADD CONSTRAINT "QuoteTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTask" ADD CONSTRAINT "QuoteTask_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTask" ADD CONSTRAINT "QuoteTask_quoteLineItemId_fkey" FOREIGN KEY ("quoteLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAssumption" ADD CONSTRAINT "QuoteAssumption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAssumption" ADD CONSTRAINT "QuoteAssumption_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAssumption" ADD CONSTRAINT "QuoteAssumption_quoteLineItemId_fkey" FOREIGN KEY ("quoteLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteActivityEvent" ADD CONSTRAINT "QuoteActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteActivityEvent" ADD CONSTRAINT "QuoteActivityEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
