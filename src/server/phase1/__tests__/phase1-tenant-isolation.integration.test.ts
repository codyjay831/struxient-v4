/**
 * Integration tests: Phase 1 data access must never cross organization boundaries.
 * Requires DATABASE_URL (e.g. from `.env`) and a reachable PostgreSQL instance.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  MembershipRole,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
  Prisma,
  PricingMode,
  QuoteLineMode,
  QuoteStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getCustomerDetail,
  listCustomerActivity,
  listCustomersForOrg,
  listOpportunitiesForOrg,
  listOpportunityActivity,
  getOpportunityDetail,
} from "@/server/phase1/queries";
import { getQuoteIdInOrganization, getQuoteWorkspace } from "@/server/phase2/quote-queries";

config({ path: ".env" });

describe("Phase 1 tenant isolation (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let customerAId: string;
  let customerBId: string;
  let opportunityAId: string;
  let opportunityBId: string;
  let taskBId: string;
  let contactBId: string;
  let quoteAId: string;
  let quoteLineAId: string;
  const suffix = `tis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("tenant-isolation-test-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org A ${suffix}`, slug: `org-a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `org-b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userA = await prisma.user.create({
      data: {
        email: `user-a-${suffix}@tenant-isolation.test`,
        passwordHash,
        name: "User A",
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `user-b-${suffix}@tenant-isolation.test`,
        passwordHash,
        name: "User B",
      },
    });
    userAId = userA.id;
    userBId = userB.id;

    await prisma.membership.create({
      data: { userId: userAId, organizationId: orgAId, role: MembershipRole.MEMBER },
    });
    await prisma.membership.create({
      data: { userId: userBId, organizationId: orgBId, role: MembershipRole.MEMBER },
    });

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer A ${suffix}` },
    });
    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer B ${suffix}` },
    });
    customerAId = customerA.id;
    customerBId = customerB.id;

    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `a-${suffix}@example.com`,
        isPrimary: true,
      },
    });
    const contactB = await prisma.customerContactMethod.create({
      data: {
        customerId: customerBId,
        type: CustomerContactType.EMAIL,
        value: `b-${suffix}@example.com`,
        isPrimary: true,
      },
    });
    contactBId = contactB.id;

    const oppA = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp A ${suffix}`,
        serviceType: "Service A",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope A",
      },
    });
    const oppB = await prisma.opportunity.create({
      data: {
        organizationId: orgBId,
        customerId: customerBId,
        title: `Opp B ${suffix}`,
        serviceType: "Service B",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope B",
      },
    });
    opportunityAId = oppA.id;
    opportunityBId = oppB.id;

    await prisma.opportunityTask.create({
      data: {
        opportunityId: opportunityAId,
        title: "Task A",
        kind: OpportunityTaskKind.INTAKE,
        status: OpportunityTaskStatus.NOT_READY,
      },
    });
    const taskB = await prisma.opportunityTask.create({
      data: {
        opportunityId: opportunityBId,
        title: "Task B",
        kind: OpportunityTaskKind.INTAKE,
        status: OpportunityTaskStatus.NOT_READY,
        outcome: "Secret org B outcome",
      },
    });
    taskBId = taskB.id;

    await prisma.opportunityActivityEvent.create({
      data: {
        organizationId: orgBId,
        opportunityId: opportunityBId,
        customerId: customerBId,
        eventType: "OPPORTUNITY_CREATED",
        actorUserId: userBId,
        summary: "Org B activity",
      },
    });

    const quoteA = await prisma.quote.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        opportunityId: opportunityAId,
        displayNumber: 1,
        title: `Quote A ${suffix}`,
        scopeIntent: "Scope for quote tenant test",
        serviceAddressTbd: true,
        createdById: userAId,
        status: QuoteStatus.DRAFT,
      },
    });
    quoteAId = quoteA.id;
    const lineA = await prisma.quoteLineItem.create({
      data: {
        organizationId: orgAId,
        quoteId: quoteAId,
        title: "Line A",
        customerDescription: "Customer-facing line",
        quantity: new Prisma.Decimal(1),
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
        unitPriceCents: 100,
        lineTotalCents: 100,
      },
    });
    quoteLineAId = lineA.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("getCustomerDetail does not return another org customer", async () => {
    expect(await getCustomerDetail(orgAId, customerBId)).toBeNull();
    expect(await getCustomerDetail(orgBId, customerAId)).toBeNull();
    expect((await getCustomerDetail(orgAId, customerAId))?.id).toBe(customerAId);
  });

  it("listCustomersForOrg only returns own org rows", async () => {
    const listA = await listCustomersForOrg(orgAId);
    expect(listA.every((c) => c.organizationId === orgAId)).toBe(true);
    expect(listA.some((c) => c.id === customerBId)).toBe(false);
  });

  it("getOpportunityDetail does not return another org opportunity", async () => {
    expect(await getOpportunityDetail(orgAId, opportunityBId)).toBeNull();
    expect(await getOpportunityDetail(orgBId, opportunityAId)).toBeNull();
  });

  it("listOpportunitiesForOrg does not include other org opportunities", async () => {
    const listA = await listOpportunitiesForOrg(orgAId);
    expect(listA.some((o) => o.id === opportunityBId)).toBe(false);
  });

  it("listOpportunityActivity does not leak events for wrong org + opportunity id pair", async () => {
    const rows = await listOpportunityActivity(orgAId, opportunityBId);
    expect(rows).toEqual([]);
  });

  it("listCustomerActivity does not leak when org mismatches customer tenant", async () => {
    const rows = await listCustomerActivity(orgAId, customerBId);
    expect(rows).toEqual([]);
  });

  it("mutations scoped by opportunity.organizationId do not affect other org tasks", async () => {
    const res = await prisma.opportunityTask.updateMany({
      where: { id: taskBId, opportunity: { organizationId: orgAId } },
      data: { title: "hacked" },
    });
    expect(res.count).toBe(0);
    const stillB = await prisma.opportunityTask.findUniqueOrThrow({ where: { id: taskBId } });
    expect(stillB.title).toBe("Task B");
  });

  it("contact updates scoped by customer.organizationId do not affect other org contacts", async () => {
    const res = await prisma.customerContactMethod.updateMany({
      where: { id: contactBId, customer: { organizationId: orgAId } },
      data: { value: "hacked@evil.test" },
    });
    expect(res.count).toBe(0);
    const stillB = await prisma.customerContactMethod.findUniqueOrThrow({ where: { id: contactBId } });
    expect(stillB.value).toBe(`b-${suffix}@example.com`);
  });

  it("opportunity terminal-style updateMany respects org scope", async () => {
    const res = await prisma.opportunity.updateMany({
      where: { id: opportunityBId, organizationId: orgAId },
      data: { status: OpportunityStatus.LOST, lostReason: "should not apply" },
    });
    expect(res.count).toBe(0);
    const stillB = await prisma.opportunity.findUniqueOrThrow({ where: { id: opportunityBId } });
    expect(stillB.status).toBe(OpportunityStatus.NEW);
  });

  it("getQuoteWorkspace does not return another org quote", async () => {
    expect(await getQuoteWorkspace(orgBId, quoteAId)).toBeNull();
    expect((await getQuoteWorkspace(orgAId, quoteAId))?.id).toBe(quoteAId);
  });

  it("getQuoteIdInOrganization does not match other org", async () => {
    expect(await getQuoteIdInOrganization(orgBId, quoteAId)).toBeNull();
    expect((await getQuoteIdInOrganization(orgAId, quoteAId))?.id).toBe(quoteAId);
  });

  it("quote line updateMany respects org scope", async () => {
    const res = await prisma.quoteLineItem.updateMany({
      where: { id: quoteLineAId, organizationId: orgBId },
      data: { title: "hacked" },
    });
    expect(res.count).toBe(0);
    const still = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id: quoteLineAId } });
    expect(still.title).toBe("Line A");
  });
});
