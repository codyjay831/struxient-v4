/**
 * Phase 8: portal tokens, public projection, RBAC, tenant isolation.
 * Requires DATABASE_URL and PostgreSQL.
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
import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { hashPortalToken } from "@/server/phase8/portal-token-crypto";
import {
  createPortalAccessTokenForQuote,
  regeneratePortalTokenForQuote,
  revokeActivePortalTokenForQuote,
} from "@/server/phase8/portal-token-mutations";
import { jobMutationScheduleJobTask } from "@/server/phase7/scheduled-work-mutations";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 8 customer portal (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userMemberAId: string;
  let userSalesBId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let memberCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  const suffix = `p8-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase8-portal-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P8A ${suffix}`, slug: `org-p8a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P8B ${suffix}`, slug: `org-p8b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p8a-${suffix}@test.local`, passwordHash, name: "Sales P8A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p8a-${suffix}@test.local`, passwordHash, name: "Office P8A" },
    });
    const userMemberA = await prisma.user.create({
      data: { email: `member-p8a-${suffix}@test.local`, passwordHash, name: "Member P8A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p8b-${suffix}@test.local`, passwordHash, name: "Sales P8B" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userMemberAId = userMemberA.id;
    userSalesBId = userSalesB.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userOfficeAId, organizationId: orgAId, role: MembershipRole.OFFICE },
    });
    await prisma.membership.create({
      data: { userId: userMemberAId, organizationId: orgAId, role: MembershipRole.MEMBER },
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
    memberCtxA = {
      userId: userMemberAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.MEMBER,
      email: userMemberA.email!,
      name: userMemberA.name,
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
      data: { organizationId: orgAId, displayName: `Customer P8 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p8-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer P8B ${suffix}` },
    });
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerB.id,
        type: CustomerContactType.EMAIL,
        value: `cust-p8b-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userMemberAId, userSalesBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedSentQuote() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P8 ${suffix}`,
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

  it("create stores hash only; portal resolves; lastViewedAt updates; serialization safe", async () => {
    const { oppId, quoteId } = await seedSentQuote();

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.portalPath).toMatch(/^\/portal\//);
    const raw = created.portalPath!.slice("/portal/".length);

    const row = await prisma.portalAccessToken.findFirstOrThrow({ where: { quoteId, revokedAt: null } });
    expect(row.tokenHash).toBe(hashPortalToken(raw));
    expect(row.tokenHash).not.toContain(raw);

    expect(row.lastViewedAt).toBeNull();
    const view = await getPortalViewByRawToken(raw);
    expect(view).not.toBeNull();
    expect(view!.quote?.displayNumber).toBeDefined();

    const row2 = await prisma.portalAccessToken.findFirstOrThrow({ where: { id: row.id } });
    expect(row2.lastViewedAt).not.toBeNull();

    const serialized = JSON.stringify(view);
    expect(serialized).not.toMatch(/internalExecutionPlan|sourceSnapshotJson|sentSnapshotJson|tokenHash/i);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("revoked and wrong token fail closed; regenerate replaces secret", async () => {
    const { oppId, quoteId } = await seedSentQuote();

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const raw1 = created.portalPath!.slice("/portal/".length);

    const revoked = await revokeActivePortalTokenForQuote(officeCtxA, quoteId);
    expect(revoked.ok).toBe(true);
    expect(await getPortalViewByRawToken(raw1)).toBeNull();

    const regen = await regeneratePortalTokenForQuote(officeCtxA, quoteId);
    expect(regen.ok).toBe(true);
    if (!regen.ok) return;
    const raw2 = regen.portalPath!.slice("/portal/".length);
    expect(raw2).not.toBe(raw1);
    expect(await getPortalViewByRawToken(raw1)).toBeNull();
    expect(await getPortalViewByRawToken(raw2)).not.toBeNull();

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("RBAC: sales creates; sales cannot revoke; office revokes; member cannot create", async () => {
    const { oppId, quoteId } = await seedSentQuote();

    const salesCreate = await createPortalAccessTokenForQuote(salesCtxA, quoteId);
    expect(salesCreate.ok).toBe(true);

    const salesRevoke = await revokeActivePortalTokenForQuote(salesCtxA, quoteId);
    expect(salesRevoke.ok).toBe(false);

    const officeRevoke = await revokeActivePortalTokenForQuote(officeCtxA, quoteId);
    expect(officeRevoke.ok).toBe(true);

    const memberCreate = await createPortalAccessTokenForQuote(memberCtxA, quoteId);
    expect(memberCreate.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("cannot create portal link for DRAFT quote", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp draft ${suffix}`,
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
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const draftId = c.quoteId;

    const denyDraft = await createPortalAccessTokenForQuote(officeCtxA, draftId);
    expect(denyDraft.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: opp.id } });
    await prisma.opportunity.delete({ where: { id: opp.id } });
  });

  it("cross-org portal token creation denied", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const cross = await createPortalAccessTokenForQuote(salesCtxB, quoteId);
    expect(cross.ok).toBe(false);
    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("expired token does not resolve", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const raw = created.portalPath!.slice("/portal/".length);

    await prisma.portalAccessToken.updateMany({
      where: { quoteId, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    expect(await getPortalViewByRawToken(raw)).toBeNull();

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("schedule projection only includes customer-visible tasks", async () => {
    const { oppId, quoteId } = await seedSentQuote();
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const initRes = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(initRes.ok).toBe(true);
    if (!initRes.ok || !initRes.jobId) return;

    // Activate for execution
    const activateRes = await jobMutationActivateExecution(officeCtxA, fd({ jobId: initRes.jobId }));
    expect(activateRes.ok).toBe(true);
    if (!activateRes.ok) return;

    const jobId = initRes.jobId;

    const tasks = await prisma.jobTask.findMany({ where: { jobId }, orderBy: { sortOrder: "asc" } });
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    const t0 = tasks[0]!;
    await prisma.jobTask.update({
      where: { id: t0.id },
      data: { customerVisible: true, customerLabel: "Customer milestone" },
    });
    const tHidden = tasks[1];
    if (tHidden) {
      await prisma.jobTask.update({
        where: { id: tHidden.id },
        data: { customerVisible: false, customerLabel: null },
      });
    }

    const start = new Date("2026-08-10T14:00:00.000Z");
    const end = new Date("2026-08-10T16:00:00.000Z");
    const sch1 = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: t0.id,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
        title: "Internal schedule title",
      }),
    );
    expect(sch1.ok).toBe(true);
    if (tHidden) {
      const sch2 = await jobMutationScheduleJobTask(
        officeCtxA,
        fd({
          jobId,
          jobTaskId: tHidden.id,
          scheduledStartAt: new Date("2026-08-11T14:00:00.000Z").toISOString(),
          scheduledEndAt: new Date("2026-08-11T16:00:00.000Z").toISOString(),
          title: "Hidden row",
        }),
      );
      expect(sch2.ok).toBe(true);
    }

    const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const raw = created.portalPath!.slice("/portal/".length);
    const view = await getPortalViewByRawToken(raw);
    expect(view).not.toBeNull();
    expect(view!.schedule.length).toBe(1);
    expect(view!.schedule[0]?.label).toBe("Customer milestone");
    expect(view!.schedule[0]?.scheduleActionRef).toBeTruthy();
    expect(view!.schedule[0]?.canAcknowledge).toBe(true);
    expect(view!.schedule[0]?.acknowledgmentStatus).toBe("not_acknowledged");

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });
});
