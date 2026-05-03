import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PortalPostRateLimitAction =
  | "PORTAL_SUBMISSION_CREATE"
  | "PORTAL_APPOINTMENT_CONFIRM"
  | "PORTAL_FILE_UPLOAD";

/** Fixed window length for portal POST rate buckets (UTC wall clock). */
export const PORTAL_POST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/** Max attempts per token hash + action + window (successful and failed POSTs both consume a slot). */
export const PORTAL_POST_RATE_LIMIT_MAX = 10;

/** Stricter cap for multipart file uploads (same window as other portal POST actions). */
export const PORTAL_FILE_UPLOAD_RATE_LIMIT_MAX = 3;

export function maxPortalPostAttemptsForAction(action: PortalPostRateLimitAction): number {
  if (action === "PORTAL_FILE_UPLOAD") return PORTAL_FILE_UPLOAD_RATE_LIMIT_MAX;
  return PORTAL_POST_RATE_LIMIT_MAX;
}

export function computePortalRateLimitWindowStart(now: Date): Date {
  const t = now.getTime();
  const bucket = Math.floor(t / PORTAL_POST_RATE_LIMIT_WINDOW_MS) * PORTAL_POST_RATE_LIMIT_WINDOW_MS;
  return new Date(bucket);
}

export class PortalPostRateLimitedError extends Error {
  constructor() {
    super("PORTAL_POST_RATE_LIMITED");
    this.name = "PortalPostRateLimitedError";
  }
}

/**
 * Increments rate-limit usage for a portal bearer (hashed). Throws {@link PortalPostRateLimitedError} when over cap.
 */
export async function consumePortalPostRateLimitSlot(params: {
  tokenHash: string;
  action: PortalPostRateLimitAction;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const windowStart = computePortalRateLimitWindowStart(now);
  const { tokenHash: key, action } = params;

  const run = async () => {
    await prisma.$transaction(
      async (tx) => {
        const row = await tx.portalActionRateLimit.findUnique({
          where: {
            key_action_windowStart: {
              key,
              action,
              windowStart,
            },
          },
        });
        const cap = maxPortalPostAttemptsForAction(action);
        if (row && row.count >= cap) {
          throw new PortalPostRateLimitedError();
        }
        await tx.portalActionRateLimit.upsert({
          where: {
            key_action_windowStart: { key, action, windowStart },
          },
          create: { key, action, windowStart, count: 1 },
          update: { count: { increment: 1 } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
    );
  };

  try {
    await run();
  } catch (e) {
    if (e instanceof PortalPostRateLimitedError) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      await run();
      return;
    }
    throw e;
  }
}
