import {
  QuoteStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";

const ACTIVE_DRAFT_STATUSES: QuoteStatus[] = [
  QuoteStatus.DRAFT,
  QuoteStatus.MISSING_INFO,
  QuoteStatus.NEEDS_REVIEW,
  QuoteStatus.READY_TO_SEND,
];

export const quoteWorkspaceInclude = {
  customer: {
    include: {
      contactMethods: {
        where: { archivedAt: null },
        orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
      },
    },
  },
  opportunity: true,
  lineItems: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      executionStages: {
        orderBy: { sortOrder: "asc" as const },
        include: { tasks: { orderBy: { sortOrder: "asc" as const } } },
      },
    },
  },
  tasks: { orderBy: { sortOrder: "asc" as const } },
  assumptions: { orderBy: { sortOrder: "asc" as const } },
  createdBy: { select: { id: true, name: true, email: true } },
  owner: { select: { id: true, name: true, email: true } },
  job: { select: { id: true, displayNumber: true, status: true } },
} satisfies Prisma.QuoteInclude;

export type QuoteWorkspacePayload = Prisma.QuoteGetPayload<{ include: typeof quoteWorkspaceInclude }>;

/**
 * Minimal org-scoped existence check. Use before loading full workspace for authorized users.
 * Returns null when the id is missing or not in the organization (same response as cross-org — do not branch on this for UX that leaks existence).
 */
export async function getQuoteIdInOrganization(organizationId: string, quoteId: string) {
  return prisma.quote.findFirst({
    where: { id: quoteId, organizationId },
    select: { id: true },
  });
}

export async function getQuoteWorkspace(organizationId: string, quoteId: string) {
  return prisma.quote.findFirst({
    where: { id: quoteId, organizationId },
    include: quoteWorkspaceInclude,
  });
}

export async function findActiveDraftQuoteForOpportunity(organizationId: string, opportunityId: string) {
  return prisma.quote.findFirst({
    where: {
      organizationId,
      opportunityId,
      status: { in: ACTIVE_DRAFT_STATUSES },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listQuotesForOpportunity(organizationId: string, opportunityId: string) {
  return prisma.quote.findMany({
    where: { organizationId, opportunityId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      displayNumber: true,
      status: true,
      title: true,
      updatedAt: true,
      sentAt: true,
    },
  });
}

export async function listQuotesForCustomer(organizationId: string, customerId: string) {
  return prisma.quote.findMany({
    where: { organizationId, customerId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      displayNumber: true,
      status: true,
      title: true,
      updatedAt: true,
      opportunity: { select: { id: true, title: true } },
    },
  });
}

export async function listQuoteActivity(organizationId: string, quoteId: string) {
  return prisma.quoteActivityEvent.findMany({
    where: { organizationId, quoteId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

/** If the latest email delivery failure was not followed by a successful delivery event, surface it in the UI. */
export async function getQuoteLatestOpenEmailDeliveryFailure(organizationId: string, quoteId: string) {
  const failed = await prisma.quoteActivityEvent.findFirst({
    where: {
      organizationId,
      quoteId,
      eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_FAILED,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!failed) return null;
  const recovered = await prisma.quoteActivityEvent.findFirst({
    where: {
      organizationId,
      quoteId,
      eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_SENT,
      createdAt: { gt: failed.createdAt },
    },
    select: { id: true },
  });
  if (recovered) return null;
  const payload = failed.payload as { errorSummary?: string; recipientEmail?: string } | null;
  return {
    summary: failed.summary,
    recipientEmail: typeof payload?.recipientEmail === "string" ? payload.recipientEmail : null,
    errorSummary: typeof payload?.errorSummary === "string" ? payload.errorSummary : null,
    createdAt: failed.createdAt,
  };
}

/** Latest successful transactional email delivery row for staff UI ("Sent by email to …"). */
export async function getQuoteLastProposalEmailRecipient(organizationId: string, quoteId: string): Promise<string | null> {
  const row = await prisma.quoteActivityEvent.findFirst({
    where: {
      organizationId,
      quoteId,
      eventType: QuoteActivityEventType.QUOTE_EMAIL_DELIVERY_SENT,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  const payload = row.payload as { recipientEmail?: string } | null;
  return typeof payload?.recipientEmail === "string" ? payload.recipientEmail : null;
}

/** Readiness evaluation bundle (lighter than full workspace include). */
export async function getQuoteReadinessBundle(organizationId: string, quoteId: string) {
  return prisma.quote.findFirst({
    where: { id: quoteId, organizationId },
    include: {
      opportunity: true,
      customer: {
        include: {
          contactMethods: {
            where: { archivedAt: null },
            orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
          },
        },
      },
      lineItems: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          executionStages: {
            orderBy: { sortOrder: "asc" as const },
            include: { tasks: { orderBy: { sortOrder: "asc" as const } } },
          },
        },
      },
      tasks: true,
      assumptions: true,
    },
  });
}

export async function nextQuoteDisplayNumber(organizationId: string, tx: Prisma.TransactionClient) {
  const agg = await tx.quote.aggregate({
    where: { organizationId },
    _max: { displayNumber: true },
  });
  return (agg._max.displayNumber ?? 0) + 1;
}
