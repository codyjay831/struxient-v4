import { CustomerPortalSubmissionStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canViewCustomerPortalSubmissions } from "@/lib/phase9-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";

const submissionAttachmentStaffSelect = {
  id: true,
  originalFilename: true,
  sanitizedFilename: true,
  contentType: true,
  detectedContentType: true,
  sizeBytes: true,
  status: true,
  createdAt: true,
} satisfies Prisma.CustomerPortalSubmissionAttachmentSelect;

const submissionListSelect = {
  id: true,
  type: true,
  status: true,
  subject: true,
  message: true,
  createdAt: true,
  customer: { select: { displayName: true } },
  quote: { select: { displayNumber: true } },
  job: { select: { id: true, displayNumber: true } },
  scheduledWork: {
    select: {
      scheduledStartAt: true,
      scheduledEndAt: true,
      jobTask: { select: { customerLabel: true, title: true } },
    },
  },
  attachments: {
    select: submissionAttachmentStaffSelect,
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.CustomerPortalSubmissionSelect;

export type CustomerPortalSubmissionStaffRow = Prisma.CustomerPortalSubmissionGetPayload<{
  select: typeof submissionListSelect;
}>;

function assertCanView(ctx: OrgSessionContext) {
  if (!canViewCustomerPortalSubmissions(ctx.role)) {
    throw new Error("You do not have permission to view customer portal submissions.");
  }
}

function sortStaffSubmissions(rows: CustomerPortalSubmissionStaffRow[]): CustomerPortalSubmissionStaffRow[] {
  return [...rows].sort((a, b) => {
    const aNew = a.status === CustomerPortalSubmissionStatus.NEW ? 0 : 1;
    const bNew = b.status === CustomerPortalSubmissionStatus.NEW ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export async function listCustomerPortalSubmissionsForQuote(
  ctx: OrgSessionContext,
  quoteId: string,
): Promise<CustomerPortalSubmissionStaffRow[]> {
  assertCanView(ctx);
  const rows = await prisma.customerPortalSubmission.findMany({
    where: { organizationId: ctx.organizationId, quoteId },
    select: submissionListSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return sortStaffSubmissions(rows);
}

export async function listCustomerPortalSubmissionsForJob(
  ctx: OrgSessionContext,
  jobId: string,
): Promise<CustomerPortalSubmissionStaffRow[]> {
  assertCanView(ctx);
  const rows = await prisma.customerPortalSubmission.findMany({
    where: { organizationId: ctx.organizationId, jobId },
    select: submissionListSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return sortStaffSubmissions(rows);
}

const workStationSubmissionSelect = {
  id: true,
  type: true,
  status: true,
  createdAt: true,
  quoteId: true,
  jobId: true,
  customer: { select: { displayName: true } },
  quote: { select: { id: true, displayNumber: true } },
  job: { select: { id: true, displayNumber: true } },
  scheduledWork: {
    select: {
      scheduledStartAt: true,
      scheduledEndAt: true,
      jobTask: { select: { customerLabel: true } },
    },
  },
  _count: {
    select: { attachments: true },
  },
} satisfies Prisma.CustomerPortalSubmissionSelect;

export type CustomerPortalSubmissionWorkStationRow = Prisma.CustomerPortalSubmissionGetPayload<{
  select: typeof workStationSubmissionSelect;
}>;

export async function listNewCustomerPortalSubmissionsForWorkStation(
  ctx: OrgSessionContext,
): Promise<CustomerPortalSubmissionWorkStationRow[]> {
  assertCanView(ctx);
  return prisma.customerPortalSubmission.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: CustomerPortalSubmissionStatus.NEW,
      OR: [{ quoteId: { not: null } }, { jobId: { not: null } }],
    },
    select: workStationSubmissionSelect,
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}

export async function countNewCustomerPortalSubmissionsForQuote(
  ctx: OrgSessionContext,
  quoteId: string,
): Promise<number> {
  assertCanView(ctx);
  return prisma.customerPortalSubmission.count({
    where: {
      organizationId: ctx.organizationId,
      quoteId,
      status: CustomerPortalSubmissionStatus.NEW,
    },
  });
}

export async function countNewCustomerPortalSubmissionsForJob(
  ctx: OrgSessionContext,
  jobId: string,
): Promise<number> {
  assertCanView(ctx);
  return prisma.customerPortalSubmission.count({
    where: {
      organizationId: ctx.organizationId,
      jobId,
      status: CustomerPortalSubmissionStatus.NEW,
    },
  });
}
