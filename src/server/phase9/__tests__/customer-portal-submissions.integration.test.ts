/**
 * Phase 9: customer portal submissions, staff RBAC, Work Station cards, no source mutation.
 * Requires DATABASE_URL and PostgreSQL.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  CustomerPortalSubmissionStatus,
  CustomerPortalSubmissionType,
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
  quoteMutationInitializeJobFromAcceptedQuote,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { jobMutationActivateExecution } from "@/server/phase4/job-activation";
import { createPortalAccessTokenForQuote, revokeActivePortalTokenForQuote } from "@/server/phase8/portal-token-mutations";
import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { createPortalSubmissionFromToken } from "@/server/phase9/portal-submission-actions";
import { resolvePortalTokenForSubmission } from "@/server/phase9/portal-submission-token-resolve";
import {
  listCustomerPortalSubmissionsForQuote,
  listNewCustomerPortalSubmissionsForWorkStation,
} from "@/server/phase9/customer-portal-submission-queries";
import {
  dismissCustomerPortalSubmission,
  markCustomerPortalSubmissionActioned,
  markCustomerPortalSubmissionReviewed,
} from "@/server/phase9/customer-portal-submission-mutations";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";
import { PORTAL_SUBMISSION_MESSAGE_MAX } from "@/server/phase9/customer-portal-submission-types";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 9 customer portal submissions (integration)", () => {
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
  const suffix = `p9-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase9-portal-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P9A ${suffix}`, slug: `org-p9a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P9B ${suffix}`, slug: `org-p9b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p9a-${suffix}@test.local`, passwordHash, name: "Sales P9A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p9a-${suffix}@test.local`, passwordHash, name: "Office P9A" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-p9a-${suffix}@test.local`, passwordHash, name: "Crew P9A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p9b-${suffix}@test.local`, passwordHash, name: "Sales P9B" },
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
      data: { userId: userCrewAId, organizationId: orgAId, role: MembershipRole.FIELD_WORKER },
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
      role: MembershipRole.FIELD_WORKER,
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
      data: { organizationId: orgAId, displayName: `Customer P9 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p9-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer P9B ${suffix}` },
    });
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerB.id,
        type: CustomerContactType.EMAIL,
        value: `cust-p9b-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userCrewAId, userSalesBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedSentQuote() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P9 ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope",
      },
    });
    await prisma.opportunityTask.create({
      data: {
        opportunityId: opp.id,
        title: "Opt",
        kind: OpportunityTaskKind.INTAKE,
        status: OpportunityTaskStatus.NOT_READY,
        isRequired: false,
      },
    });

    const c = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    expect(c.ok && c.outcome === "created").toBe(true);
    if (!c.ok || c.outcome !== "created") throw new Error("draft");
    const quoteId = c.quoteId;

    await prisma.quote.update({
      where: { id: quoteId },
      data: { customerFacingIntro: "Intro" },
    });

    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Line A",
        customerDescription: "Work A",
        quantity: "1",
        unitPriceCents: "10000",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    const li = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const st = await prisma.quoteLineExecutionStage.create({
      data: { organizationId: orgAId, quoteLineItemId: li.id, title: "Stage 1", sortOrder: 0 },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: st.id,
        title: "Internal task title",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
        customerVisible: true,
        customerLabel: "Permitting",
      },
    });

    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    return { oppId: opp.id, quoteId };
  }

  it("valid token creates GENERAL_REQUEST and AVAILABILITY_NOTE; stores scope from token; no job/quote mutation", async () => {
    const { oppId, quoteId } = await seedSentQuote();

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    const jobCountBefore = await prisma.job.count({ where: { organizationId: orgAId } });
    const taskCountBefore = await prisma.jobTask.count({ where: { organizationId: orgAId } });
    const schedCountBefore = await prisma.scheduledWork.count({ where: { organizationId: orgAId } });

    const r1 = await createPortalSubmissionFromToken({
      rawToken,
      input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, subject: "Hi", message: "Need info on timeline." },
    });
    expect(r1.ok).toBe(true);

    const r2 = await createPortalSubmissionFromToken({
      rawToken,
      input: {
        type: CustomerPortalSubmissionType.AVAILABILITY_NOTE,
        message: "Available weekday mornings.",
      },
    });
    expect(r2.ok).toBe(true);

    const rows = await prisma.customerPortalSubmission.findMany({ where: { quoteId } });
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.organizationId).toBe(orgAId);
      expect(row.customerId).toBe(customerAId);
      expect(row.quoteId).toBe(quoteId);
      expect(row.status).toBe(CustomerPortalSubmissionStatus.NEW);
      expect(row.portalAccessTokenId).toBeTruthy();
    }

    expect(await prisma.job.count({ where: { organizationId: orgAId } })).toBe(jobCountBefore);
    expect(await prisma.jobTask.count({ where: { organizationId: orgAId } })).toBe(taskCountBefore);
    expect(await prisma.scheduledWork.count({ where: { organizationId: orgAId } })).toBe(schedCountBefore);

    const view = await getPortalViewByRawToken(rawToken);
    expect(view).not.toBeNull();
    expect(JSON.stringify(view).toLowerCase()).not.toContain("customersportalsubmission");

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("invalid and revoked tokens cannot create submission", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    expect(
      await createPortalSubmissionFromToken({
        rawToken: "not-a-real-token",
        input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: "x" },
      }),
    ).toEqual(expect.objectContaining({ ok: false }));

    await revokeActivePortalTokenForQuote(officeCtxA, quoteId);
    expect(
      await createPortalSubmissionFromToken({
        rawToken,
        input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: "x" },
      }),
    ).toEqual(expect.objectContaining({ ok: false }));

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("expired token cannot create submission", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    const row = await prisma.portalAccessToken.findFirstOrThrow({ where: { quoteId, revokedAt: null } });
    await prisma.portalAccessToken.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(
      await createPortalSubmissionFromToken({
        rawToken,
        input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: "late" },
      }),
    ).toEqual(expect.objectContaining({ ok: false }));

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("strict input rejects unknown keys; message length enforced", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    const bad = await createPortalSubmissionFromToken({
      rawToken,
      input: {
        type: CustomerPortalSubmissionType.GENERAL_REQUEST,
        message: "ok",
        organizationId: orgBId,
      } as { type: CustomerPortalSubmissionType; message: string; organizationId: string },
    });
    expect(bad.ok).toBe(false);

    const long = "a".repeat(PORTAL_SUBMISSION_MESSAGE_MAX + 1);
    const tooLong = await createPortalSubmissionFromToken({
      rawToken,
      input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: long },
    });
    expect(tooLong.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("staff: office manages status; sales cannot; crew cannot list new for work station", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    await createPortalSubmissionFromToken({
      rawToken,
      input: { type: CustomerPortalSubmissionType.AVAILABILITY_NOTE, message: "Please call before arrival." },
    });
    const sub = await prisma.customerPortalSubmission.findFirstOrThrow({ where: { quoteId } });

    const salesList = await listCustomerPortalSubmissionsForQuote(salesCtxA, quoteId);
    expect(salesList.some((r) => r.id === sub.id)).toBe(true);

    const salesMark = await markCustomerPortalSubmissionReviewed(salesCtxA, sub.id);
    expect(salesMark.ok).toBe(false);

    const officeMark = await markCustomerPortalSubmissionReviewed(officeCtxA, sub.id);
    expect(officeMark.ok).toBe(true);

    const acted = await markCustomerPortalSubmissionActioned(officeCtxA, sub.id);
    expect(acted.ok).toBe(true);

    const sub2 = await prisma.customerPortalSubmission.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        quoteId,
        portalAccessTokenId: (await prisma.portalAccessToken.findFirstOrThrow({ where: { quoteId } })).id,
        type: CustomerPortalSubmissionType.GENERAL_REQUEST,
        status: CustomerPortalSubmissionStatus.NEW,
        message: "Another",
      },
    });

    await expect(listNewCustomerPortalSubmissionsForWorkStation(crewCtxA)).rejects.toThrow();

    const officeWs = await getWorkStationFeed(officeCtxA, parseWorkStationFeedFilters({}));
    const portalCards = officeWs.cards.filter((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION");
    expect(portalCards.length).toBeGreaterThanOrEqual(1);
    for (const c of portalCards) {
      expect(c.reason.toLowerCase()).not.toContain("please call before arrival");
      expect(c.reason.toLowerCase()).not.toContain("another");
    }

    const crewWs = await getWorkStationFeed(crewCtxA, parseWorkStationFeedFilters({}));
    expect(crewWs.cards.some((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION")).toBe(false);

    const salesWs = await getWorkStationFeed(salesCtxA, parseWorkStationFeedFilters({}));
    const salesPortal = salesWs.cards.filter((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION");
    expect(salesPortal.length).toBeGreaterThanOrEqual(1);
    for (const p of salesPortal) {
      expect(p.primaryHref.startsWith("/app/sales/quotes/") || p.primaryHref.startsWith("/app/jobs/")).toBe(true);
      expect(p.category).toBe("NEEDS_REVIEW");
    }

    const dismissed = await dismissCustomerPortalSubmission(officeCtxA, sub2.id);
    expect(dismissed.ok).toBe(true);

    const otherOrgList = await listCustomerPortalSubmissionsForQuote(salesCtxB, quoteId);
    expect(otherOrgList.length).toBe(0);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("submission with job links jobId from quote; work station href prefers job", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const initRes = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(initRes.ok).toBe(true);
    if (!initRes.ok || !initRes.jobId) throw new Error("initialize");

    // Activate for execution
    const activateRes = await jobMutationActivateExecution(officeCtxA, fd({ jobId: initRes.jobId }));
    expect(activateRes.ok).toBe(true);

    const job = await prisma.job.findFirstOrThrow({ where: { quoteId } });

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rawToken = created.portalPath!.slice("/portal/".length);

    await createPortalSubmissionFromToken({
      rawToken,
      input: { type: CustomerPortalSubmissionType.GENERAL_REQUEST, message: "On-site question." },
    });

    const row = await prisma.customerPortalSubmission.findFirstOrThrow({ where: { quoteId } });
    expect(row.jobId).toBe(job.id);

    const officeWs = await getWorkStationFeed(officeCtxA, parseWorkStationFeedFilters({}));
    const portalCard = officeWs.cards.find((c) => c.sourceType === "CUSTOMER_PORTAL_SUBMISSION" && c.sourceId === row.id);
    expect(portalCard).toBeDefined();
    expect(portalCard!.primaryHref).toBe(`/app/jobs/${job.id}`);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("resolvePortalTokenForSubmission returns null for wrong hash", async () => {
    expect(await resolvePortalTokenForSubmission("x")).toBeNull();
    expect(await resolvePortalTokenForSubmission("")).toBeNull();
  });
});
