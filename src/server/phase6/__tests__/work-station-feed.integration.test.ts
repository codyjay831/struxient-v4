/**
 * Phase 6 Work Station feed: org scope, RBAC, quote/job/opportunity derivation, deep links.
 * Requires DATABASE_URL and PostgreSQL.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  JobTaskStatus,
  MembershipRole,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
  PricingMode,
  QuoteLineMode,
  QuoteTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
} from "@/server/phase2/quote-mutations";
import {
  quoteMutationActivateAcceptedQuoteAsJob,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import { getWorkStationFeed } from "@/server/phase6/work-station-feed";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Work Station feed (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userCrewAId: string;
  let userSalesBId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let crewCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  const suffix = `ws6-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("ws6-pass-12", 8);
    const orgA = await prisma.organization.create({
      data: { name: `Org WS6A ${suffix}`, slug: `org-ws6a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org WS6B ${suffix}`, slug: `org-ws6b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-ws6a-${suffix}@test.local`, passwordHash, name: "Sales WS6A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-ws6a-${suffix}@test.local`, passwordHash, name: "Office WS6A" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-ws6a-${suffix}@test.local`, passwordHash, name: "Crew WS6A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-ws6b-${suffix}@test.local`, passwordHash, name: "Sales WS6B" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userCrewAId = userCrewA.id;
    userSalesBId = userSalesB.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userOfficeAId, organizationId: orgAId, role: MembershipRole.OFFICE },
    });
    await prisma.membership.create({
      data: { userId: userCrewAId, organizationId: orgAId, role: MembershipRole.CREW_LEAD },
    });
    await prisma.membership.create({
      data: { userId: userSalesBId, organizationId: orgBId, role: MembershipRole.SALES },
    });

    salesCtxA = {
      userId: userSalesAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.SALES,
      email: userSalesA.email!,
      name: userSalesA.name,
    };
    officeCtxA = {
      userId: userOfficeAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.OFFICE,
      email: userOfficeA.email!,
      name: userOfficeA.name,
    };
    crewCtxA = {
      userId: userCrewAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.CREW_LEAD,
      email: userCrewA.email!,
      name: userCrewA.name,
    };
    salesCtxB = {
      userId: userSalesBId,
      organizationId: orgBId,
      organizationName: orgB.name,
      role: MembershipRole.SALES,
      email: userSalesB.email!,
      name: userSalesB.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer WS6 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-ws6-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer WS6B ${suffix}` },
    });
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerB.id,
        type: CustomerContactType.EMAIL,
        value: `cust-ws6b-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const oppB = await prisma.opportunity.create({
      data: {
        organizationId: orgBId,
        customerId: customerB.id,
        title: `Opp B ${suffix}`,
        serviceType: "Work",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope B",
      },
    });
    const draftB = await quoteMutationCreateDraftFromOpportunity(salesCtxB, oppB.id);
    expect(draftB.ok).toBe(true);
    if (!draftB.ok || draftB.outcome !== "created") throw new Error("draft b");
    await prisma.quote.update({
      where: { id: draftB.quoteId },
      data: { customerFacingIntro: "Intro" },
    });
    await quoteMutationAddLineItem(
      salesCtxB,
      fd({
        quoteId: draftB.quoteId,
        title: "Line",
        customerDescription: "Desc",
        quantity: "1",
        unitPriceCents: "100",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userCrewAId, userSalesBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedOppWithDraftQuoteNoLines() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp WS6 ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope",
      },
    });
    const c = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    expect(c.ok && c.outcome === "created").toBe(true);
    if (!c.ok || c.outcome !== "created") throw new Error("draft");
    await prisma.quote.update({
      where: { id: c.quoteId },
      data: { customerFacingIntro: "Intro" },
    });
    return { oppId: opp.id, quoteId: c.quoteId };
  }

  it("office sees BLOCKED quote card with readiness explanation and quote deep link", async () => {
    const { quoteId } = await seedOppWithDraftQuoteNoLines();
    const { cards } = await getWorkStationFeed(officeCtxA, { source: "all", category: "all" });
    const blocked = cards.find((c) => c.id === `QUOTE:${quoteId}:blocked`);
    expect(blocked).toBeDefined();
    expect(blocked?.category).toBe("BLOCKED");
    expect(blocked?.primaryHref).toBe(`/app/sales/quotes/${quoteId}`);
    expect(blocked?.reason.length).toBeGreaterThan(10);
  });

  it("crew does not receive quote or opportunity cards", async () => {
    await seedOppWithDraftQuoteNoLines();
    const { cards } = await getWorkStationFeed(crewCtxA, { source: "all", category: "all" });
    expect(cards.every((c) => c.sourceType === "JOB" || c.sourceType === "JOB_TASK")).toBe(true);
  });

  it("cross-org: org A feed never links to org B quote id", async () => {
    const quoteB = await prisma.quote.findFirstOrThrow({
      where: { organizationId: orgBId },
      select: { id: true },
    });
    const { cards } = await getWorkStationFeed(officeCtxA, { source: "all", category: "all" });
    const leaked = cards.filter((c) => c.primaryHref.includes(quoteB.id));
    expect(leaked).toHaveLength(0);
  });

  it("SENT quote produces WAITING card; ACCEPTED gives office NOW activate and sales WAITING without activate id", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp sent ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope",
      },
    });
    const c = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    if (!c.ok || c.outcome !== "created") throw new Error("draft");
    const quoteId = c.quoteId;
    await prisma.quote.update({ where: { id: quoteId }, data: { customerFacingIntro: "Intro" } });
    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Line",
        customerDescription: "Customer-facing line description text.",
        quantity: "1",
        unitPriceCents: "10000",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    const officeSent = await getWorkStationFeed(officeCtxA, { source: "quotes", category: "all" });
    expect(officeSent.cards.some((x) => x.id === `QUOTE:${quoteId}:waiting`)).toBe(true);

    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));

    const officeAcc = await getWorkStationFeed(officeCtxA, { source: "quotes", category: "now" });
    expect(officeAcc.cards.some((x) => x.id === `QUOTE:${quoteId}:activate`)).toBe(true);

    const salesAcc = await getWorkStationFeed(salesCtxA, { source: "quotes", category: "all" });
    expect(salesAcc.cards.some((x) => x.id === `QUOTE:${quoteId}:activate`)).toBe(false);
    expect(salesAcc.cards.some((x) => x.id === `QUOTE:${quoteId}:accepted`)).toBe(true);
  });

  it("READY opportunity task maps to NOW with opportunity deep link", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp task ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope",
      },
    });
    const task = await prisma.opportunityTask.create({
      data: {
        opportunityId: opp.id,
        title: "Site visit",
        kind: OpportunityTaskKind.SITE_VISIT,
        status: OpportunityTaskStatus.READY,
        isRequired: true,
      },
    });
    const { cards } = await getWorkStationFeed(officeCtxA, { source: "opportunities", category: "now" });
    const tcard = cards.find((c) => c.id === `OPPORTUNITY_TASK:${opp.id}:${task.id}`);
    expect(tcard).toBeDefined();
    expect(tcard?.category).toBe("NOW");
    expect(tcard?.primaryHref).toBe(`/app/sales/opportunities/${opp.id}`);
  });

  it("blocked job task creates BLOCKED job card with reason", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp job ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope",
      },
    });
    const c = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    if (!c.ok || c.outcome !== "created") throw new Error("draft");
    const quoteId = c.quoteId;
    await prisma.quote.update({ where: { id: quoteId }, data: { customerFacingIntro: "Intro" } });
    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Line",
        customerDescription: "Customer-facing line description text.",
        quantity: "1",
        unitPriceCents: "10000",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    const liJob = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const stJob = await prisma.quoteLineExecutionStage.create({
      data: { organizationId: orgAId, quoteLineItemId: liJob.id, title: "Stage WS6 job", sortOrder: 0 },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: stJob.id,
        title: "Field task",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
      },
    });
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const act = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) return;
    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const task = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id } });

    const block = await jobMutationUpdateTaskStatus(
      crewCtxA,
      fd({
        jobId: job.id,
        taskId: task.id,
        status: JobTaskStatus.BLOCKED,
        blockedReason: "Permit delayed by city.",
      }),
    );
    expect(block.ok).toBe(true);

    const { cards } = await getWorkStationFeed(officeCtxA, { source: "jobs", category: "blocked" });
    const jc = cards.find((c) => c.id === `JOB:${job.id}:blocked`);
    expect(jc).toBeDefined();
    expect(jc?.blockedReasons?.some((r) => r.includes("Permit delayed"))).toBe(true);
    expect(jc?.primaryHref).toBe(`/app/jobs/${job.id}`);
  });
});
