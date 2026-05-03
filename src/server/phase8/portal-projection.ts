import {
  CustomerPortalSubmissionStatus,
  CustomerPortalSubmissionType,
  JobStatus,
  JobTaskStatus,
  QuoteStatus,
  ScheduledWorkStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatContactType } from "@/lib/format-enums";
import { parseSentSnapshotPreviewDto } from "@/server/phase2/customer-preview";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import {
  portalViewDTOSchema,
  type PortalMilestoneItemDTO,
  type PortalProjectDTO,
  type PortalScheduleItemDTO,
  type PortalViewDTO,
} from "@/server/phase8/portal-dtos";
import { findPortalAccessTokenByTokenHash } from "@/server/phase8/portal-token-queries";
import { signScheduleActionRef } from "@/server/phase10/schedule-action-ref-crypto";

const POST_SEND: QuoteStatus[] = [QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.ACTIVATED];

export function mapJobStatusForCustomer(status: JobStatus): string {
  switch (status) {
    case JobStatus.ACTIVE:
      return "In progress";
    case JobStatus.PAUSED:
      return "Temporarily paused";
    case JobStatus.COMPLETED:
      return "Completed";
    case JobStatus.CANCELED:
      return "Canceled";
    default:
      return "In progress";
  }
}

export function mapJobTaskStatusForCustomer(status: JobTaskStatus): string {
  switch (status) {
    case JobTaskStatus.NOT_STARTED:
      return "Not started";
    case JobTaskStatus.READY:
      return "Ready";
    case JobTaskStatus.IN_PROGRESS:
      return "In progress";
    case JobTaskStatus.BLOCKED:
      return "Waiting";
    case JobTaskStatus.COMPLETE:
      return "Complete";
    default:
      return "In progress";
  }
}

export function mapScheduledWorkStatusForCustomer(status: ScheduledWorkStatus): string {
  switch (status) {
    case ScheduledWorkStatus.SCHEDULED:
      return "Scheduled";
    case ScheduledWorkStatus.COMPLETED:
      return "Completed";
    case ScheduledWorkStatus.CANCELED:
      return "Canceled";
    default:
      return "Scheduled";
  }
}

function customerQuoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case QuoteStatus.SENT:
      return "Proposal sent";
    case QuoteStatus.ACCEPTED:
      return "Proposal accepted";
    case QuoteStatus.ACTIVATED:
      return "Work underway";
    default:
      return "Proposal";
  }
}

function buildContactLines(
  methods: { type: string; value: string; label: string | null; isPrimary: boolean }[],
): string[] {
  const lines: string[] = [];
  for (const m of methods) {
    const kind = formatContactType(m.type as Parameters<typeof formatContactType>[0]);
    const suffix = m.label?.trim() ? ` (${m.label.trim()})` : "";
    lines.push(`${kind}: ${m.value.trim()}${suffix}`);
    if (lines.length >= 8) break;
  }
  return lines;
}

function milestoneSortKey(t: {
  sortOrder: number;
  jobLine: { sortOrder: number };
  jobStage: { sortOrder: number };
}): number {
  return t.jobLine.sortOrder * 10_000 + t.jobStage.sortOrder * 100 + t.sortOrder;
}

function buildWhatHappensNext(params: {
  quoteStatus: QuoteStatus;
  jobStatus: JobStatus | null;
  scheduleCount: number;
}): string {
  const { quoteStatus, jobStatus, scheduleCount } = params;

  if (jobStatus === JobStatus.COMPLETED) {
    return "Your project is complete. Thank you for working with us.";
  }
  if (jobStatus === JobStatus.CANCELED) {
    return "This project is no longer active. Please contact the office if you have questions.";
  }
  if (jobStatus === JobStatus.PAUSED) {
    return "Work on this project is temporarily paused. The office will reach out when activity resumes.";
  }

  if (jobStatus === JobStatus.ACTIVE) {
    if (scheduleCount > 0) {
      return "Your upcoming appointment is listed below. Times are subject to office confirmation.";
    }
    return "We will update this page when work is scheduled.";
  }

  if (quoteStatus === QuoteStatus.SENT) {
    return "Review is in progress. Contact the office with any questions about your proposal.";
  }
  if (quoteStatus === QuoteStatus.ACCEPTED) {
    return "Your proposal is accepted. We will update this page as work is scheduled.";
  }
  if (quoteStatus === QuoteStatus.ACTIVATED) {
    return "We will update this page as work progresses.";
  }

  return "We will update this page as work progresses.";
}

/**
 * Resolves a portal view from a raw bearer token. Invalid, revoked, expired, or inconsistent
 * tokens return null (callers should fail closed with a generic unavailable state).
 * Updates lastViewedAt on success.
 *
 * Future hardening: rate-limit token resolve by IP and per hash to reduce brute-force noise.
 */
export async function getPortalViewByRawToken(rawToken: string): Promise<PortalViewDTO | null> {
  const trimmed = rawToken?.trim();
  if (!trimmed) return null;

  const tokenHash = hashPortalToken(trimmed);
  const row = await findPortalAccessTokenByTokenHash(tokenHash);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const quoteRow = row.quote;
  if (quoteRow.organizationId !== row.organizationId) return null;
  if (quoteRow.customerId !== row.customerId) return null;
  if (!POST_SEND.includes(quoteRow.status)) return null;
  if (row.jobId && quoteRow.jobId && row.jobId !== quoteRow.jobId) return null;

  const preview = parseSentSnapshotPreviewDto(quoteRow.sentSnapshotJson);
  if (!preview) return null;

  const portalQuote = {
    ...preview,
    statusLabel: customerQuoteStatusLabel(quoteRow.status),
  };

  const effectiveJobId = row.jobId ?? quoteRow.jobId ?? null;
  let project: PortalProjectDTO | undefined;
  let schedule: PortalScheduleItemDTO[] = [];
  let resolvedJobStatus: JobStatus | null = null;

  if (effectiveJobId) {
    const job = await prisma.job.findFirst({
      where: {
        id: effectiveJobId,
        organizationId: row.organizationId,
        quoteId: quoteRow.id,
        customerId: row.customerId,
      },
      select: {
        id: true,
        displayNumber: true,
        title: true,
        status: true,
      },
    });
    if (!job) return null;
    resolvedJobStatus = job.status;

    const tasks = await prisma.jobTask.findMany({
      where: { organizationId: row.organizationId, jobId: job.id, customerVisible: true },
      select: {
        customerLabel: true,
        status: true,
        sortOrder: true,
        jobLine: { select: { sortOrder: true } },
        jobStage: { select: { sortOrder: true } },
      },
    });

    const milestoneItems: PortalMilestoneItemDTO[] = tasks
      .filter((t) => t.customerLabel?.trim())
      .sort((a, b) => milestoneSortKey(a) - milestoneSortKey(b))
      .map((t) => ({
        label: t.customerLabel!.trim(),
        stateLabel: mapJobTaskStatusForCustomer(t.status),
        sortKey: milestoneSortKey(t),
      }));

    let completed = 0;
    for (const t of tasks) {
      if (t.status === JobTaskStatus.COMPLETE) completed += 1;
    }
    const progress = { completed, total: tasks.length };

    project = {
      jobDisplayNumber: job.displayNumber,
      title: job.title.trim(),
      statusLabel: mapJobStatusForCustomer(job.status),
      milestoneItems,
      progress,
    };

    const schedRows = await prisma.scheduledWork.findMany({
      where: {
        organizationId: row.organizationId,
        jobId: job.id,
        jobTask: { customerVisible: true },
      },
      orderBy: { scheduledStartAt: "asc" },
      select: {
        id: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        status: true,
        jobTask: { select: { customerLabel: true } },
      },
    });

    const portalNow = new Date();
    const scheduledIds = schedRows.map((r) => r.id);
    const pendingAckIds =
      scheduledIds.length > 0
        ? (
            await prisma.customerPortalSubmission.findMany({
              where: {
                portalAccessTokenId: row.id,
                type: CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION,
                status: CustomerPortalSubmissionStatus.NEW,
                scheduledWorkId: { in: scheduledIds },
              },
              select: { scheduledWorkId: true },
            })
          )
            .map((x) => x.scheduledWorkId)
            .filter((id): id is string => Boolean(id))
        : [];
    const pendingAckSet = new Set(pendingAckIds);

    schedule = schedRows.map((r) => {
      const label =
        r.jobTask.customerLabel?.trim() && r.jobTask.customerLabel.trim().length > 0
          ? r.jobTask.customerLabel.trim()
          : "Scheduled visit";
      const isCanceled = r.status === ScheduledWorkStatus.CANCELED;
      const base: PortalScheduleItemDTO = {
        label,
        scheduledStartAt: r.scheduledStartAt.toISOString(),
        scheduledEndAt: r.scheduledEndAt.toISOString(),
        statusLabel: mapScheduledWorkStatusForCustomer(r.status),
        isCanceled,
      };

      if (pendingAckSet.has(r.id)) {
        return {
          ...base,
          acknowledgmentStatus: "received" as const,
          canAcknowledge: false,
        };
      }

      const eligible =
        r.status === ScheduledWorkStatus.SCHEDULED &&
        !isCanceled &&
        r.scheduledEndAt.getTime() >= portalNow.getTime();

      if (!eligible) {
        return base;
      }

      return {
        ...base,
        scheduleActionRef: signScheduleActionRef({
          scheduledWorkId: r.id,
          portalAccessTokenId: row.id,
          organizationId: row.organizationId,
        }),
        canAcknowledge: true,
        acknowledgmentStatus: "not_acknowledged" as const,
      };
    });
  }

  const serviceAddressSummary = preview.serviceAddressSummary?.trim() || undefined;
  const projectTitle =
    project?.title?.trim() ||
    preview.quoteTitle?.trim() ||
    `Proposal #${preview.displayNumber}`;

  const context = {
    organizationDisplayName: row.organization.name.trim(),
    customerDisplayName: row.customer.displayName.trim(),
    projectTitle,
    serviceAddressSummary,
    contactLines: buildContactLines(row.customer.contactMethods),
  };

  const whatHappensNext = buildWhatHappensNext({
    quoteStatus: quoteRow.status,
    jobStatus: resolvedJobStatus,
    scheduleCount: schedule.length,
  });

  const view: PortalViewDTO = {
    context,
    quote: portalQuote,
    project,
    schedule,
    whatHappensNext,
  };

  const parsed = portalViewDTOSchema.safeParse(view);
  if (!parsed.success) {
    return null;
  }

  await prisma.portalAccessToken.update({
    where: { id: row.id },
    data: { lastViewedAt: new Date() },
  });

  return parsed.data;
}