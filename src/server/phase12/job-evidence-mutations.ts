import {
  CustomerPortalSubmissionAttachmentStatus,
  CustomerPortalSubmissionType,
  JobEvidenceStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canManageJobEvidence } from "@/lib/phase12-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  recordJobEvidenceAccepted,
  recordJobEvidencePromoted,
  recordJobEvidenceRejected,
} from "@/server/phase12/job-evidence-events";
import { JOB_EVIDENCE_REJECTION_REASON_MAX } from "@/server/phase12/job-evidence-types";

export type JobEvidenceMutationResult =
  | { ok: true; jobId: string; evidenceId: string }
  | { ok: false; error: string };

function assertManage(ctx: OrgSessionContext): JobEvidenceMutationResult | null {
  if (!canManageJobEvidence(ctx.role)) {
    return { ok: false, error: "You do not have permission to manage job evidence." };
  }
  return null;
}

export async function promoteCustomerUploadAttachmentToJobEvidence(
  ctx: OrgSessionContext,
  input: {
    sourceAttachmentId: string;
    jobId: string;
    jobTaskId: string | null;
    title: string;
    description?: string;
  },
): Promise<JobEvidenceMutationResult> {
  const denied = assertManage(ctx);
  if (denied) return denied;

  const attachment = await prisma.customerPortalSubmissionAttachment.findFirst({
    where: { id: input.sourceAttachmentId, organizationId: ctx.organizationId },
    select: {
      id: true,
      status: true,
      submission: {
        select: {
          id: true,
          organizationId: true,
          type: true,
          jobId: true,
        },
      },
    },
  });

  if (!attachment) {
    return { ok: false, error: "Attachment not found." };
  }
  if (attachment.status !== CustomerPortalSubmissionAttachmentStatus.STORED) {
    return { ok: false, error: "Only stored files can be promoted." };
  }
  if (attachment.submission.organizationId !== ctx.organizationId) {
    return { ok: false, error: "Attachment not found." };
  }
  if (attachment.submission.type !== CustomerPortalSubmissionType.FILE_UPLOAD) {
    return { ok: false, error: "Only file uploads can be promoted to evidence." };
  }
  if (!attachment.submission.jobId || attachment.submission.jobId !== input.jobId) {
    return { ok: false, error: "The upload must be tied to this job before it can be promoted." };
  }

  const job = await prisma.job.findFirst({
    where: { id: input.jobId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!job) {
    return { ok: false, error: "Job not found." };
  }

  let jobTaskId: string | null = input.jobTaskId;
  if (jobTaskId) {
    const task = await prisma.jobTask.findFirst({
      where: {
        id: jobTaskId,
        jobId: input.jobId,
        organizationId: ctx.organizationId,
      },
      select: { id: true },
    });
    if (!task) {
      return { ok: false, error: "Task not found on this job." };
    }
  } else {
    jobTaskId = null;
  }

  const dup = await prisma.jobEvidence.findFirst({
    where: {
      organizationId: ctx.organizationId,
      jobId: input.jobId,
      sourceAttachmentId: input.sourceAttachmentId,
      jobTaskId: jobTaskId === null ? null : jobTaskId,
    },
    select: { id: true },
  });
  if (dup) {
    return { ok: false, error: "This file was already promoted for this job and target." };
  }

  try {
    const created = await prisma.jobEvidence.create({
      data: {
        organizationId: ctx.organizationId,
        jobId: input.jobId,
        jobTaskId,
        sourceAttachmentId: input.sourceAttachmentId,
        status: JobEvidenceStatus.CANDIDATE,
        title: input.title,
        description: input.description ?? null,
        promotedByUserId: ctx.userId,
      },
      select: { id: true },
    });

    await recordJobEvidencePromoted({
      organizationId: ctx.organizationId,
      jobId: input.jobId,
      actorUserId: ctx.userId,
      evidenceId: created.id,
      title: input.title,
      jobTaskId,
      sourceAttachmentId: input.sourceAttachmentId,
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        type: "JOB_EVIDENCE_PROMOTED",
        payload: {
          evidenceId: created.id,
          jobId: input.jobId,
          jobTaskId: jobTaskId ?? "",
          sourceAttachmentId: input.sourceAttachmentId,
          title: input.title,
        },
      },
    });

    return { ok: true, jobId: input.jobId, evidenceId: created.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "This file was already promoted for this job and target." };
    }
    throw e;
  }
}

export async function acceptJobEvidence(ctx: OrgSessionContext, evidenceId: string): Promise<JobEvidenceMutationResult> {
  const denied = assertManage(ctx);
  if (denied) return denied;

  const row = await prisma.jobEvidence.findFirst({
    where: { id: evidenceId, organizationId: ctx.organizationId },
    select: {
      id: true,
      jobId: true,
      status: true,
      title: true,
      jobTaskId: true,
      sourceAttachmentId: true,
    },
  });
  if (!row) {
    return { ok: false, error: "Evidence not found." };
  }
  if (row.status !== JobEvidenceStatus.CANDIDATE) {
    return { ok: false, error: "Only candidate evidence can be accepted." };
  }

  await prisma.jobEvidence.update({
    where: { id: row.id },
    data: {
      status: JobEvidenceStatus.ACCEPTED,
      reviewedAt: new Date(),
      reviewedByUserId: ctx.userId,
      rejectionReason: null,
    },
  });

  await recordJobEvidenceAccepted({
    organizationId: ctx.organizationId,
    jobId: row.jobId,
    actorUserId: ctx.userId,
    evidenceId: row.id,
    title: row.title,
    jobTaskId: row.jobTaskId,
    sourceAttachmentId: row.sourceAttachmentId,
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      type: "JOB_EVIDENCE_ACCEPTED",
      payload: {
        evidenceId: row.id,
        jobId: row.jobId,
        title: row.title,
      },
    },
  });

  return { ok: true, jobId: row.jobId, evidenceId: row.id };
}

export async function rejectJobEvidence(
  ctx: OrgSessionContext,
  evidenceId: string,
  rejectionReason: string,
): Promise<JobEvidenceMutationResult> {
  const denied = assertManage(ctx);
  if (denied) return denied;

  const reason = rejectionReason.trim();
  if (!reason) {
    return { ok: false, error: "A rejection reason is required." };
  }
  if (reason.length > JOB_EVIDENCE_REJECTION_REASON_MAX) {
    return { ok: false, error: `Reason must be at most ${JOB_EVIDENCE_REJECTION_REASON_MAX} characters.` };
  }

  const row = await prisma.jobEvidence.findFirst({
    where: { id: evidenceId, organizationId: ctx.organizationId },
    select: {
      id: true,
      jobId: true,
      status: true,
      title: true,
      jobTaskId: true,
      sourceAttachmentId: true,
    },
  });
  if (!row) {
    return { ok: false, error: "Evidence not found." };
  }
  if (row.status !== JobEvidenceStatus.CANDIDATE) {
    return { ok: false, error: "Only candidate evidence can be rejected." };
  }

  await prisma.jobEvidence.update({
    where: { id: row.id },
    data: {
      status: JobEvidenceStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedByUserId: ctx.userId,
      rejectionReason: reason,
    },
  });

  await recordJobEvidenceRejected({
    organizationId: ctx.organizationId,
    jobId: row.jobId,
    actorUserId: ctx.userId,
    evidenceId: row.id,
    title: row.title,
    jobTaskId: row.jobTaskId,
    sourceAttachmentId: row.sourceAttachmentId,
    rejectionReason: reason,
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      type: "JOB_EVIDENCE_REJECTED",
      payload: {
        evidenceId: row.id,
        jobId: row.jobId,
        title: row.title,
      },
    },
  });

  return { ok: true, jobId: row.jobId, evidenceId: row.id };
}
