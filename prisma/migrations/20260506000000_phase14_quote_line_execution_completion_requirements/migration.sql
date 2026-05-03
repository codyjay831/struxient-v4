-- Phase 14: planned evidence completion requirements on quoted line execution tasks (frozen at send).
ALTER TABLE "QuoteLineExecutionTask" ADD COLUMN "completionRequirementsJson" JSONB;
