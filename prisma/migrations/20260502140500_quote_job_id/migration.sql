-- Optional denormalized link to Job (mirrors Job.id after activation).
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Quote_jobId_key" ON "Quote"("jobId");
ALTER TABLE "Quote" DROP CONSTRAINT IF EXISTS "Quote_jobId_fkey";
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
