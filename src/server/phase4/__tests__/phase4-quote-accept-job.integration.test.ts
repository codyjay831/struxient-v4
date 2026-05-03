/**
 * Phase 4: acceptance, activation, job rows, RBAC, tenant isolation.
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
  QuoteStatus,
  QuoteTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { sentQuoteSnapshotV2Schema } from "@/server/phase2/customer-preview";
import {
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
} from "@/server/phase2/quote-mutations";
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import {
  quoteMutationActivateAcceptedQuoteAsJob,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 4 quote accept + job activation (integration)", () => {
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
  const suffix = `p4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase4-job-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P4A ${suffix}`, slug: `org-p4a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P4B ${suffix}`, slug: `org-p4b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p4a-${suffix}@test.local`, passwordHash, name: "Sales P4A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p4a-${suffix}@test.local`, passwordHash, name: "Office P4A" },
    });
    const userMemberA = await prisma.user.create({
      data: { email: `member-p4a-${suffix}@test.local`, passwordHash, name: "Member P4A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p4b-${suffix}@test.local`, passwordHash, name: "Sales P4B" },
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
      data: { organizationId: orgAId, displayName: `Customer P4 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p4-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer P4B ${suffix}` },
    });
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerB.id,
        type: CustomerContactType.EMAIL,
        value: `cust-p4b-${suffix}@example.com`,
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

  async function seedSentQuoteWithExecution() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P4 ${suffix}`,
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
    const qt = await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: st.id,
        title: "Snapshot task title",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
      },
    });

    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    return { oppId: opp.id, quoteId, execTaskId: qt.id };
  }

  it("sales accepts; office activates → job from snapshot v2; duplicate/cross-org denied; task RBAC; initial NOT_STARTED", async () => {
    const { oppId, quoteId } = await seedSentQuoteWithExecution();

    const accept = await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    expect(accept.ok).toBe(true);

    const qAfterAccept = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(qAfterAccept.status).toBe(QuoteStatus.ACCEPTED);
    expect(qAfterAccept.acceptedByUserId).toBe(userSalesAId);

    const denySalesActivate = await quoteMutationActivateAcceptedQuoteAsJob(salesCtxA, fd({ quoteId }));
    expect(denySalesActivate.ok).toBe(false);
    if (!denySalesActivate.ok) expect(denySalesActivate.error).toMatch(/permission/i);

    const act = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) return;

    const qAct = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(qAct.status).toBe(QuoteStatus.ACTIVATED);
    expect(qAct.jobId).toBe(act.jobId);

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    expect(sentQuoteSnapshotV2Schema.safeParse(job.sourceSnapshotJson).success).toBe(true);

    const tasks = await prisma.jobTask.findMany({ where: { jobId: job.id } });
    expect(tasks.length).toBe(1);
    expect(tasks[0]?.status).toBe(JobTaskStatus.NOT_STARTED);
    expect(tasks[0]?.title).toBe("Snapshot task title");

    expect(await prisma.jobActivityEvent.count({ where: { jobId: job.id, eventType: "JOB_CREATED" } })).toBe(1);
    const activityBeforeTaskUpdate = await prisma.jobActivityEvent.count({ where: { jobId: job.id } });

    const dup = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(dup.ok).toBe(false);

    const cross = await quoteMutationActivateAcceptedQuoteAsJob(salesCtxB, fd({ quoteId }));
    expect(cross.ok).toBe(false);

    const taskId = tasks[0]!.id;
    const denyMember = await jobMutationUpdateTaskStatus(
      memberCtxA,
      fd({ jobId: job.id, taskId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(denyMember.ok).toBe(false);

    const upd = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId: job.id, taskId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(upd.ok).toBe(true);
    expect(await prisma.jobActivityEvent.count({ where: { jobId: job.id } })).toBe(activityBeforeTaskUpdate + 1);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("acceptance requires SENT and valid v2; cross-org and member denied", async () => {
    const { oppId, quoteId } = await seedSentQuoteWithExecution();

    const memberAccept = await quoteMutationMarkAccepted(memberCtxA, fd({ quoteId }));
    expect(memberAccept.ok).toBe(false);

    const crossAccept = await quoteMutationMarkAccepted(salesCtxB, fd({ quoteId }));
    expect(crossAccept.ok).toBe(false);

    await prisma.quote.update({
      where: { id: quoteId },
      data: { sentSnapshotJson: { version: 1, preview: {}, sentAt: "", quoteId, displayNumber: 1 } as object },
    });
    const badSnap = await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    expect(badSnap.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("activation denied from SENT without acceptance", async () => {
    const { oppId, quoteId } = await seedSentQuoteWithExecution();

    const r = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/accepted/i);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("live quote execution edits after SENT do not change materialized job task titles", async () => {
    const { oppId, quoteId, execTaskId } = await seedSentQuoteWithExecution();

    await prisma.quoteLineExecutionTask.update({
      where: { id: execTaskId },
      data: { title: "Live DB mutated title" },
    });

    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id } });
    expect(jt.title).toBe("Snapshot task title");

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("job task status update does not mutate quote execution rows", async () => {
    const { oppId, quoteId, execTaskId } = await seedSentQuoteWithExecution();
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id } });

    const beforeExec = await prisma.quoteLineExecutionTask.findUniqueOrThrow({ where: { id: execTaskId } });

    const step1 = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId: job.id, taskId: jt.id, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(step1.ok).toBe(true);
    const upd = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId: job.id, taskId: jt.id, status: JobTaskStatus.COMPLETE }),
    );
    expect(upd.ok).toBe(true);

    const afterExec = await prisma.quoteLineExecutionTask.findUniqueOrThrow({ where: { id: execTaskId } });
    expect(afterExec.title).toBe(beforeExec.title);
    expect(afterExec.status).toBe(beforeExec.status);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });
});
