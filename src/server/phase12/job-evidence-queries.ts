import {
  CustomerPortalSubmissionAttachmentStatus,
  CustomerPortalSubmissionType,
  JobEvidenceStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canViewJobEvidence } from "@/lib/phase12-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";

const jobEvidenceListSelect = {
  id: true,
  status: true,
  title: true,
  description: true,
  promotedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  jobTaskId: true,
  sourceAttachmentId: true,
  promotedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  jobTask: { select: { id: true, title: true } },
  sourceAttachment: {
    select: {
      id: true,
      originalFilename: true,
      status: true,
    },
  },
} satisfies Prisma.JobEvidenceSelect;

export type JobEvidenceStaffRow = Prisma.JobEvidenceGetPayload<{ select: typeof jobEvidenceListSelect }>;

function assertCanView(ctx: OrgSessionContext) {
  if (!canViewJobEvidence(ctx.role)) {
    throw new Error("You do not have permission to view job evidence.");
  }
}

export async function listJobEvidenceForJob(ctx: OrgSessionContext, jobId: string): Promise<JobEvidenceStaffRow[]> {
  assertCanView(ctx);
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!job) {
    throw new Error("Job not found.");
  }
  return prisma.jobEvidence.findMany({
    where: { organizationId: ctx.organizationId, jobId },
    select: jobEvidenceListSelect,
    orderBy: { promotedAt: "desc" },
  });
}

export async function getEvidenceCountsByJobTask(
  ctx: OrgSessionContext,
  jobId: string,
): Promise<Map<string, number>> {
  assertCanView(ctx);
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!job) {
    throw new Error("Job not found.");
  }
  const rows = await prisma.jobEvidence.groupBy({
    by: ["jobTaskId"],
    where: {
      organizationId: ctx.organizationId,
      jobId,
      jobTaskId: { not: null },
    },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.jobTaskId) {
      map.set(r.jobTaskId, r._count._all);
    }
  }
  return map;
}

const workStationEvidenceSelect = {
  id: true,
  title: true,
  promotedAt: true,
  jobId: true,
  job: {
    select: {
      id: true,
      displayNumber: true,
      customer: { select: { displayName: true } },
    },
  },
} satisfies Prisma.JobEvidenceSelect;

export type JobEvidenceWorkStationRow = Prisma.JobEvidenceGetPayload<{ select: typeof workStationEvidenceSelect }>;

export async function listCandidateJobEvidenceForWorkStation(
  ctx: OrgSessionContext,
): Promise<JobEvidenceWorkStationRow[]> {
  assertCanView(ctx);
  return prisma.jobEvidence.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: JobEvidenceStatus.CANDIDATE,
    },
    select: workStationEvidenceSelect,
    orderBy: { promotedAt: "desc" },
    take: 40,
  });
}

export type AttachmentPromotionBucket = {
  attachmentId: string;
  jobTaskId: string | null;
};

/** Buckets (job-level and per-task) already used for promotions from these attachments on this job. */
export async function listPromotionBucketsForAttachmentsOnJob(
  ctx: OrgSessionContext,
  jobId: string,
  attachmentIds: string[],
): Promise<AttachmentPromotionBucket[]> {
  if (attachmentIds.length === 0) return [];
  assertCanView(ctx);
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!job) {
    throw new Error("Job not found.");
  }
  const rows = await prisma.jobEvidence.findMany({
    where: {
      organizationId: ctx.organizationId,
      jobId,
      sourceAttachmentId: { in: attachmentIds },
    },
    select: { sourceAttachmentId: true, jobTaskId: true },
  });
  const out: AttachmentPromotionBucket[] = [];
  for (const r of rows) {
    if (r.sourceAttachmentId) {
      out.push({ attachmentId: r.sourceAttachmentId, jobTaskId: r.jobTaskId });
    }
  }
  return out;
}

export async function listJobTasksForEvidencePicker(
  ctx: OrgSessionContext,
  jobId: string,
): Promise<{ id: string; title: string }[]> {
  assertCanView(ctx);
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!job) {
    throw new Error("Job not found.");
  }
  const tasks = await prisma.jobTask.findMany({
    where: { organizationId: ctx.organizationId, jobId },
    select: { id: true, title: true },
    orderBy: [{ sortOrder: "asc" }],
  });
  return tasks.map((t) => ({ id: t.id, title: t.title }));
}

export async function loadAttachmentForPromotionGate(
  ctx: OrgSessionContext,
  attachmentId: string,
): Promise<{
  id: string;
  status: CustomerPortalSubmissionAttachmentStatus;
  submission: {
    type: CustomerPortalSubmissionType;
    jobId: string | null;
    organizationId: string;
  };
} | null> {
  assertCanView(ctx);
  return prisma.customerPortalSubmissionAttachment.findFirst({
    where: { id: attachmentId, organizationId: ctx.organizationId },
    select: {
      id: true,
      status: true,
      submission: {
        select: {
          type: true,
          jobId: true,
          organizationId: true,
        },
      },
    },
  });
}
