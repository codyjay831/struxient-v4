-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'WORK_PLAN_REVIEW';
COMMIT;

-- DropForeignKey
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_jobId_fkey";

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "activationBaselineJson" JSONB,
ALTER COLUMN "status" SET DEFAULT 'WORK_PLAN_REVIEW',
ALTER COLUMN "activatedAt" DROP NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobLine" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobStage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobTask" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduledWork" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "CustomerPortalSubmissionAttachment_organizationId_submissionId_" RENAME TO "CustomerPortalSubmissionAttachment_organizationId_submissio_idx";
