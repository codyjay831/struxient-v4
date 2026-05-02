-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('PERSON', 'COMPANY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomerContactType" AS ENUM ('EMAIL', 'PHONE', 'MOBILE', 'OTHER');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('NEW', 'QUALIFIED', 'INFO_GATHERING', 'SITE_VISIT_NEEDED', 'QUOTE_DRAFT_READY', 'LOST', 'NO_QUOTE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OpportunityPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "OpportunityTaskStatus" AS ENUM ('NOT_READY', 'READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'NEEDS_REVIEW', 'COMPLETE', 'CANCELED');

-- CreateEnum
CREATE TYPE "OpportunityTaskKind" AS ENUM ('INTAKE', 'SITE_VISIT', 'REVIEW', 'FOLLOW_UP', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MembershipRole" ADD VALUE 'MANAGER';
ALTER TYPE "MembershipRole" ADD VALUE 'OFFICE';
ALTER TYPE "MembershipRole" ADD VALUE 'SALES';
ALTER TYPE "MembershipRole" ADD VALUE 'CREW_LEAD';
ALTER TYPE "MembershipRole" ADD VALUE 'FIELD_WORKER';

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" "CustomerKind" NOT NULL DEFAULT 'UNKNOWN',
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerContactMethod" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "okToEmail" BOOLEAN NOT NULL DEFAULT false,
    "okToSms" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerContactMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'NEW',
    "priority" "OpportunityPriority" NOT NULL DEFAULT 'NORMAL',
    "serviceAddressText" TEXT,
    "serviceAddressTbd" BOOLEAN NOT NULL DEFAULT false,
    "contactIntakeWaived" BOOLEAN NOT NULL DEFAULT false,
    "scopeIntent" TEXT NOT NULL,
    "desiredTimeline" TEXT,
    "salesOwnerUserId" TEXT,
    "qualificationStatus" TEXT,
    "estimatedValue" DECIMAL(12,2),
    "lostReason" TEXT,
    "noQuoteReason" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityTask" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "OpportunityTaskStatus" NOT NULL DEFAULT 'NOT_READY',
    "kind" "OpportunityTaskKind" NOT NULL DEFAULT 'INTAKE',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "assigneeUserId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityActivityEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "customerId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_updatedAt_idx" ON "Customer"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerContactMethod_customerId_idx" ON "CustomerContactMethod"("customerId");

-- CreateIndex
CREATE INDEX "CustomerContactMethod_customerId_archivedAt_idx" ON "CustomerContactMethod"("customerId", "archivedAt");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_idx" ON "Opportunity"("organizationId");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_customerId_idx" ON "Opportunity"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_status_idx" ON "Opportunity"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Opportunity_organizationId_updatedAt_idx" ON "Opportunity"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityTask_opportunityId_idx" ON "OpportunityTask"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityTask_opportunityId_status_idx" ON "OpportunityTask"("opportunityId", "status");

-- CreateIndex
CREATE INDEX "OpportunityActivityEvent_organizationId_opportunityId_creat_idx" ON "OpportunityActivityEvent"("organizationId", "opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityActivityEvent_eventType_createdAt_idx" ON "OpportunityActivityEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerContactMethod" ADD CONSTRAINT "CustomerContactMethod_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_salesOwnerUserId_fkey" FOREIGN KEY ("salesOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTask" ADD CONSTRAINT "OpportunityTask_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTask" ADD CONSTRAINT "OpportunityTask_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivityEvent" ADD CONSTRAINT "OpportunityActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivityEvent" ADD CONSTRAINT "OpportunityActivityEvent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivityEvent" ADD CONSTRAINT "OpportunityActivityEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActivityEvent" ADD CONSTRAINT "OpportunityActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
