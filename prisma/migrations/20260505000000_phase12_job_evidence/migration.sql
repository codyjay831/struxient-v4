-- Phase 12: JobEvidence (staff promotion + review; separate from portal intake status)

CREATE TYPE "JobEvidenceStatus" AS ENUM ('CANDIDATE', 'ACCEPTED', 'REJECTED');

CREATE TABLE "JobEvidence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobTaskId" TEXT,
    "sourceAttachmentId" TEXT,
    "status" "JobEvidenceStatus" NOT NULL DEFAULT 'CANDIDATE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "promotedByUserId" TEXT,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobEvidence_organizationId_idx" ON "JobEvidence"("organizationId");

CREATE INDEX "JobEvidence_organizationId_jobId_idx" ON "JobEvidence"("organizationId", "jobId");

CREATE INDEX "JobEvidence_organizationId_jobTaskId_idx" ON "JobEvidence"("organizationId", "jobTaskId");

CREATE INDEX "JobEvidence_organizationId_status_idx" ON "JobEvidence"("organizationId", "status");

CREATE INDEX "JobEvidence_organizationId_sourceAttachmentId_idx" ON "JobEvidence"("organizationId", "sourceAttachmentId");

CREATE UNIQUE INDEX "JobEvidence_source_job_task_unique"
ON "JobEvidence" ("sourceAttachmentId", "jobId", "jobTaskId")
WHERE "sourceAttachmentId" IS NOT NULL AND "jobTaskId" IS NOT NULL;

CREATE UNIQUE INDEX "JobEvidence_source_job_joblevel_unique"
ON "JobEvidence" ("sourceAttachmentId", "jobId")
WHERE "sourceAttachmentId" IS NOT NULL AND "jobTaskId" IS NULL;

ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_jobTaskId_fkey" FOREIGN KEY ("jobTaskId") REFERENCES "JobTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_sourceAttachmentId_fkey" FOREIGN KEY ("sourceAttachmentId") REFERENCES "CustomerPortalSubmissionAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_promotedByUserId_fkey" FOREIGN KEY ("promotedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobEvidence" ADD CONSTRAINT "JobEvidence_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
