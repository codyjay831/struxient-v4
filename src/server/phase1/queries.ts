import { prisma } from "@/lib/prisma";
import type { OpportunityStatus } from "@prisma/client";

export async function listCustomersForOrg(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      contactMethods: {
        where: { archivedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      _count: {
        select: {
          opportunities: true,
          quotes: true,
          jobs: true,
        },
      },
    },
  });
}

export async function getCustomerDetail(organizationId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    include: {
      contactMethods: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      opportunities: {
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          status: true,
          serviceType: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      quotes: {
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          displayNumber: true,
          status: true,
          title: true,
          totalCents: true,
          createdAt: true,
          updatedAt: true,
          opportunity: { select: { id: true, title: true } },
        },
      },
      jobs: {
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          displayNumber: true,
          status: true,
          title: true,
          updatedAt: true,
        },
      },
    },
  });
}

export async function listCustomerActivity(organizationId: string, customerId: string) {
  return prisma.opportunityActivityEvent.findMany({
    where: { organizationId, customerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { name: true, email: true } },
      opportunity: { select: { id: true, title: true } },
    },
  });
}

export async function listOrganizationMembers(organizationId: string) {
  return prisma.membership.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ user: { name: "asc" } }, { user: { email: "asc" } }],
  });
}

export async function listOpportunitiesForOrg(
  organizationId: string,
  statusFilter?: OpportunityStatus | "ALL" | undefined,
) {
  return prisma.opportunity.findMany({
    where: {
      organizationId,
      ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      customer: { select: { id: true, displayName: true } },
    },
    take: 200,
  });
}

export async function getOpportunityDetail(organizationId: string, opportunityId: string) {
  return prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
    include: {
      customer: {
        include: {
          contactMethods: {
            where: { archivedAt: null },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
        },
      },
      salesOwner: { select: { id: true, name: true, email: true } },
      tasks: { orderBy: [{ isRequired: "desc" }, { createdAt: "asc" }] },
      quotes: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          displayNumber: true,
          status: true,
          title: true,
          updatedAt: true,
          sentAt: true,
          createdAt: true,
          totalCents: true,
        },
      },
    },
  });
}

export async function listOpportunityActivity(organizationId: string, opportunityId: string) {
  return prisma.opportunityActivityEvent.findMany({
    where: { organizationId, opportunityId },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      actor: { select: { name: true, email: true } },
    },
  });
}
