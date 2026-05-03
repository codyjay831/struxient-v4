import { JobTaskStatus } from "@prisma/client";

/**
 * Initial job task status when materializing from a sent snapshot.
 * Do not copy quote-line COMPLETE / IN_PROGRESS into job completion — start work fresh.
 * Only clearly blocked work may start as BLOCKED.
 */
export function initialJobTaskStatusFromSnapshot(snapshotStatus: string): JobTaskStatus {
  return snapshotStatus.trim() === "BLOCKED" ? JobTaskStatus.BLOCKED : JobTaskStatus.NOT_STARTED;
}
