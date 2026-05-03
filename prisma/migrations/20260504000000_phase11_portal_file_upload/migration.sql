-- Phase 11: customer portal file upload intake + attachment metadata

ALTER TYPE "CustomerPortalSubmissionType" ADD VALUE 'FILE_UPLOAD';

CREATE TYPE "CustomerPortalSubmissionAttachmentStatus" AS ENUM ('STORED', 'REJECTED', 'DELETED');

CREATE TABLE "CustomerPortalSubmissionAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sanitizedFilename" TEXT,
    "contentType" TEXT NOT NULL,
    "detectedContentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "status" "CustomerPortalSubmissionAttachmentStatus" NOT NULL DEFAULT 'STORED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPortalSubmissionAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerPortalSubmissionAttachment_organizationId_idx" ON "CustomerPortalSubmissionAttachment"("organizationId");

CREATE INDEX "CustomerPortalSubmissionAttachment_organizationId_submissionId_idx" ON "CustomerPortalSubmissionAttachment"("organizationId", "submissionId");

CREATE INDEX "CustomerPortalSubmissionAttachment_organizationId_status_idx" ON "CustomerPortalSubmissionAttachment"("organizationId", "status");

ALTER TABLE "CustomerPortalSubmissionAttachment" ADD CONSTRAINT "CustomerPortalSubmissionAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerPortalSubmissionAttachment" ADD CONSTRAINT "CustomerPortalSubmissionAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CustomerPortalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
