import { JobStatus, Prisma, ScheduledWorkStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  deriveReadinessForScheduledWork,
  type AddressContext,
  type ScheduledReadinessFacts,
} from "@/server/phase7/schedule-readiness";
import type {
  GlobalScheduleRangeFilter,
  GlobalScheduleReadinessFilter,
  GlobalScheduleStatusFilter,
  ScheduleReadiness,
} from "@/server/phase7/scheduled-work-types";

/** UTC calendar day boundaries for the instant `reference` (server clock). */
export function utcDayStart(reference: Date): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0, 0, 0),
  );
}

export function utcDayEndExclusive(reference: Date): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() + 1, 0, 0, 0, 0),
  );
}

export const UPCOMING_RANGE_DAYS = 30;
export const ALL_RANGE_PAST_DAYS = 90;
export const ALL_RANGE_FUTURE_DAYS = 365;
export const GLOBAL_SCHEDULE_LIST_CAP = 200;

const scheduledWorkListInclude = {
  job: {
    select: {
      id: true,
      displayNumber: true,
      status: true,
      statusReason: true,
      title: true,
      customer: { select: { id: true, displayName: true } },
      quote: {
        select: {
          serviceAddressText: true,
          serviceAddressTbd: true,
        },
      },
      opportunity: {
        select: {
          serviceAddressText: true,
          serviceAddressTbd: true,
        },
      },
    },
  },
  jobTask: {
    select: {
      id: true,
      title: true,
      status: true,
      blockedReason: true,
      estimatedDurationMinutes: true,
    },
  },
} satisfies Prisma.ScheduledWorkInclude;

export type ScheduledWorkListRow = Prisma.ScheduledWorkGetPayload<{ include: typeof scheduledWorkListInclude }>;

export function buildAddressContextFromJobRow(
  job: ScheduledWorkListRow["job"],
): AddressContext {
  return {
    quoteServiceAddressText: job.quote.serviceAddressText,
    quoteServiceAddressTbd: job.quote.serviceAddressTbd,
    opportunityServiceAddressText: job.opportunity?.serviceAddressText ?? null,
    opportunityServiceAddressTbd: job.opportunity?.serviceAddressTbd ?? false,
  };
}

export function getReadinessForScheduledListRow(row: ScheduledWorkListRow): ScheduleReadiness {
  const facts: ScheduledReadinessFacts = {
    scheduledWorkStatus: row.status,
    jobStatus: row.job.status,
    jobStatusReason: row.job.statusReason,
    taskStatus: row.jobTask.status,
    taskBlockedReason: row.jobTask.blockedReason,
    estimatedDurationMinutes: row.jobTask.estimatedDurationMinutes,
    addressContext: buildAddressContextFromJobRow(row.job),
  };
  return deriveReadinessForScheduledWork(facts);
}

export async function getScheduledWorkInOrganization(
  organizationId: string,
  scheduledWorkId: string,
): Promise<ScheduledWorkListRow | null> {
  return prisma.scheduledWork.findFirst({
    where: { id: scheduledWorkId, organizationId },
    include: scheduledWorkListInclude,
  });
}

export async function listScheduledWorkForJob(
  organizationId: string,
  jobId: string,
): Promise<ScheduledWorkListRow[]> {
  return prisma.scheduledWork.findMany({
    where: { organizationId, jobId },
    include: scheduledWorkListInclude,
    orderBy: { scheduledStartAt: "asc" },
  });
}

function parseRange(raw: string | undefined): GlobalScheduleRangeFilter {
  if (raw === "upcoming" || raw === "all") {
    return raw;
  }
  return "today";
}

function parseStatus(raw: string | undefined): GlobalScheduleStatusFilter {
  if (raw === "scheduled" || raw === "canceled" || raw === "completed" || raw === "all") {
    return raw;
  }
  return "scheduled";
}

function parseReadiness(raw: string | undefined): GlobalScheduleReadinessFilter {
  if (raw === "ready" || raw === "at_risk" || raw === "blocked") {
    return raw;
  }
  return "all";
}

export type ListScheduledWorkForOrganizationFilters = {
  range?: string | undefined;
  status?: string | undefined;
  readiness?: string | undefined;
};

export async function listScheduledWorkForOrganization(
  ctx: OrgSessionContext,
  filters: ListScheduledWorkForOrganizationFilters,
): Promise<ScheduledWorkListRow[]> {
  const range = parseRange(filters.range);
  const statusFilter = parseStatus(filters.status);
  const readinessFilter = parseReadiness(filters.readiness);

  const now = new Date();
  const dayStart = utcDayStart(now);
  const dayEndEx = utcDayEndExclusive(now);

  const where: Prisma.ScheduledWorkWhereInput = {
    organizationId: ctx.organizationId,
  };

  if (statusFilter === "scheduled") {
    where.status = ScheduledWorkStatus.SCHEDULED;
  } else if (statusFilter === "canceled") {
    where.status = ScheduledWorkStatus.CANCELED;
  } else if (statusFilter === "completed") {
    where.status = ScheduledWorkStatus.COMPLETED;
  }
  // statusFilter === "all": no status constraint

  if (range === "today") {
    where.scheduledStartAt = { gte: dayStart, lt: dayEndEx };
  } else if (range === "upcoming") {
    const upcomingEnd = new Date(dayEndEx);
    upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + UPCOMING_RANGE_DAYS);
    where.scheduledStartAt = { gte: dayEndEx, lt: upcomingEnd };
  } else {
    const past = new Date(dayStart);
    past.setUTCDate(past.getUTCDate() - ALL_RANGE_PAST_DAYS);
    const future = new Date(dayStart);
    future.setUTCDate(future.getUTCDate() + ALL_RANGE_FUTURE_DAYS);
    where.scheduledStartAt = { gte: past, lt: future };
  }

  const rows = await prisma.scheduledWork.findMany({
    where,
    include: scheduledWorkListInclude,
    orderBy: { scheduledStartAt: "asc" },
    take: GLOBAL_SCHEDULE_LIST_CAP,
  });

  if (readinessFilter === "all") {
    return rows;
  }

  return rows.filter((row) => {
    const r = getReadinessForScheduledListRow(row);
    if (readinessFilter === "ready") {
      return r.label === "SCHEDULED_READY";
    }
    if (readinessFilter === "at_risk") {
      return r.label === "SCHEDULED_AT_RISK";
    }
    if (readinessFilter === "blocked") {
      return r.label === "SCHEDULED_BLOCKED";
    }
    return true;
  });
}

export function groupScheduledRowsByUtcDay(
  rows: ScheduledWorkListRow[],
): Map<string, ScheduledWorkListRow[]> {
  const map = new Map<string, ScheduledWorkListRow[]>();
  for (const row of rows) {
    const key = utcDayStart(row.scheduledStartAt).toISOString().slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

export async function assertNoActiveScheduledWorkForTask(
  tx: Prisma.TransactionClient,
  organizationId: string,
  jobTaskId: string,
): Promise<boolean> {
  const existing = await tx.scheduledWork.findFirst({
    where: {
      organizationId,
      jobTaskId,
      status: ScheduledWorkStatus.SCHEDULED,
    },
    select: { id: true },
  });
  return !existing;
}

/** Jobs that are closed cannot receive new schedule rows (mutations enforce; query helper for UI). */
export function canAttachNewScheduleToJob(jobStatus: JobStatus): boolean {
  return jobStatus === JobStatus.ACTIVE || jobStatus === JobStatus.PAUSED;
}
