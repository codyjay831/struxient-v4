import { CustomerPortalSubmissionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canManageCustomerPortalSubmissions } from "@/lib/phase9-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";

export type StaffSubmissionMutationResult =
  | { ok: true; quoteId: string | null; jobId: string | null }
  | { ok: false; error: string };

function assertCanManage(ctx: OrgSessionContext): StaffSubmissionMutationResult | null {
  if (!canManageCustomerPortalSubmissions(ctx.role)) {
    return { ok: false, error: "You do not have permission to update submission status." };
  }
  return null;
}

async function setSubmissionStatus(
  ctx: OrgSessionContext,
  submissionId: string,
  status: CustomerPortalSubmissionStatus,
): Promise<StaffSubmissionMutationResult> {
  const denied = assertCanManage(ctx);
  if (denied) return denied;

  const existing = await prisma.customerPortalSubmission.findFirst({
    where: { id: submissionId, organizationId: ctx.organizationId },
    select: { id: true, quoteId: true, jobId: true },
  });
  if (!existing) {
    return { ok: false, error: "Submission not found." };
  }

  await prisma.customerPortalSubmission.update({
    where: { id: existing.id },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedByUserId: ctx.userId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      type: "CUSTOMER_PORTAL_SUBMISSION_STATUS_CHANGED",
      payload: {
        submissionId: existing.id,
        status,
        quoteId: existing.quoteId ?? "",
        jobId: existing.jobId ?? "",
      },
    },
  });

  return { ok: true, quoteId: existing.quoteId, jobId: existing.jobId };
}

export async function markCustomerPortalSubmissionReviewed(
  ctx: OrgSessionContext,
  submissionId: string,
): Promise<StaffSubmissionMutationResult> {
  return setSubmissionStatus(ctx, submissionId, CustomerPortalSubmissionStatus.REVIEWED);
}

export async function markCustomerPortalSubmissionActioned(
  ctx: OrgSessionContext,
  submissionId: string,
): Promise<StaffSubmissionMutationResult> {
  return setSubmissionStatus(ctx, submissionId, CustomerPortalSubmissionStatus.ACTIONED);
}

export async function dismissCustomerPortalSubmission(
  ctx: OrgSessionContext,
  submissionId: string,
): Promise<StaffSubmissionMutationResult> {
  return setSubmissionStatus(ctx, submissionId, CustomerPortalSubmissionStatus.DISMISSED);
}
