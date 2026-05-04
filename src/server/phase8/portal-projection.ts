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
import {
  buildPortalWhatHappensNext,
  customerPortalQuoteStatusLabel,
  mapJobStatusForCustomer,
  mapJobTaskStatusForCustomer,
  mapScheduledWorkStatusForCustomer,
} from "@/server/phase8/portal-customer-copy";
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

export {
  buildPortalWhatHappensNext,
  customerPortalQuoteStatusLabel,
  isJobExecutionLiveForCustomerPortal,
  isJobPendingActivationPortal,
  mapJobStatusForCustomer,
  mapJobTaskStatusForCustomer,
  mapScheduledWorkStatusForCustomer,
  PORTAL_JOB_PENDING_ACTIVATION_STATUS_VALUE,
} from "@/server/phase8/portal-customer-copy";

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
      where: {
        organizationId: row.organizationId,
        jobId: job.id,
        customerVisible: true,
        archivedAt: null,
      },
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

  const portalQuote = {
    ...preview,
    statusLabel: customerPortalQuoteStatusLabel(quoteRow.status, {
      hasLinkedJob: Boolean(effectiveJobId),
      jobStatus: resolvedJobStatus,
    }),
  };

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

  const whatHappensNext = buildPortalWhatHappensNext({
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