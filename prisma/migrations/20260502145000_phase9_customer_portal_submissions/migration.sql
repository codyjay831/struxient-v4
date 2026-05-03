-- CreateEnum
CREATE TYPE "CustomerPortalSubmissionType" AS ENUM ('GENERAL_REQUEST', 'AVAILABILITY_NOTE');

-- CreateEnum
CREATE TYPE "CustomerPortalSubmissionStatus" AS ENUM ('NEW', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "CustomerPortalSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quoteId" TEXT,
    "jobId" TEXT,
    "scheduledWorkId" TEXT,
    "portalAccessTokenId" TEXT,
    "type" "CustomerPortalSubmissionType" NOT NULL,
    "status" "CustomerPortalSubmissionStatus" NOT NULL DEFAULT 'NEW',
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "payloadJson" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPortalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPortalSubmission_organizationId_idx" ON "CustomerPortalSubmission"("organizationId");

-- CreateIndex
CREATE INDEX "CustomerPortalSubmission_organizationId_status_idx" ON "CustomerPortalSubmission"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CustomerPortalSubmission_organizationId_jobId_idx" ON "CustomerPortalSubmission"("organizationId", "jobId");

-- CreateIndex
CREATE INDEX "CustomerPortalSubmission_organizationId_quoteId_idx" ON "CustomerPortalSubmission"("organizationId", "quoteId");

-- CreateIndex
CREATE INDEX "CustomerPortalSubmission_organizationId_customerId_idx" ON "CustomerPortalSubmission"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "CustomerPortalSubmission_organizationId_createdAt_idx" ON "CustomerPortalSubmission"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_scheduledWorkId_fkey" FOREIGN KEY ("scheduledWorkId") REFERENCES "ScheduledWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_portalAccessTokenId_fkey" FOREIGN KEY ("portalAccessTokenId") REFERENCES "PortalAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalSubmission" ADD CONSTRAINT "CustomerPortalSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
