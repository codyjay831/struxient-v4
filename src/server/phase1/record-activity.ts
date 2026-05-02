import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecordActivityInput } from "./activity-events";

export async function recordBusinessActivity(
  db: Prisma.TransactionClient | typeof prisma,
  input: RecordActivityInput,
) {
  if (!input.opportunityId && !input.customerId) {
    throw new Error("recordBusinessActivity requires opportunityId and/or customerId");
  }
  await db.opportunityActivityEvent.create({
    data: {
      organizationId: input.organizationId,
      opportunityId: input.opportunityId ?? null,
      customerId: input.customerId ?? null,
      eventType: input.eventType,
      actorUserId: input.actorUserId,
      summary: input.summary,
      payload: input.payload === undefined ? undefined : input.payload,
    },
  });
}
