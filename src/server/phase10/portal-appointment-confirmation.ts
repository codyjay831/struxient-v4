import {
  CustomerPortalSubmissionStatus,
  CustomerPortalSubmissionType,
  ScheduledWorkStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import { PORTAL_SUBMISSION_GENERIC_ERROR } from "@/server/phase9/customer-portal-submission-types";
import { resolvePortalTokenForSubmission } from "@/server/phase9/portal-submission-token-resolve";
import { PORTAL_ACTION_THROTTLED_MESSAGE } from "@/server/phase10/portal-phase10-messages";
import { PORTAL_APPOINTMENT_NOTE_MAX } from "@/server/phase10/portal-appointment-constants";
import { consumePortalPostRateLimitSlot, PortalPostRateLimitedError } from "@/server/phase10/portal-post-rate-limit";
import { verifyScheduleActionRef } from "@/server/phase10/schedule-action-ref-crypto";

export type PortalAppointmentConfirmResult =
  | { ok: true; quoteId: string; jobId: string | null }
  | { ok: false; error: string };

/**
 * Appointment acknowledgment: creates reviewable submission only. Does not mutate ScheduledWork, Job, JobTask, or Quote.
 *
 * Past boundary: `scheduledEndAt` must be >= current instant (UTC comparison using server clock).
 */
export async function confirmScheduledWorkFromPortal(params: {
  rawToken: string;
  scheduleActionRef: string;
  optionalNote?: string;
  now?: Date;
}): Promise<PortalAppointmentConfirmResult> {
  const rawToken = params.rawToken?.trim();
  if (!rawToken) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const note = params.optionalNote?.trim() ?? "";
  if (note.length > PORTAL_APPOINTMENT_NOTE_MAX) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const tokenHash = hashPortalToken(rawToken);
  try {
    await consumePortalPostRateLimitSlot({
      tokenHash,
      action: "PORTAL_APPOINTMENT_CONFIRM",
      now: params.now,
    });
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

  const scheduledWorkId = verifyScheduleActionRef({
    ref: params.scheduleActionRef,
    expectedPortalAccessTokenId: scope.portalAccessTokenId,
    expectedOrganizationId: scope.organizationId,
  });
  if (!scheduledWorkId) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const effectiveJobId = scope.jobId;
  if (!effectiveJobId) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const now = params.now ?? new Date();

  const sw = await prisma.scheduledWork.findFirst({
    where: {
      id: scheduledWorkId,
      organizationId: scope.organizationId,
      jobId: effectiveJobId,
    },
    select: {
      id: true,
      jobId: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      jobTask: {
        select: { customerVisible: true },
      },
    },
  });

  if (!sw) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }
  if (sw.jobTask.customerVisible !== true) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }
  if (sw.status !== ScheduledWorkStatus.SCHEDULED) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }
  if (sw.scheduledEndAt.getTime() < now.getTime()) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const dup = await prisma.customerPortalSubmission.findFirst({
    where: {
      organizationId: scope.organizationId,
      portalAccessTokenId: scope.portalAccessTokenId,
      scheduledWorkId: sw.id,
      type: CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION,
      status: CustomerPortalSubmissionStatus.NEW,
    },
    select: { id: true },
  });
  if (dup) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const message =
    note.length > 0 ? note : "Customer acknowledged the scheduled visit. The office will review this confirmation.";

  const submission = await prisma.customerPortalSubmission.create({
    data: {
      organizationId: scope.organizationId,
      customerId: scope.customerId,
      quoteId: scope.quoteId,
      jobId: scope.jobId,
      scheduledWorkId: sw.id,
      portalAccessTokenId: scope.portalAccessTokenId,
      type: CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION,
      status: CustomerPortalSubmissionStatus.NEW,
      subject: "Appointment acknowledged",
      message,
      payloadJson: {
        kind: "APPOINTMENT_CONFIRMATION",
        scheduledStartAt: sw.scheduledStartAt.toISOString(),
        scheduledEndAt: sw.scheduledEndAt.toISOString(),
      },
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
        type: CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION,
        scheduledWorkId: sw.id,
      },
    },
  });

  return { ok: true, quoteId: scope.quoteId, jobId: scope.jobId };
}
