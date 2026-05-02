import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QuoteActivityEventTypeName } from "./quote-activity-types";

export type RecordQuoteActivityInput = {
  organizationId: string;
  quoteId: string;
  opportunityId?: string | null;
  customerId?: string | null;
  actorUserId: string | null;
  eventType: QuoteActivityEventTypeName;
  summary: string;
  payload?: Prisma.InputJsonValue;
};

export async function recordQuoteActivity(
  db: Prisma.TransactionClient | typeof prisma,
  input: RecordQuoteActivityInput,
) {
  await db.quoteActivityEvent.create({
    data: {
      organizationId: input.organizationId,
      quoteId: input.quoteId,
      opportunityId: input.opportunityId ?? null,
      customerId: input.customerId ?? null,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      summary: input.summary,
      payload: input.payload === undefined ? undefined : input.payload,
    },
  });
}
