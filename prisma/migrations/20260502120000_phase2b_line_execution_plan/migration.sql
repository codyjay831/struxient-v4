-- Phase 2B: line-item-owned execution planning; QuoteTask is quote-prep only.
--
-- Orphan legacy planned execution (PLANNED_EXECUTION) rows:
-- Rows with no resolvable target line (quote has zero non-REMOVED QuoteLineItem rows) are DELETED
-- inside the migration DO block — they cannot be represented under the new model and are not
-- customer-facing. Rows that can be mapped to a line (explicit quoteLineItemId or first active
-- line by sortOrder) are migrated to QuoteLineExecutionStage + QuoteLineExecutionTask.
--
-- CreateTable
CREATE TABLE "QuoteLineExecutionStage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quoteLineItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLineExecutionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineExecutionTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuoteTaskStatus" NOT NULL DEFAULT 'NOT_READY',
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "assignedRole" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "customerVisible" BOOLEAN NOT NULL DEFAULT false,
    "customerLabel" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLineExecutionTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteLineExecutionStage_organizationId_idx" ON "QuoteLineExecutionStage"("organizationId");
CREATE INDEX "QuoteLineExecutionStage_quoteLineItemId_idx" ON "QuoteLineExecutionStage"("quoteLineItemId");
CREATE INDEX "QuoteLineExecutionStage_organizationId_quoteLineItemId_idx" ON "QuoteLineExecutionStage"("organizationId", "quoteLineItemId");

CREATE INDEX "QuoteLineExecutionTask_organizationId_idx" ON "QuoteLineExecutionTask"("organizationId");
CREATE INDEX "QuoteLineExecutionTask_stageId_idx" ON "QuoteLineExecutionTask"("stageId");

ALTER TABLE "QuoteLineExecutionStage" ADD CONSTRAINT "QuoteLineExecutionStage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteLineExecutionStage" ADD CONSTRAINT "QuoteLineExecutionStage_quoteLineItemId_fkey" FOREIGN KEY ("quoteLineItemId") REFERENCES "QuoteLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteLineExecutionTask" ADD CONSTRAINT "QuoteLineExecutionTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteLineExecutionTask" ADD CONSTRAINT "QuoteLineExecutionTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "QuoteLineExecutionStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate legacy PLANNED_EXECUTION rows: one stage per old task (preserves ordering and titles).
DO $$
DECLARE
  r RECORD;
  target_line TEXT;
  new_stage_id TEXT;
  stage_title TEXT;
  now_ts TIMESTAMP(3) := CURRENT_TIMESTAMP;
BEGIN
  FOR r IN
    SELECT * FROM "QuoteTask" WHERE "kind"::text = 'PLANNED_EXECUTION'
    ORDER BY "quoteId", COALESCE("quoteLineItemId", ''), "sortOrder", "id"
  LOOP
    target_line := r."quoteLineItemId";
    IF target_line IS NULL THEN
      SELECT li."id" INTO target_line
      FROM "QuoteLineItem" li
      WHERE li."quoteId" = r."quoteId" AND li."lineMode"::text <> 'REMOVED'
      ORDER BY li."sortOrder" ASC, li."id" ASC
      LIMIT 1;
    END IF;

    IF target_line IS NULL THEN
      DELETE FROM "QuoteTask" WHERE "id" = r."id";
      CONTINUE;
    END IF;

    new_stage_id := replace(gen_random_uuid()::text, '-', '');
    stage_title := COALESCE(NULLIF(trim(r."stageKey"), ''), 'Work phase');

    INSERT INTO "QuoteLineExecutionStage" (
      "id", "organizationId", "quoteLineItemId", "title", "sortOrder", "internalNotes", "createdAt", "updatedAt"
    ) VALUES (
      new_stage_id,
      r."organizationId",
      target_line,
      LEFT(stage_title, 500),
      r."sortOrder",
      NULL,
      now_ts,
      now_ts
    );

    INSERT INTO "QuoteLineExecutionTask" (
      "id",
      "organizationId",
      "stageId",
      "title",
      "description",
      "status",
      "isRequired",
      "sortOrder",
      "assignedRole",
      "estimatedDurationMinutes",
      "customerVisible",
      "customerLabel",
      "internalNotes",
      "createdAt",
      "updatedAt"
    ) VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      r."organizationId",
      new_stage_id,
      LEFT(r."title", 500),
      r."description",
      r."status",
      r."isRequired",
      0,
      r."assignedRole",
      r."estimatedDurationMinutes",
      r."customerVisible",
      r."customerLabel",
      r."internalNotes",
      now_ts,
      now_ts
    );

    DELETE FROM "QuoteTask" WHERE "id" = r."id";
  END LOOP;
END $$;

-- Drop quote-level line link on prep tasks (no longer modeled on QuoteTask).
ALTER TABLE "QuoteTask" DROP CONSTRAINT IF EXISTS "QuoteTask_quoteLineItemId_fkey";
ALTER TABLE "QuoteTask" DROP COLUMN IF EXISTS "quoteLineItemId";
ALTER TABLE "QuoteTask" DROP COLUMN IF EXISTS "stageKey";

-- Collapse QuoteTaskKind to QUOTE_PREP only.
CREATE TYPE "QuoteTaskKind_new" AS ENUM ('QUOTE_PREP');
ALTER TABLE "QuoteTask" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "QuoteTask" ALTER COLUMN "kind" TYPE "QuoteTaskKind_new" USING ('QUOTE_PREP'::"QuoteTaskKind_new");
DROP TYPE "QuoteTaskKind";
ALTER TYPE "QuoteTaskKind_new" RENAME TO "QuoteTaskKind";
ALTER TABLE "QuoteTask" ALTER COLUMN "kind" SET DEFAULT 'QUOTE_PREP'::"QuoteTaskKind";
