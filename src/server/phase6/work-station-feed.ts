import {
  JobStatus,
  JobTaskStatus,
  MembershipRole,
  OpportunityStatus,
  OpportunityTaskStatus,
  QuoteStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canActivateAcceptedQuoteAsJob, canViewJobsWorkspace } from "@/lib/phase4-permissions";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { activeContactMethods, allQuoteDraftBlockersPass, computeQuoteDraftReadiness } from "@/server/phase1/readiness";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { allQuoteSendBlockersPass, evaluateQuoteSendReadiness } from "@/server/phase2/quote-readiness";
import { findActiveDraftQuoteForOpportunity, getQuoteReadinessBundle } from "@/server/phase2/quote-queries";
import { getJobProgressMapForJobs } from "@/server/phase5/job-progress";
import { CustomerPortalSubmissionType } from "@prisma/client";

import { canViewCustomerPortalSubmissions } from "@/lib/phase9-permissions";
import { canSeeJobEvidenceWorkStationCards } from "@/lib/phase12-permissions";
import { canSeeEvidenceRequirementWorkStationCards } from "@/lib/phase13-permissions";
import { listCandidateJobEvidenceForWorkStation } from "@/server/phase12/job-evidence-queries";
import { listJobTasksNeedingAcceptedEvidenceForWorkStation } from "@/server/phase13/work-station-evidence-requirements";
import {
  CATEGORY_ORDER,
  PRIORITY_ORDER,
  WORK_STATION_MAX_CARDS,
  WORK_STATION_QUERY_CAP,
  type WorkStationCard,
  type WorkStationCardCategory,
  type WorkStationFeedCategoryFilter,
  type WorkStationFeedFilters,
  type WorkStationFeedSourceFilter,
} from "@/server/phase6/work-station-card-types";
import { listNewCustomerPortalSubmissionsForWorkStation } from "@/server/phase9/customer-portal-submission-queries";
import { formatScheduleWindowDisplay } from "@/lib/format-schedule-window";

const TERMINAL_OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  OpportunityStatus.LOST,
  OpportunityStatus.NO_QUOTE,
  OpportunityStatus.ARCHIVED,
];

function pickParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function parseWorkStationFeedFilters(
  searchParams: Record<string, string | string[] | undefined>,
): WorkStationFeedFilters {
  const rawSource = pickParam(searchParams.source)?.toLowerCase();
  const rawCategory = pickParam(searchParams.category)?.toLowerCase();

  let source: WorkStationFeedSourceFilter = "all";
  if (rawSource === "opportunities") source = "opportunities";
  else if (rawSource === "quotes") source = "quotes";
  else if (rawSource === "jobs") source = "jobs";

  let category: WorkStationFeedCategoryFilter = "all";
  if (rawCategory === "now") category = "now";
  else if (rawCategory === "next") category = "next";
  else if (rawCategory === "blocked") category = "blocked";
  else if (rawCategory === "waiting") category = "waiting";
  else if (rawCategory === "needs_review") category = "needs_review";
  else if (rawCategory === "done") category = "done";

  return { source, category };
}

export function sortWorkStationCards(cards: WorkStationCard[]): WorkStationCard[] {
  return [...cards].sort((a, b) => {
    const c = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (c !== 0) return c;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const ta = (a.updatedAt ?? a.createdAt ?? "").localeCompare(b.updatedAt ?? b.createdAt ?? "");
    if (ta !== 0) return -ta;
    return a.id.localeCompare(b.id);
  });
}

function includeOpportunityAndQuoteCards(role: MembershipRole): boolean {
  return (
    role === MembershipRole.OWNER ||
    role === MembershipRole.ADMIN ||
    role === MembershipRole.MANAGER ||
    role === MembershipRole.OFFICE ||
    role === MembershipRole.SALES
  );
}

function includeJobCards(role: MembershipRole): boolean {
  return canViewJobsWorkspace(role);
}

function opportunityTaskCategory(status: OpportunityTaskStatus): WorkStationCardCategory {
  switch (status) {
    case OpportunityTaskStatus.READY:
    case OpportunityTaskStatus.IN_PROGRESS:
      return "NOW";
    case OpportunityTaskStatus.BLOCKED:
      return "BLOCKED";
    case OpportunityTaskStatus.WAITING:
      return "WAITING";
    case OpportunityTaskStatus.NEEDS_REVIEW:
      return "NEEDS_REVIEW";
    case OpportunityTaskStatus.NOT_READY:
      return "NEXT";
    default:
      return "NEXT";
  }
}

function formatOpportunityTaskStatus(status: OpportunityTaskStatus): string {
  return status.replace(/_/g, " ");
}

function iso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

export function workStationFilterCardsBySource(
  cards: WorkStationCard[],
  source: WorkStationFeedSourceFilter,
): WorkStationCard[] {
  if (source === "all") return cards;
  if (source === "opportunities") {
    return cards.filter((c) => c.sourceType === "OPPORTUNITY" || c.sourceType === "OPPORTUNITY_TASK");
  }
  if (source === "quotes") {
    return cards.filter(
      (c) =>
        c.sourceType === "QUOTE" ||
        (c.sourceType === "CUSTOMER_PORTAL_SUBMISSION" && c.primaryHref.includes("/app/sales/quotes/")),
    );
  }
  if (source === "jobs") {
    return cards.filter(
      (c) =>
        c.sourceType === "JOB" ||
        c.sourceType === "JOB_TASK" ||
        c.sourceType === "JOB_EVIDENCE" ||
        (c.sourceType === "CUSTOMER_PORTAL_SUBMISSION" && c.primaryHref.includes("/app/jobs/")),
    );
  }
  return cards;
}

export function workStationFilterCardsByCategory(
  cards: WorkStationCard[],
  category: WorkStationFeedCategoryFilter,
): WorkStationCard[] {
  if (category === "all") return cards;
  const map: Record<WorkStationFeedCategoryFilter, WorkStationCardCategory | null> = {
    all: null,
    now: "NOW",
    next: "NEXT",
    blocked: "BLOCKED",
    waiting: "WAITING",
    needs_review: "NEEDS_REVIEW",
    done: "DONE",
  };
  const cat = map[category];
  if (!cat) return cards;
  return cards.filter((c) => c.category === cat);
}

function filterCardsBySource(cards: WorkStationCard[], source: WorkStationFeedSourceFilter): WorkStationCard[] {
  return workStationFilterCardsBySource(cards, source);
}

function filterCardsByCategory(cards: WorkStationCard[], category: WorkStationFeedCategoryFilter): WorkStationCard[] {
  return workStationFilterCardsByCategory(cards, category);
}

function countByCategory(cards: WorkStationCard[]): Record<WorkStationCardCategory, number> {
  const base: Record<WorkStationCardCategory, number> = {
    NOW: 0,
    NEXT: 0,
    BLOCKED: 0,
    WAITING: 0,
    NEEDS_REVIEW: 0,
    DONE: 0,
  };
  for (const c of cards) {
    base[c.category] += 1;
  }
  return base;
}

export type WorkStationFeedResult = {
  cards: WorkStationCard[];
  countsByCategory: Record<WorkStationCardCategory, number>;
  filters: WorkStationFeedFilters;
  /** Row count after source filter and global cap, before category tab filter. */
  cardsAfterSourceFilter: number;
};

export async function getWorkStationFeed(
  ctx: OrgSessionContext,
  filters: WorkStationFeedFilters,
): Promise<WorkStationFeedResult> {
  const built: WorkStationCard[] = [];

  if (includeOpportunityAndQuoteCards(ctx.role)) {
    built.push(...(await buildOpportunityCards(ctx)));
    built.push(...(await buildQuoteCards(ctx)));
  }

  if (includeOpportunityAndQuoteCards(ctx.role) && canViewCustomerPortalSubmissions(ctx.role)) {
    built.push(...(await buildCustomerPortalSubmissionCards(ctx)));
  }

  if (includeJobCards(ctx.role)) {
    built.push(...(await buildJobCards(ctx)));
  }

  if (canSeeJobEvidenceWorkStationCards(ctx.role)) {
    built.push(...(await buildJobEvidenceCards(ctx)));
  }

  if (canSeeEvidenceRequirementWorkStationCards(ctx.role)) {
    built.push(...(await buildJobTaskEvidenceRequirementCards(ctx)));
  }

  const sorted = sortWorkStationCards(built);
  const capped = sorted.slice(0, WORK_STATION_MAX_CARDS);
  const bySource = filterCardsBySource(capped, filters.source);
  const cards = filterCardsByCategory(bySource, filters.category);
  return {
    cards,
    countsByCategory: countByCategory(bySource),
    filters,
    cardsAfterSourceFilter: bySource.length,
  };
}

async function buildCustomerPortalSubmissionCards(ctx: OrgSessionContext): Promise<WorkStationCard[]> {
  const rows = await listNewCustomerPortalSubmissionsForWorkStation(ctx);
  const cards: WorkStationCard[] = [];
  for (const s of rows) {
    const customerName = s.customer.displayName.trim();
    const submitted = s.createdAt.toLocaleString();
    const isAppointment = s.type === CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION;
    const isAvailability = s.type === CustomerPortalSubmissionType.AVAILABILITY_NOTE;
    const isFileUpload = s.type === CustomerPortalSubmissionType.FILE_UPLOAD;
    const fileCount = isFileUpload ? s._count.attachments : 0;
    const windowPart =
      isAppointment && s.scheduledWork
        ? ` · ${formatScheduleWindowDisplay(
            s.scheduledWork.scheduledStartAt.toISOString(),
            s.scheduledWork.scheduledEndAt.toISOString(),
          )}`
        : "";
    const title = isAppointment
      ? "Customer acknowledged a scheduled visit"
      : isAvailability
        ? "Customer availability note needs review"
        : isFileUpload
          ? "Customer uploaded files for review"
          : "Customer note needs review";
    const typeLabel = isAppointment
      ? "Appointment acknowledgment"
      : isAvailability
        ? "Availability note"
        : isFileUpload
          ? "File upload"
          : "General question";
    const reason = isAppointment
      ? `${customerName}${windowPart} · ${submitted}`
      : isFileUpload
        ? `${customerName} · uploaded files for review · ${fileCount} · ${submitted}`
        : `${customerName} · ${typeLabel} · ${submitted}`;
    const primaryHref =
      s.jobId != null
        ? `/app/jobs/${s.job?.id ?? s.jobId}`
        : s.quoteId != null
          ? `/app/sales/quotes/${s.quote?.id ?? s.quoteId}`
          : "/app/work-station";
    cards.push({
      id: `CUSTOMER_PORTAL_SUBMISSION:${s.id}`,
      category: "NEEDS_REVIEW",
      priority: isAppointment || isAvailability || isFileUpload ? "HIGH" : "NORMAL",
      sourceType: "CUSTOMER_PORTAL_SUBMISSION",
      sourceId: s.id,
      title,
      reason,
      primaryActionLabel: "Review submission",
      primaryHref,
      customerName,
      quoteDisplayNumber: s.quote?.displayNumber,
      jobDisplayNumber: s.job?.displayNumber,
      statusLabel: "New",
      updatedAt: iso(s.createdAt),
    });
  }
  return cards;
}

async function buildJobTaskEvidenceRequirementCards(ctx: OrgSessionContext): Promise<WorkStationCard[]> {
  const rows = await listJobTasksNeedingAcceptedEvidenceForWorkStation(ctx);
  const cards: WorkStationCard[] = [];
  for (const r of rows) {
    const reason = `${r.customerDisplayName} · Job #${r.jobDisplayNumber} · ${r.taskTitle.trim()} · Accepted ${r.acceptedCount} of ${r.requiredCount} required`;
    cards.push({
      id: `JOB_TASK:${r.taskId}:evidence_requirement`,
      category: "NEEDS_REVIEW",
      priority: "HIGH",
      sourceType: "JOB_TASK",
      sourceId: r.taskId,
      title: "Task needs accepted evidence before completion",
      reason,
      primaryActionLabel: "Open job",
      primaryHref: `/app/jobs/${r.jobId}`,
      customerName: r.customerDisplayName,
      jobDisplayNumber: r.jobDisplayNumber,
      statusLabel: "Evidence requirement",
      updatedAt: undefined,
    });
  }
  return cards;
}

async function buildJobEvidenceCards(ctx: OrgSessionContext): Promise<WorkStationCard[]> {
  const rows = await listCandidateJobEvidenceForWorkStation(ctx);
  const cards: WorkStationCard[] = [];
  for (const e of rows) {
    const customerName = e.job.customer.displayName.trim();
    const promoted = e.promotedAt.toLocaleString();
    const reason = `${customerName} · Job #${e.job.displayNumber} · ${e.title.trim()} · Promoted ${promoted}`;
    cards.push({
      id: `JOB_EVIDENCE:${e.id}`,
      category: "NEEDS_REVIEW",
      priority: "HIGH",
      sourceType: "JOB_EVIDENCE",
      sourceId: e.id,
      title: "Evidence candidate needs review",
      reason,
      primaryActionLabel: "Review evidence",
      primaryHref: `/app/jobs/${e.job.id}#job-evidence`,
      customerName,
      jobDisplayNumber: e.job.displayNumber,
      statusLabel: "Candidate",
      updatedAt: iso(e.promotedAt),
    });
  }
  return cards;
}

async function buildOpportunityCards(ctx: OrgSessionContext): Promise<WorkStationCard[]> {
  const cards: WorkStationCard[] = [];
  const opportunities = await prisma.opportunity.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { notIn: TERMINAL_OPPORTUNITY_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
    take: WORK_STATION_QUERY_CAP,
    include: {
      customer: {
        select: {
          displayName: true,
          contactMethods: { where: { archivedAt: null }, select: { archivedAt: true } },
        },
      },
      tasks: true,
    },
  });

  const now = new Date();

  for (const opp of opportunities) {
    const customerName = opp.customer.displayName;
    const baseHref = `/app/sales/opportunities/${opp.id}`;
    const contactCount = activeContactMethods(opp.customer.contactMethods);

    if (opp.followUpAt && opp.followUpAt.getTime() < now.getTime()) {
      cards.push({
        id: `OPPORTUNITY:${opp.id}:followup`,
        category: "NEXT",
        priority: "NORMAL",
        sourceType: "OPPORTUNITY",
        sourceId: opp.id,
        title: "Opportunity follow-up due",
        reason: "The scheduled follow-up date has passed. Review next steps on the opportunity.",
        primaryActionLabel: "Open opportunity",
        primaryHref: baseHref,
        customerName,
        statusLabel: opp.status.replace(/_/g, " "),
        updatedAt: iso(opp.followUpAt),
      });
    }

    if (opp.status === OpportunityStatus.QUOTE_DRAFT_READY) {
      const draftItems = computeQuoteDraftReadiness({
        opportunity: opp,
        activeContactCount: contactCount,
        tasks: opp.tasks.map((t) => ({ isRequired: t.isRequired, status: t.status })),
      });
      const draftOk = allQuoteDraftBlockersPass(draftItems);
      const existingDraft = await findActiveDraftQuoteForOpportunity(ctx.organizationId, opp.id);
      if (draftOk && !existingDraft) {
        cards.push({
          id: `OPPORTUNITY:${opp.id}:quote-ready`,
          category: "NOW",
          priority: "HIGH",
          sourceType: "OPPORTUNITY",
          sourceId: opp.id,
          title: "Opportunity ready for quote",
          reason: "Intake checks for quote workspace are satisfied and no active draft quote exists yet.",
          primaryActionLabel: "Open opportunity",
          primaryHref: baseHref,
          customerName,
          statusLabel: opp.status.replace(/_/g, " "),
          updatedAt: iso(opp.updatedAt),
        });
      }
    }

    for (const task of opp.tasks) {
      if (task.status === OpportunityTaskStatus.COMPLETE || task.status === OpportunityTaskStatus.CANCELED) {
        continue;
      }
      const category = opportunityTaskCategory(task.status);
      const priority: WorkStationCard["priority"] =
        category === "BLOCKED" || category === "NEEDS_REVIEW" ? "HIGH" : "NORMAL";
      cards.push({
        id: `OPPORTUNITY_TASK:${opp.id}:${task.id}`,
        category,
        priority,
        sourceType: "OPPORTUNITY_TASK",
        sourceId: task.id,
        title: task.title.trim() || "Opportunity task",
        reason: `Task status is ${formatOpportunityTaskStatus(task.status)}.`,
        primaryActionLabel: "Open opportunity",
        primaryHref: baseHref,
        customerName,
        statusLabel: formatOpportunityTaskStatus(task.status),
        updatedAt: iso(task.updatedAt),
      });
    }
  }

  return cards;
}

async function buildQuoteCards(ctx: OrgSessionContext): Promise<WorkStationCard[]> {
  if (!canAuthorQuotes(ctx.role)) {
    return [];
  }

  const cards: WorkStationCard[] = [];
  const quotes = await prisma.quote.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: {
        in: [
          QuoteStatus.DRAFT,
          QuoteStatus.MISSING_INFO,
          QuoteStatus.NEEDS_REVIEW,
          QuoteStatus.READY_TO_SEND,
          QuoteStatus.SENT,
          QuoteStatus.ACCEPTED,
        ],
      },
    },
    orderBy: { updatedAt: "desc" },
    take: WORK_STATION_QUERY_CAP,
    include: { customer: { select: { displayName: true } } },
  });

  for (const q of quotes) {
    const primaryHref = `/app/sales/quotes/${q.id}`;
    const customerName = q.customer.displayName;
    const updatedAt = iso(q.updatedAt);

    if (q.status === QuoteStatus.SENT) {
      cards.push({
        id: `QUOTE:${q.id}:waiting`,
        category: "WAITING",
        priority: "NORMAL",
        sourceType: "QUOTE",
        sourceId: q.id,
        title: "Quote awaiting acceptance",
        reason: "This quote has been sent and is waiting on customer acceptance or a recorded decision.",
        primaryActionLabel: "Open quote",
        primaryHref,
        customerName,
        quoteDisplayNumber: q.displayNumber,
        statusLabel: "Sent",
        updatedAt,
      });
      continue;
    }

    if (q.status === QuoteStatus.ACCEPTED) {
      if (canActivateAcceptedQuoteAsJob(ctx.role)) {
        cards.push({
          id: `QUOTE:${q.id}:activate`,
          category: "NOW",
          priority: "HIGH",
          sourceType: "QUOTE",
          sourceId: q.id,
          title: "Accepted quote ready to create job",
          reason: "The quote is accepted. Create the job from the quote workspace when execution should begin.",
          primaryActionLabel: "Open quote",
          primaryHref,
          customerName,
          quoteDisplayNumber: q.displayNumber,
          statusLabel: "Accepted",
          updatedAt,
        });
      } else {
        cards.push({
          id: `QUOTE:${q.id}:accepted`,
          category: "WAITING",
          priority: "NORMAL",
          sourceType: "QUOTE",
          sourceId: q.id,
          title: "Accepted quote awaiting job activation",
          reason: "The quote is accepted. An office or management role can activate the job from the quote workspace.",
          primaryActionLabel: "Open quote",
          primaryHref,
          customerName,
          quoteDisplayNumber: q.displayNumber,
          statusLabel: "Accepted",
          updatedAt,
        });
      }
      continue;
    }

    const bundle = await getQuoteReadinessBundle(ctx.organizationId, q.id);
    if (!bundle) continue;

    const readiness = evaluateQuoteSendReadiness({
      quote: bundle,
      opportunity: bundle.opportunity,
      customerContacts: bundle.customer.contactMethods,
      lineItems: bundle.lineItems,
      quoteTasks: bundle.tasks,
      assumptions: bundle.assumptions,
    });

    const sendOk = allQuoteSendBlockersPass(readiness);
    const internalItem = readiness.find((i) => i.key === "internal_review");
    const internalFails = internalItem?.severity === "BLOCKER" && internalItem.status === "FAIL";
    const otherBlockers = readiness.filter(
      (i) => i.severity === "BLOCKER" && i.status === "FAIL" && i.key !== "internal_review",
    );

    if (q.status === QuoteStatus.READY_TO_SEND && sendOk) {
      cards.push({
        id: `QUOTE:${q.id}:send`,
        category: "NOW",
        priority: "HIGH",
        sourceType: "QUOTE",
        sourceId: q.id,
        title: "Quote ready to send",
        reason: "Send readiness checks pass. Review the customer preview, then send from the quote workspace.",
        primaryActionLabel: "Open quote",
        primaryHref,
        customerName,
        quoteDisplayNumber: q.displayNumber,
        statusLabel: "Ready to send",
        updatedAt,
      });
      continue;
    }

    if (q.status === QuoteStatus.NEEDS_REVIEW || internalFails) {
      const blockedReasons = readiness
        .filter((i) => i.severity === "BLOCKER" && i.status === "FAIL")
        .map((i) => `${i.label}: ${i.explanation}`);
      cards.push({
        id: `QUOTE:${q.id}:needs-review`,
        category: "NEEDS_REVIEW",
        priority: "HIGH",
        sourceType: "QUOTE",
        sourceId: q.id,
        title: "Quote needs internal review",
        reason:
          blockedReasons[0] ??
          "Internal review is required before this quote can move forward. Open the quote workspace to resolve review items.",
        primaryActionLabel: "Open quote",
        primaryHref,
        customerName,
        quoteDisplayNumber: q.displayNumber,
        statusLabel: "Needs review",
        blockedReasons: blockedReasons.length ? blockedReasons : undefined,
        updatedAt,
      });
      continue;
    }

    if (otherBlockers.length > 0 || !sendOk) {
      const blockedReasons = readiness
        .filter((i) => i.severity === "BLOCKER" && i.status === "FAIL")
        .map((i) => `${i.label}: ${i.explanation}`);
      cards.push({
        id: `QUOTE:${q.id}:blocked`,
        category: "BLOCKED",
        priority: "HIGH",
        sourceType: "QUOTE",
        sourceId: q.id,
        title: "Quote blocked from sending",
        reason:
          blockedReasons[0] ??
          "Send readiness checks failed. Open the quote workspace to resolve blockers before sending.",
        primaryActionLabel: "Open quote",
        primaryHref,
        customerName,
        quoteDisplayNumber: q.displayNumber,
        statusLabel: q.status.replace(/_/g, " "),
        blockedReasons: blockedReasons.length ? blockedReasons : undefined,
        updatedAt,
      });
    }
  }

  return cards;
}

async function buildJobCards(ctx: OrgSessionContext): Promise<WorkStationCard[]> {
  const cards: WorkStationCard[] = [];
  const jobs = await prisma.job.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: { in: [JobStatus.ACTIVE, JobStatus.PAUSED] },
    },
    orderBy: { updatedAt: "desc" },
    take: WORK_STATION_QUERY_CAP,
    include: {
      customer: { select: { displayName: true } },
      quote: { select: { displayNumber: true } },
    },
  });

  if (jobs.length === 0) {
    return cards;
  }

  const jobIds = jobs.map((j) => j.id);
  const tasks = await prisma.jobTask.findMany({
    where: { organizationId: ctx.organizationId, jobId: { in: jobIds } },
    select: {
      id: true,
      jobId: true,
      title: true,
      status: true,
      isRequired: true,
      blockedReason: true,
      updatedAt: true,
    },
  });

  const tasksByJob = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByJob.get(t.jobId) ?? [];
    list.push(t);
    tasksByJob.set(t.jobId, list);
  }

  const progressMap = await getJobProgressMapForJobs(ctx.organizationId, jobIds);
  const salesReadOnly = ctx.role === MembershipRole.SALES;

  for (const job of jobs) {
    const jobTasks = tasksByJob.get(job.id) ?? [];
    const primaryHref = `/app/jobs/${job.id}`;
    const customerName = job.customer.displayName;
    const updatedAt = iso(job.updatedAt);
    const roleHint = salesReadOnly
      ? "Sales view: use the job workspace for status context. Task updates are limited to operations and field roles."
      : undefined;

    if (job.status === JobStatus.PAUSED) {
      const reasonText =
        job.statusReason?.trim() ||
        "This job is paused. Operations or management can resume it from the job workspace when work should continue.";
      cards.push({
        id: `JOB:${job.id}:paused`,
        category: "WAITING",
        priority: "NORMAL",
        sourceType: "JOB",
        sourceId: job.id,
        title: "Job paused",
        reason: reasonText,
        primaryActionLabel: "Open job",
        primaryHref,
        customerName,
        jobDisplayNumber: job.displayNumber,
        quoteDisplayNumber: job.quote.displayNumber,
        statusLabel: "Paused",
        roleHint,
        updatedAt,
      });
      continue;
    }

    const blockedList = jobTasks.filter((t) => t.status === JobTaskStatus.BLOCKED);
    if (blockedList.length > 0) {
      const blockedReasons = blockedList
        .map((t) => {
          const r = t.blockedReason?.trim();
          return r ? `${t.title}: ${r}` : `${t.title}: Blocked (add detail in job workspace if missing).`;
        })
        .filter(Boolean);
      const anyRequiredBlocked = blockedList.some((t) => t.isRequired);
      cards.push({
        id: `JOB:${job.id}:blocked`,
        category: "BLOCKED",
        priority: anyRequiredBlocked ? "CRITICAL" : "HIGH",
        sourceType: "JOB",
        sourceId: job.id,
        title: "Job has blocked work",
        reason:
          blockedReasons[0] ??
          "One or more tasks are blocked. Open the job workspace to review tasks and reasons.",
        primaryActionLabel: "Open job",
        primaryHref,
        customerName,
        jobDisplayNumber: job.displayNumber,
        quoteDisplayNumber: job.quote.displayNumber,
        statusLabel: "Blocked tasks",
        blockedReasons: blockedReasons.length ? blockedReasons : undefined,
        roleHint,
        updatedAt,
      });
    }

    const inProgress = jobTasks.filter((t) => t.status === JobTaskStatus.IN_PROGRESS);
    if (inProgress.length > 0) {
      cards.push({
        id: `JOB:${job.id}:in_progress`,
        category: "NOW",
        priority: "HIGH",
        sourceType: "JOB",
        sourceId: job.id,
        title: "Job has work in progress",
        reason: salesReadOnly
          ? `${inProgress.length} task(s) are in progress. Open the job workspace for status context.`
          : `${inProgress.length} task(s) are in progress. Continue execution in the job workspace.`,
        primaryActionLabel: "Open job",
        primaryHref,
        customerName,
        jobDisplayNumber: job.displayNumber,
        quoteDisplayNumber: job.quote.displayNumber,
        statusLabel: "In progress",
        roleHint,
        updatedAt,
      });
    } else {
      const ready = jobTasks.filter((t) => t.status === JobTaskStatus.READY);
      if (ready.length > 0) {
        cards.push({
          id: `JOB:${job.id}:ready`,
          category: "NOW",
          priority: "NORMAL",
          sourceType: "JOB",
          sourceId: job.id,
          title: "Job has ready work",
          reason: salesReadOnly
            ? `${ready.length} task(s) are ready to start. Open the job workspace for status context.`
            : `${ready.length} task(s) are ready to start or assign. Open the job workspace to update task status.`,
          primaryActionLabel: "Open job",
          primaryHref,
          customerName,
          jobDisplayNumber: job.displayNumber,
          quoteDisplayNumber: job.quote.displayNumber,
          statusLabel: "Ready",
          roleHint,
          updatedAt,
        });
      }
    }

    const progress = progressMap.get(job.id);
    if (progress && progress.requiredTotal > progress.requiredComplete) {
      const hasAttention =
        blockedList.length > 0 ||
        inProgress.length > 0 ||
        jobTasks.some((t) => t.status === JobTaskStatus.READY);
      if (!hasAttention) {
        cards.push({
          id: `JOB:${job.id}:next_required`,
          category: "NEXT",
          priority: "NORMAL",
          sourceType: "JOB",
          sourceId: job.id,
          title: "Job has required work remaining",
          reason: salesReadOnly
            ? `${progress.requiredComplete} of ${progress.requiredTotal} required tasks are complete. Open the job workspace for context.`
            : `${progress.requiredComplete} of ${progress.requiredTotal} required tasks are complete. Open the job workspace to plan the next steps.`,
          primaryActionLabel: "Open job",
          primaryHref,
          customerName,
          jobDisplayNumber: job.displayNumber,
          quoteDisplayNumber: job.quote.displayNumber,
          statusLabel: "Required tasks open",
          roleHint,
          updatedAt,
        });
      }
    }
  }

  return dedupeJobCards(cards);
}

/**
 * If both in-progress and ready cards exist for the same job, keep in-progress only for NOW noise control.
 */
function dedupeJobCards(cards: WorkStationCard[]): WorkStationCard[] {
  const hasInProgress = new Set<string>();
  for (const c of cards) {
    if (c.sourceType === "JOB" && c.id.endsWith(":in_progress")) {
      hasInProgress.add(c.sourceId);
    }
  }
  return cards.filter((c) => {
    if (c.sourceType === "JOB" && c.id.endsWith(":ready") && hasInProgress.has(c.sourceId)) {
      return false;
    }
    return true;
  });
}
