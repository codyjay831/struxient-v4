import { JobStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const jobWorkspaceInclude = {
  customer: { select: { id: true, displayName: true } },
  quote: {
    select: {
      id: true,
      displayNumber: true,
      status: true,
      sentSnapshotJson: true,
      serviceAddressText: true,
      serviceAddressTbd: true,
    },
  },
  opportunity: {
    select: {
      id: true,
      serviceAddressText: true,
      serviceAddressTbd: true,
    },
  },
  lines: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      stages: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          tasks: { orderBy: { sortOrder: "asc" as const } },
        },
      },
    },
  },
} satisfies Prisma.JobInclude;

export type JobWorkspacePayload = Prisma.JobGetPayload<{ include: typeof jobWorkspaceInclude }>;

export async function getJobIdInOrganization(organizationId: string, jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: { id: true },
  });
}

export type JobListStatusFilter = JobStatus | "ALL";

const JOB_STATUS_VALUES = new Set<string>(Object.values(JobStatus));

/** Accepts query param values like `active`, `paused` (case-insensitive). */
export function parseJobListStatusParam(raw: string | undefined): JobListStatusFilter {
  if (!raw) {
    return "ALL";
  }
  const u = raw.trim().toUpperCase();
  if (u === "ALL") {
    return "ALL";
  }
  if (JOB_STATUS_VALUES.has(u)) {
    return u as JobStatus;
  }
  return "ALL";
}

export async function listJobsForOrganization(
  organizationId: string,
  options?: { status?: JobListStatusFilter },
) {
  const status = options?.status;
  const where =
    status && status !== "ALL"
      ? { organizationId, status }
      : { organizationId };

  return prisma.job.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      customer: { select: { id: true, displayName: true } },
      quote: { select: { id: true, displayNumber: true } },
    },
  });
}

export async function listJobActivityForJob(organizationId: string, jobId: string) {
  return prisma.jobActivityEvent.findMany({
    where: { organizationId, jobId },
    orderBy: { createdAt: "desc" },
    include: {
      actorUser: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getJobWorkspace(organizationId: string, jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, organizationId },
    include: jobWorkspaceInclude,
  });
}
