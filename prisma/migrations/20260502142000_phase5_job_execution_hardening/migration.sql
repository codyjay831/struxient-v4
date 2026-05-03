-- Phase 5: job activity timeline, job lifecycle fields, task status metadata

CREATE TABLE "JobActivityEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobActivityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Job" ADD COLUMN "statusReason" TEXT,
ADD COLUMN "pausedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "canceledAt" TIMESTAMP(3);

ALTER TABLE "JobTask" ADD COLUMN "blockedReason" TEXT,
ADD COLUMN "lastStatusChangedAt" TIMESTAMP(3),
ADD COLUMN "lastStatusChangedByUserId" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completedByUserId" TEXT;

ALTER TABLE "JobActivityEvent" ADD CONSTRAINT "JobActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobActivityEvent" ADD CONSTRAINT "JobActivityEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobActivityEvent" ADD CONSTRAINT "JobActivityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_lastStatusChangedByUserId_fkey" FOREIGN KEY ("lastStatusChangedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "JobActivityEvent_organizationId_idx" ON "JobActivityEvent"("organizationId");
CREATE INDEX "JobActivityEvent_organizationId_jobId_idx" ON "JobActivityEvent"("organizationId", "jobId");
CREATE INDEX "JobActivityEvent_organizationId_createdAt_idx" ON "JobActivityEvent"("organizationId", "createdAt");
CREATE INDEX "JobActivityEvent_organizationId_jobId_createdAt_idx" ON "JobActivityEvent"("organizationId", "jobId", "createdAt");

CREATE INDEX "Job_organizationId_status_idx" ON "Job"("organizationId", "status");
