-- Phase 7: ScheduledWork — org-scoped job task time windows (calendar facts, not quote truth).

CREATE TYPE "ScheduledWorkStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED');
CREATE TYPE "ScheduledWorkType" AS ENUM ('JOB_TASK', 'JOB_VISIT');

CREATE TABLE "ScheduledWork" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "jobTaskId" TEXT NOT NULL,
    "type" "ScheduledWorkType" NOT NULL DEFAULT 'JOB_TASK',
    "status" "ScheduledWorkStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledWork_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledWork_jobTaskId_active_scheduled_key" ON "ScheduledWork" ("jobTaskId") WHERE "status" = 'SCHEDULED';

CREATE INDEX "ScheduledWork_organizationId_idx" ON "ScheduledWork"("organizationId");
CREATE INDEX "ScheduledWork_organizationId_scheduledStartAt_idx" ON "ScheduledWork"("organizationId", "scheduledStartAt");
CREATE INDEX "ScheduledWork_organizationId_jobId_idx" ON "ScheduledWork"("organizationId", "jobId");
CREATE INDEX "ScheduledWork_organizationId_jobTaskId_idx" ON "ScheduledWork"("organizationId", "jobTaskId");
CREATE INDEX "ScheduledWork_organizationId_status_idx" ON "ScheduledWork"("organizationId", "status");

ALTER TABLE "ScheduledWork" ADD CONSTRAINT "ScheduledWork_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledWork" ADD CONSTRAINT "ScheduledWork_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledWork" ADD CONSTRAINT "ScheduledWork_jobTaskId_fkey" FOREIGN KEY ("jobTaskId") REFERENCES "JobTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledWork" ADD CONSTRAINT "ScheduledWork_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledWork" ADD CONSTRAINT "ScheduledWork_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
