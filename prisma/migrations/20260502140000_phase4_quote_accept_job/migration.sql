-- Phase 4: quote acceptance, job activation, job runtime tables

CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELED');
CREATE TYPE "JobTaskStatus" AS ENUM ('NOT_STARTED', 'READY', 'IN_PROGRESS', 'COMPLETE', 'BLOCKED');

ALTER TYPE "QuoteStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "QuoteStatus" ADD VALUE 'ACTIVATED';

ALTER TABLE "Quote" ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "acceptedByUserId" TEXT,
ADD COLUMN "activatedAt" TIMESTAMP(3),
ADD COLUMN "activatedByUserId" TEXT;

ALTER TABLE "Quote" ADD CONSTRAINT "Quote_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "displayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceSnapshotJson" JSONB NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Job_quoteId_key" ON "Job"("quoteId");
CREATE UNIQUE INDEX "Job_organizationId_displayNumber_key" ON "Job"("organizationId", "displayNumber");

CREATE TABLE "JobLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceQuoteLineItemId" TEXT,
    "title" TEXT NOT NULL,
    "customerDescription" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobStage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobLineId" TEXT NOT NULL,
    "sourceQuoteStageId" TEXT,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobLineId" TEXT NOT NULL,
    "jobStageId" TEXT NOT NULL,
    "sourceQuoteTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "JobTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "assignedRole" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "customerLabel" TEXT,
    "internalNotes" TEXT,
    "completionRequirementsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Job" ADD CONSTRAINT "Job_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobLine" ADD CONSTRAINT "JobLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobLine" ADD CONSTRAINT "JobLine_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobStage" ADD CONSTRAINT "JobStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobStage" ADD CONSTRAINT "JobStage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobStage" ADD CONSTRAINT "JobStage_jobLineId_fkey" FOREIGN KEY ("jobLineId") REFERENCES "JobLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_jobLineId_fkey" FOREIGN KEY ("jobLineId") REFERENCES "JobLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_jobStageId_fkey" FOREIGN KEY ("jobStageId") REFERENCES "JobStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Job_organizationId_idx" ON "Job"("organizationId");
CREATE INDEX "Job_organizationId_customerId_idx" ON "Job"("organizationId", "customerId");
CREATE INDEX "Job_organizationId_quoteId_idx" ON "Job"("organizationId", "quoteId");

CREATE INDEX "JobLine_organizationId_idx" ON "JobLine"("organizationId");
CREATE INDEX "JobLine_organizationId_jobId_idx" ON "JobLine"("organizationId", "jobId");

CREATE INDEX "JobStage_organizationId_idx" ON "JobStage"("organizationId");
CREATE INDEX "JobStage_organizationId_jobId_idx" ON "JobStage"("organizationId", "jobId");
CREATE INDEX "JobStage_organizationId_jobLineId_idx" ON "JobStage"("organizationId", "jobLineId");

CREATE INDEX "JobTask_organizationId_idx" ON "JobTask"("organizationId");
CREATE INDEX "JobTask_organizationId_jobId_idx" ON "JobTask"("organizationId", "jobId");
CREATE INDEX "JobTask_organizationId_jobStageId_idx" ON "JobTask"("organizationId", "jobStageId");
