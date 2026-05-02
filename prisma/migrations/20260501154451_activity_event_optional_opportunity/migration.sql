-- AlterTable
ALTER TABLE "OpportunityActivityEvent" ALTER COLUMN "opportunityId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "OpportunityActivityEvent_organizationId_customerId_createdA_idx" ON "OpportunityActivityEvent"("organizationId", "customerId", "createdAt");
