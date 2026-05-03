import { CustomerPortalSubmissionStatus, CustomerPortalSubmissionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import { PORTAL_SUBMISSION_GENERIC_ERROR } from "@/server/phase9/customer-portal-submission-types";
import { portalCustomerSubmissionInputSchema } from "@/server/phase9/validation";
import { resolvePortalTokenForSubmission } from "@/server/phase9/portal-submission-token-resolve";
import { PORTAL_ACTION_THROTTLED_MESSAGE } from "@/server/phase10/portal-phase10-messages";
import {
  consumePortalPostRateLimitSlot,
  PortalPostRateLimitedError,
} from "@/server/phase10/portal-post-rate-limit";

export type PortalSubmissionCreateResult =
  | { ok: true; quoteId: string; jobId: string | null }
  | { ok: false; error: string };

type CreatePortalSubmissionParams = {
  rawToken: string;
  input: unknown;
};

/**
 * Public portal: insert reviewable submission from token scope only.
 * Does not mutate Quote, Job, JobTask, ScheduledWork, snapshots, or portal projection.
 */
export async function createPortalSubmissionFromToken(
  params: CreatePortalSubmissionParams,
): Promise<PortalSubmissionCreateResult> {
  const parsedInput = portalCustomerSubmissionInputSchema.safeParse(params.input);
  if (!parsedInput.success) {
    const first = parsedInput.error.flatten().fieldErrors;
    const msg = first.type?.[0] ?? first.message?.[0] ?? PORTAL_SUBMISSION_GENERIC_ERROR;
    return { ok: false, error: msg };
  }

  const rawToken = params.rawToken?.trim();
  if (!rawToken) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const tokenHash = hashPortalToken(rawToken);
  try {
    await consumePortalPostRateLimitSlot({ tokenHash, action: "PORTAL_SUBMISSION_CREATE" });
  } catch (e) {
    if (e instanceof PortalPostRateLimitedError) {
      return { ok: false, error: PORTAL_ACTION_THROTTLED_MESSAGE };
    }
    throw e;
  }

  const scope = await resolvePortalTokenForSubmission(rawToken);
  if (!scope) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const data = parsedInput.data;
  if (
    data.type !== CustomerPortalSubmissionType.GENERAL_REQUEST &&
    data.type !== CustomerPortalSubmissionType.AVAILABILITY_NOTE
  ) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const submission = await prisma.customerPortalSubmission.create({
    data: {
      organizationId: scope.organizationId,
      customerId: scope.customerId,
      quoteId: scope.quoteId,
      jobId: scope.jobId,
      portalAccessTokenId: scope.portalAccessTokenId,
      type: data.type,
      status: CustomerPortalSubmissionStatus.NEW,
      subject: data.subject ?? null,
      message: data.message,
      payloadJson: undefined,
    },
    select: { id: true },
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: scope.organizationId,
      actorUserId: null,
      type: "CUSTOMER_PORTAL_SUBMISSION_CREATED",
      payload: {
        submissionId: submission.id,
        quoteId: scope.quoteId,
        jobId: scope.jobId ?? "",
        type: data.type,
      },
    },
  });

  return { ok: true, quoteId: scope.quoteId, jobId: scope.jobId };
}
