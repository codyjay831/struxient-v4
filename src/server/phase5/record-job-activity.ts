import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JobActivityEventTypeName } from "@/server/phase5/job-activity-types";

export type RecordJobActivityInput = {
  organizationId: string;
  jobId: string;
  actorUserId: string | null;
  eventType: JobActivityEventTypeName;
  summary: string;
  payloadJson?: Prisma.InputJsonValue;
};

export async function recordJobActivity(
  db: Prisma.TransactionClient | typeof prisma,
  input: RecordJobActivityInput,
) {
  await db.jobActivityEvent.create({
    data: {
      organizationId: input.organizationId,
      jobId: input.jobId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      summary: input.summary,
      payloadJson: input.payloadJson === undefined ? undefined : input.payloadJson,
    },
  });
}
