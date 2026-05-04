/**
 * Phase 4: acceptance, activation, job rows, RBAC, tenant isolation.
 * Requires DATABASE_URL and PostgreSQL.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  JobStatus,
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
import { getPortalViewByRawToken } from "@/server/phase8/portal-projection";
import { createPortalAccessTokenForQuote } from "@/server/phase8/portal-token-mutations";
import { sentQuoteSnapshotV2Schema } from "@/server/phase2/customer-preview";
import {
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
} from "@/server/phase2/quote-mutations";
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import {
  quoteMutationInitializeJobFromAcceptedQuote,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { jobMutationActivateExecution } from "@/server/phase4/job-activation";
import { activationBaselineV1Schema } from "@/server/phase4/job-activation-baseline";
import { getJobWorkspace } from "@/server/phase4/job-queries";
import {
  jobMutationAddWorkPlanTask,
  jobMutationArchiveWorkPlanTask,
  jobMutationReorderWorkPlanTasks,
  jobMutationUpdateWorkPlanStage,
  jobMutationUpdateWorkPlanTask,
} from "@/server/phase4/job-work-plan-mutations";
import { getWorkStationFeed } from "@/server/phase6/work-station-feed";
import { jobMutationUpdateJobTaskCompletionRequirements } from "@/server/phase13/completion-requirement-mutations";

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
  let userOfficeBId: string;
  let userFieldWorkerAId: string;
  let userCrewLeadAId: string;
  let userOwnerAId: string;
  let customerAId: string;
  let customerBId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let memberCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  let officeCtxOrgB: OrgSessionContext;
  let fieldWorkerCtxA: OrgSessionContext;
  let crewLeadCtxA: OrgSessionContext;
  let ownerCtxA: OrgSessionContext;
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
    const userOfficeB = await prisma.user.create({
      data: { email: `office-p4b-${suffix}@test.local`, passwordHash, name: "Office P4B" },
    });
    const userFieldA = await prisma.user.create({
      data: { email: `field-p4a-${suffix}@test.local`, passwordHash, name: "Field P4A" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-p4a-${suffix}@test.local`, passwordHash, name: "Crew P4A" },
    });
    const userOwnerA = await prisma.user.create({
      data: { email: `owner-p4a-${suffix}@test.local`, passwordHash, name: "Owner P4A" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userMemberAId = userMemberA.id;
    userSalesBId = userSalesB.id;
    userOfficeBId = userOfficeB.id;
    userFieldWorkerAId = userFieldA.id;
    userCrewLeadAId = userCrewA.id;
    userOwnerAId = userOwnerA.id;

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
    await prisma.membership.create({
      data: { userId: userOfficeBId, organizationId: orgBId, role: MembershipRole.OFFICE },
    });
    await prisma.membership.create({
      data: { userId: userFieldWorkerAId, organizationId: orgAId, role: MembershipRole.FIELD_WORKER },
    });
    await prisma.membership.create({
      data: { userId: userCrewLeadAId, organizationId: orgAId, role: MembershipRole.CREW_LEAD },
    });
    await prisma.membership.create({
      data: { userId: userOwnerAId, organizationId: orgAId, role: MembershipRole.OWNER },
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
    officeCtxOrgB = {
      userId: userOfficeBId,
      organizationId: orgBId,
      organizationName: orgB.name,
      role: MembershipRole.OFFICE,
      email: userOfficeB.email!,
      name: userOfficeB.name,
    };
    fieldWorkerCtxA = {
      userId: userFieldWorkerAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.FIELD_WORKER,
      email: userFieldA.email!,
      name: userFieldA.name,
    };
    crewLeadCtxA = {
      userId: userCrewLeadAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.CREW_LEAD,
      email: userCrewA.email!,
      name: userCrewA.name,
    };
    ownerCtxA = {
      userId: userOwnerAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.OWNER,
      email: userOwnerA.email!,
      name: userOwnerA.name,
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
    customerBId = customerB.id;
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
      .deleteMany({
        where: {
          id: {
            in: [
              userSalesAId,
              userOfficeAId,
              userMemberAId,
              userSalesBId,
              userOfficeBId,
              userFieldWorkerAId,
              userCrewLeadAId,
              userOwnerAId,
            ],
          },
        },
      })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedSentQuoteWithExecutionForOrg(params: {
    organizationId: string;
    salesCtx: OrgSessionContext;
    customerId: string;
  }) {
    const { organizationId, salesCtx, customerId } = params;
    const opp = await prisma.opportunity.create({
      data: {
        organizationId,
        customerId,
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

    const c = await quoteMutationCreateDraftFromOpportunity(salesCtx, opp.id);
    expect(c.ok && c.outcome === "created").toBe(true);
    if (!c.ok || c.outcome !== "created") throw new Error("draft");
    const quoteId = c.quoteId;

    await prisma.quote.update({
      where: { id: quoteId },
      data: { customerFacingIntro: "Intro" },
    });

    await quoteMutationAddLineItem(
      salesCtx,
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
      data: { organizationId, quoteLineItemId: li.id, title: "Stage 1", sortOrder: 0 },
    });
    const qt = await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId,
        stageId: st.id,
        title: "Snapshot task title",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
      },
    });

    await quoteMutationMarkReadyToSend(salesCtx, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtx, fd({ quoteId }));

    return { oppId: opp.id, quoteId, execTaskId: qt.id };
  }

  async function seedSentQuoteWithExecution() {
    return seedSentQuoteWithExecutionForOrg({
      organizationId: orgAId,
      salesCtx: salesCtxA,
      customerId: customerAId,
    });
  }

  it("sales accepts; office activates → job from snapshot v2; duplicate/cross-org denied; task RBAC; initial NOT_STARTED", async () => {
    const { oppId, quoteId } = await seedSentQuoteWithExecution();

    const accept = await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    expect(accept.ok).toBe(true);

    const qAfterAccept = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(qAfterAccept.status).toBe(QuoteStatus.ACCEPTED);
    expect(qAfterAccept.acceptedByUserId).toBe(userSalesAId);

    const denySalesActivate = await quoteMutationInitializeJobFromAcceptedQuote(salesCtxA, fd({ quoteId }));
    expect(denySalesActivate.ok).toBe(false);
    if (!denySalesActivate.ok) expect(denySalesActivate.error).toMatch(/permission/i);

    const act = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) return;

    const qAct = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(qAct.status).toBe(QuoteStatus.ACCEPTED);
    expect(qAct.jobId).toBe(act.jobId);

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    expect(job.status).toBe(JobStatus.WORK_PLAN_REVIEW);
    expect(job.activatedAt).toBeNull();
    expect(sentQuoteSnapshotV2Schema.safeParse(job.sourceSnapshotJson).success).toBe(true);

    const tasks = await prisma.jobTask.findMany({ where: { jobId: job.id } });
    expect(tasks.length).toBe(1);
    expect(tasks[0]?.status).toBe(JobTaskStatus.NOT_STARTED);
    expect(tasks[0]?.title).toBe("Snapshot task title");

    expect(await prisma.jobActivityEvent.count({ where: { jobId: job.id, eventType: "JOB_WORK_PLAN_CREATED" } })).toBe(1);

    const dup = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(dup.ok).toBe(false);

    const cross = await quoteMutationInitializeJobFromAcceptedQuote(salesCtxB, fd({ quoteId }));
    expect(cross.ok).toBe(false);

    const taskId = tasks[0]!.id;
    const denyInReview = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId: job.id, taskId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(denyInReview.ok).toBe(false);
    if (!denyInReview.ok) expect(denyInReview.error).toMatch(/work plan review/i);

    const denyMember = await jobMutationUpdateTaskStatus(
      memberCtxA,
      fd({ jobId: job.id, taskId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(denyMember.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("office activates execution → job ACTIVE, quote ACTIVATED, baseline captured, activity recorded", async () => {
    const { oppId, quoteId } = await seedSentQuoteWithExecution();
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));

    const jobBefore = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    expect(jobBefore.status).toBe(JobStatus.WORK_PLAN_REVIEW);
    expect(jobBefore.activatedAt).toBeNull();

    // 1. Deny sales activation
    const denySales = await jobMutationActivateExecution(salesCtxA, fd({ jobId: jobBefore.id }));
    expect(denySales.ok).toBe(false);

    // 2. Office activation
    const act = await jobMutationActivateExecution(officeCtxA, fd({ jobId: jobBefore.id }));
    expect(act.ok).toBe(true);

    // 3. Verify Job
    const jobAfter = await prisma.job.findUniqueOrThrow({
      where: { id: jobBefore.id },
      include: { activityEvents: true },
    });
    expect(jobAfter.status).toBe(JobStatus.ACTIVE);
    expect(jobAfter.activatedAt).toBeDefined();
    expect(jobAfter.activatedByUserId).toBe(userOfficeAId);

    // 4. Verify Baseline
    expect(jobAfter.activationBaselineJson).toBeDefined();
    const baseline = activationBaselineV1Schema.parse(jobAfter.activationBaselineJson);
    expect(baseline.version).toBe(1);
    expect(baseline.activatedByUserId).toBe(userOfficeAId);
    expect(baseline.lines.length).toBe(1);
    expect(baseline.lines[0]?.stages.length).toBe(1);
    expect(baseline.lines[0]?.stages[0]?.tasks.length).toBe(1);
    expect(baseline.lines[0]?.stages[0]?.tasks[0]?.title).toBe("Snapshot task title");

    // 5. Verify Quote
    const quoteAfter = await prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { activityEvents: true },
    });
    expect(quoteAfter.status).toBe(QuoteStatus.ACTIVATED);
    expect(quoteAfter.activatedAt).toBeDefined();
    expect(quoteAfter.activatedByUserId).toBe(userOfficeAId);

    // 6. Verify Activity
    expect(jobAfter.activityEvents.some((e) => e.eventType === "JOB_EXECUTION_ACTIVATED")).toBe(true);
    expect(quoteAfter.activityEvents.some((e) => e.eventType === "QUOTE_ACTIVATED")).toBe(true);
    expect(quoteAfter.activityEvents.some((e) => e.eventType === "QUOTE_STATUS_CHANGED")).toBe(true);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("activation preconditions: cannot activate if already active, no tasks, or wrong status", async () => {
    const { oppId, quoteId } = await seedSentQuoteWithExecution();
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });

    // 1. Success first
    const act1 = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
    expect(act1.ok).toBe(true);

    // 2. Deny second activation
    const act2 = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
    expect(act2.ok).toBe(false);
    if (!act2.ok) expect(act2.error).toMatch(/work plan review/i);

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

    const r = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
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
    await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id } });
    expect(jt.title).toBe("Snapshot task title");

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("job task status update does not mutate quote execution rows", async () => {
    const { oppId, quoteId, execTaskId } = await seedSentQuoteWithExecution();
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id } });

    const beforeExec = await prisma.quoteLineExecutionTask.findUniqueOrThrow({ where: { id: execTaskId } });

    // Activate job for status update test
    await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.ACTIVE, activatedAt: new Date() } });

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

  describe("Phase 3 work plan review edits", () => {
    function workPlanTaskFd(
      jobId: string,
      taskId: string,
      overrides: Partial<Record<string, string>> = {},
    ): FormData {
      return fd({
        jobId,
        taskId,
        title: overrides.title ?? "Updated title",
        description: overrides.description ?? "",
        internalNotes: overrides.internalNotes ?? "",
        isRequired: overrides.isRequired ?? "false",
        assignedRole: overrides.assignedRole ?? "",
        customerVisible: overrides.customerVisible ?? "false",
        customerLabel: overrides.customerLabel ?? "",
      });
    }

    it("office updates work plan task during review; sales denied; status unchanged", async () => {
      const { oppId, quoteId } = await seedSentQuoteWithExecution();
      await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
      await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
      const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
      const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id, archivedAt: null } });

      const upd = await jobMutationUpdateWorkPlanTask(
        officeCtxA,
        workPlanTaskFd(job.id, jt.id, {
          title: "Renamed in review",
          description: "Instructions here",
          internalNotes: "Internal",
          isRequired: "true",
          assignedRole: "CREW_LEAD",
        }),
      );
      expect(upd.ok).toBe(true);

      const jt2 = await prisma.jobTask.findUniqueOrThrow({ where: { id: jt.id } });
      expect(jt2.title).toBe("Renamed in review");
      expect(jt2.description).toBe("Instructions here");
      expect(jt2.isRequired).toBe(true);
      expect(jt2.assignedRole).toBe("CREW_LEAD");
      expect(jt2.status).toBe(JobTaskStatus.NOT_STARTED);

      expect(
        await prisma.jobActivityEvent.count({ where: { jobId: job.id, eventType: "WORK_PLAN_TASK_UPDATED" } }),
      ).toBeGreaterThanOrEqual(1);

      const denySales = await jobMutationUpdateWorkPlanTask(
        salesCtxA,
        workPlanTaskFd(job.id, jt.id, { title: "Sales try" }),
      );
      expect(denySales.ok).toBe(false);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("work plan mutations denied when job is ACTIVE", async () => {
      const { oppId, quoteId } = await seedSentQuoteWithExecution();
      await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
      await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
      const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
      const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id } });
      const act = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
      expect(act.ok).toBe(true);

      const deny = await jobMutationUpdateWorkPlanTask(
        officeCtxA,
        workPlanTaskFd(job.id, jt.id, { title: "Too late" }),
      );
      expect(deny.ok).toBe(false);
      if (!deny.ok) expect(deny.error).toMatch(/work plan review/i);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("add task appends sortOrder; archive respects last-task rule; reorder updates order", async () => {
      const { oppId, quoteId } = await seedSentQuoteWithExecution();
      await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
      await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
      const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
      const stage = await prisma.jobStage.findFirstOrThrow({ where: { jobId: job.id } });
      const t0 = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id, archivedAt: null } });

      const denyArchiveOnly = await jobMutationArchiveWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, taskId: t0.id }),
      );
      expect(denyArchiveOnly.ok).toBe(false);

      const add = await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Added task", description: "", isRequired: "false" }),
      );
      expect(add.ok).toBe(true);

      const tasksAfterAdd = await prisma.jobTask.findMany({
        where: { jobId: job.id, archivedAt: null },
        orderBy: { sortOrder: "asc" },
      });
      expect(tasksAfterAdd.length).toBe(2);
      expect(tasksAfterAdd[1]?.title).toBe("Added task");
      expect(tasksAfterAdd[1]?.sortOrder).toBeGreaterThan(tasksAfterAdd[0]?.sortOrder ?? -1);
      expect(tasksAfterAdd[1]?.sourceQuoteTaskId).toBeNull();

      const t1 = tasksAfterAdd.find((t) => t.id !== t0.id)!;
      const arch = await jobMutationArchiveWorkPlanTask(officeCtxA, fd({ jobId: job.id, taskId: t1.id }));
      expect(arch.ok).toBe(true);
      const archived = await prisma.jobTask.findUniqueOrThrow({ where: { id: t1.id } });
      expect(archived.archivedAt).not.toBeNull();

      const remaining = await prisma.jobTask.findMany({ where: { jobId: job.id, archivedAt: null } });
      expect(remaining.length).toBe(1);

      const add2 = await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Third", description: "" }),
      );
      expect(add2.ok).toBe(true);
      const ids = (
        await prisma.jobTask.findMany({
          where: { jobId: job.id, jobStageId: stage.id, archivedAt: null },
          orderBy: { sortOrder: "asc" },
        })
      ).map((t) => t.id);

      const rev = [...ids].reverse();
      const reo = await jobMutationReorderWorkPlanTasks(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, orderedTaskIds: JSON.stringify(rev) }),
      );
      expect(reo.ok).toBe(true);
      const after = await prisma.jobTask.findMany({
        where: { jobId: job.id, jobStageId: stage.id, archivedAt: null },
        orderBy: { sortOrder: "asc" },
      });
      expect(after.map((t) => t.id)).toEqual(rev);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("activation baseline reflects work plan edits; sentSnapshotJson unchanged", async () => {
      const { oppId, quoteId } = await seedSentQuoteWithExecution();
      await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
      await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
      const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
      const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id, archivedAt: null } });

      const snapBefore = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { sentSnapshotJson: true } });
      const snapJson = JSON.stringify(snapBefore.sentSnapshotJson);

      await jobMutationUpdateWorkPlanTask(
        officeCtxA,
        workPlanTaskFd(job.id, jt.id, { title: "Baseline title" }),
      );

      const act = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
      expect(act.ok).toBe(true);

      const jobAfter = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
      const baseline = activationBaselineV1Schema.parse(jobAfter.activationBaselineJson);
      expect(baseline.lines[0]?.stages[0]?.tasks[0]?.title).toBe("Baseline title");

      const snapAfter = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { sentSnapshotJson: true } });
      expect(JSON.stringify(snapAfter.sentSnapshotJson)).toBe(snapJson);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });
  });

  describe("Phase 3.5 work plan hardening (isolation + leakage)", () => {
    const WORK_PLAN_ACTIVITY_TYPES = [
      "WORK_PLAN_TASK_UPDATED",
      "WORK_PLAN_TASK_ADDED",
      "WORK_PLAN_TASK_ARCHIVED",
      "WORK_PLAN_TASKS_REORDERED",
      "WORK_PLAN_STAGE_UPDATED",
    ] as const;

    function wpTaskFd(
      jobId: string,
      taskId: string,
      overrides: Partial<Record<string, string>> = {},
    ): FormData {
      return fd({
        jobId,
        taskId,
        title: overrides.title ?? "Updated title",
        description: overrides.description ?? "",
        internalNotes: overrides.internalNotes ?? "",
        isRequired: overrides.isRequired ?? "false",
        assignedRole: overrides.assignedRole ?? "",
        customerVisible: overrides.customerVisible ?? "false",
        customerLabel: overrides.customerLabel ?? "",
      });
    }

    function completionReqFd(jobId: string, jobTaskId: string): FormData {
      const f = new FormData();
      f.set("jobId", jobId);
      f.set("jobTaskId", jobTaskId);
      f.set("required", "true");
      f.set("minAcceptedCount", "3");
      f.set("allowJobLevelEvidence", "false");
      return f;
    }

    async function seedReviewJobOrgA() {
      const { oppId, quoteId } = await seedSentQuoteWithExecution();
      await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
      await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
      const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
      const stage = await prisma.jobStage.findFirstOrThrow({ where: { jobId: job.id } });
      const task = await prisma.jobTask.findFirstOrThrow({ where: { jobId: job.id, archivedAt: null } });
      return { oppId, quoteId, job, stage, task };
    }

    it("org B office cannot mutate org A work plan; org A data and work-plan activity unchanged", async () => {
      const { oppId, job, stage, task } = await seedReviewJobOrgA();
      await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Second task", description: "" }),
      );
      const titleBefore = (await prisma.jobTask.findUniqueOrThrow({ where: { id: task.id } })).title;
      const stageTitleBefore = (await prisma.jobStage.findUniqueOrThrow({ where: { id: stage.id } })).title;
      const actBefore = await prisma.jobActivityEvent.count({
        where: { jobId: job.id, eventType: { in: [...WORK_PLAN_ACTIVITY_TYPES] } },
      });

      const denyUpdate = await jobMutationUpdateWorkPlanTask(
        officeCtxOrgB,
        wpTaskFd(job.id, task.id, { title: "Malicious" }),
      );
      expect(denyUpdate.ok).toBe(false);
      if (!denyUpdate.ok) expect(denyUpdate.error).toMatch(/not found/i);

      const denyAdd = await jobMutationAddWorkPlanTask(
        officeCtxOrgB,
        fd({ jobId: job.id, stageId: stage.id, title: "Injected", description: "" }),
      );
      expect(denyAdd.ok).toBe(false);
      if (!denyAdd.ok) expect(denyAdd.error).toMatch(/not found/i);

      const denyArchive = await jobMutationArchiveWorkPlanTask(
        officeCtxOrgB,
        fd({ jobId: job.id, taskId: task.id }),
      );
      expect(denyArchive.ok).toBe(false);
      if (!denyArchive.ok) expect(denyArchive.error).toMatch(/not found/i);

      const activeTasks = await prisma.jobTask.findMany({
        where: { jobId: job.id, jobStageId: stage.id, archivedAt: null },
        orderBy: { sortOrder: "asc" },
      });
      const ord = activeTasks.map((x) => x.id);
      const denyReorder = await jobMutationReorderWorkPlanTasks(
        officeCtxOrgB,
        fd({ jobId: job.id, stageId: stage.id, orderedTaskIds: JSON.stringify(ord) }),
      );
      expect(denyReorder.ok).toBe(false);
      if (!denyReorder.ok) expect(denyReorder.error).toMatch(/not found/i);

      const denyStage = await jobMutationUpdateWorkPlanStage(
        officeCtxOrgB,
        fd({ jobId: job.id, stageId: stage.id, title: "Malicious stage", internalNotes: "" }),
      );
      expect(denyStage.ok).toBe(false);
      if (!denyStage.ok) expect(denyStage.error).toMatch(/not found/i);

      const tAfter = await prisma.jobTask.findUniqueOrThrow({ where: { id: task.id } });
      expect(tAfter.title).toBe(titleBefore);
      const sAfter = await prisma.jobStage.findUniqueOrThrow({ where: { id: stage.id } });
      expect(sAfter.title).toBe(stageTitleBefore);
      const actAfter = await prisma.jobActivityEvent.count({
        where: { jobId: job.id, eventType: { in: [...WORK_PLAN_ACTIVITY_TYPES] } },
      });
      expect(actAfter).toBe(actBefore);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("org A office cannot mutate org B work plan; org B job unchanged", async () => {
      const { oppId, quoteId } = await seedSentQuoteWithExecutionForOrg({
        organizationId: orgBId,
        salesCtx: salesCtxB,
        customerId: customerBId,
      });
      await quoteMutationMarkAccepted(salesCtxB, fd({ quoteId }));
      await quoteMutationInitializeJobFromAcceptedQuote(officeCtxOrgB, fd({ quoteId }));
      const jobB = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
      const taskB = await prisma.jobTask.findFirstOrThrow({ where: { jobId: jobB.id, archivedAt: null } });
      const titleBefore = taskB.title;

      const deny = await jobMutationUpdateWorkPlanTask(
        officeCtxA,
        wpTaskFd(jobB.id, taskB.id, { title: "Cross-org A→B" }),
      );
      expect(deny.ok).toBe(false);
      if (!deny.ok) expect(deny.error).toMatch(/not found/i);

      const t2 = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskB.id } });
      expect(t2.title).toBe(titleBefore);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("FIELD_WORKER, CREW_LEAD, and SALES cannot edit work plan; OWNER can update task", async () => {
      const { oppId, job, stage, task } = await seedReviewJobOrgA();

      for (const ctx of [fieldWorkerCtxA, crewLeadCtxA, salesCtxA]) {
        const d = await jobMutationUpdateWorkPlanTask(ctx, wpTaskFd(job.id, task.id, { title: "Nope" }));
        expect(d.ok).toBe(false);
        if (!d.ok) expect(d.error).toMatch(/permission/i);
      }

      await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Archive buddy", description: "" }),
      );
      const buddy = await prisma.jobTask.findFirstOrThrow({
        where: { jobId: job.id, title: "Archive buddy", archivedAt: null },
      });

      for (const ctx of [fieldWorkerCtxA, crewLeadCtxA, salesCtxA]) {
        const d1 = await jobMutationArchiveWorkPlanTask(ctx, fd({ jobId: job.id, taskId: buddy.id }));
        expect(d1.ok).toBe(false);
        if (!d1.ok) expect(d1.error).toMatch(/permission/i);

        const d2 = await jobMutationAddWorkPlanTask(
          ctx,
          fd({ jobId: job.id, stageId: stage.id, title: "Illegal add", description: "" }),
        );
        expect(d2.ok).toBe(false);
        if (!d2.ok) expect(d2.error).toMatch(/permission/i);

        const ids = (
          await prisma.jobTask.findMany({
            where: { jobId: job.id, jobStageId: stage.id, archivedAt: null },
            orderBy: { sortOrder: "asc" },
          })
        ).map((x) => x.id);
        const d3 = await jobMutationReorderWorkPlanTasks(
          ctx,
          fd({ jobId: job.id, stageId: stage.id, orderedTaskIds: JSON.stringify(ids) }),
        );
        expect(d3.ok).toBe(false);
        if (!d3.ok) expect(d3.error).toMatch(/permission/i);

        const d4 = await jobMutationUpdateWorkPlanStage(
          ctx,
          fd({ jobId: job.id, stageId: stage.id, title: "Illegal stage", internalNotes: "" }),
        );
        expect(d4.ok).toBe(false);
        if (!d4.ok) expect(d4.error).toMatch(/permission/i);
      }

      const okOwner = await jobMutationUpdateWorkPlanTask(
        ownerCtxA,
        wpTaskFd(job.id, task.id, { title: "Owner ok" }),
      );
      expect(okOwner.ok).toBe(true);
      const refreshed = await prisma.jobTask.findUniqueOrThrow({ where: { id: task.id } });
      expect(refreshed.title).toBe("Owner ok");

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("activation baseline excludes archived tasks; all-archived blocks activation", async () => {
      const { oppId, job, stage, task } = await seedReviewJobOrgA();
      await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Keep me", description: "" }),
      );
      const keep = await prisma.jobTask.findFirstOrThrow({
        where: { jobId: job.id, title: "Keep me", archivedAt: null },
      });

      const arch = await jobMutationArchiveWorkPlanTask(officeCtxA, fd({ jobId: job.id, taskId: task.id }));
      expect(arch.ok).toBe(true);

      const ws = await getJobWorkspace(orgAId, job.id);
      expect(ws?.lines[0]?.stages[0]?.tasks.map((t) => t.id)).toEqual([keep.id]);

      const act = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
      expect(act.ok).toBe(true);
      const jobAfter = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
      const baseline = activationBaselineV1Schema.parse(jobAfter.activationBaselineJson);
      expect(baseline.lines[0]?.stages[0]?.tasks.map((t) => t.id)).toEqual([keep.id]);

      const { oppId: opp2, job: job2 } = await seedReviewJobOrgA();
      await prisma.jobTask.updateMany({
        where: { jobId: job2.id, organizationId: orgAId },
        data: { archivedAt: new Date() },
      });
      const denyAllArchived = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job2.id }));
      expect(denyAllArchived.ok).toBe(false);
      if (!denyAllArchived.ok) expect(denyAllArchived.error).toMatch(/no tasks/i);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
      await prisma.quote.deleteMany({ where: { opportunityId: opp2 } });
      await prisma.opportunity.delete({ where: { id: opp2 } });
    });

    it("Work Station planning card counts active tasks only; field feed empty in review", async () => {
      const { oppId, job, stage } = await seedReviewJobOrgA();
      await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Extra", description: "" }),
      );
      const tasks = await prisma.jobTask.findMany({
        where: { jobId: job.id, archivedAt: null },
        orderBy: { sortOrder: "asc" },
      });
      expect(tasks.length).toBe(2);
      const toArchive = tasks[0]!;
      await jobMutationArchiveWorkPlanTask(officeCtxA, fd({ jobId: job.id, taskId: toArchive.id }));

      const { cards } = await getWorkStationFeed(officeCtxA, { source: "jobs", category: "all" });
      const planning = cards.find((c) => c.id === `JOB:${job.id}:planning`);
      expect(planning).toBeDefined();
      expect(planning?.reason).toMatch(/1 active task/);

      const { cards: fieldCards } = await getWorkStationFeed(fieldWorkerCtxA, { source: "jobs", category: "all" });
      expect(fieldCards.some((c) => c.sourceId === job.id)).toBe(false);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("portal: archived customer-visible milestone hidden; preparing copy; no baseline in JSON", async () => {
      const { oppId, quoteId, job, stage, task } = await seedReviewJobOrgA();
      await jobMutationAddWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, stageId: stage.id, title: "Internal only", description: "" }),
      );
      await jobMutationUpdateWorkPlanTask(
        officeCtxA,
        wpTaskFd(job.id, task.id, {
          title: task.title,
          customerVisible: "true",
          customerLabel: "Milestone A",
        }),
      );

      const created = await createPortalAccessTokenForQuote(officeCtxA, quoteId);
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error("portal token");
      const raw = created.portalPath!.slice("/portal/".length);

      const view1 = await getPortalViewByRawToken(raw);
      expect(view1).not.toBeNull();
      expect(view1!.project?.statusLabel).toMatch(/preparing your project/i);
      expect(view1!.project?.milestoneItems?.some((m) => m.label === "Milestone A")).toBe(true);
      expect(JSON.stringify(view1)).not.toMatch(/activationBaseline/i);

      await jobMutationArchiveWorkPlanTask(
        officeCtxA,
        fd({ jobId: job.id, taskId: task.id }),
      );
      const view2 = await getPortalViewByRawToken(raw);
      expect(view2).not.toBeNull();
      expect(view2!.project?.milestoneItems?.some((m) => m.label === "Milestone A")).toBe(false);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("completion requirements: cross-org and field/sales denied; office edit in review flows to baseline; snapshot unchanged", async () => {
      const { oppId, quoteId, job, task } = await seedReviewJobOrgA();

      const denyCross = await jobMutationUpdateJobTaskCompletionRequirements(
        officeCtxOrgB,
        completionReqFd(job.id, task.id),
      );
      expect(denyCross.ok).toBe(false);
      if (!denyCross.ok) expect(denyCross.error).toMatch(/not found/i);

      for (const ctx of [fieldWorkerCtxA, crewLeadCtxA, salesCtxA]) {
        const d = await jobMutationUpdateJobTaskCompletionRequirements(ctx, completionReqFd(job.id, task.id));
        expect(d.ok).toBe(false);
        if (!d.ok) expect(d.error).toMatch(/permission/i);
      }

      const snapBefore = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { sentSnapshotJson: true } });
      const snapJson = JSON.stringify(snapBefore.sentSnapshotJson);

      const okCr = await jobMutationUpdateJobTaskCompletionRequirements(
        officeCtxA,
        completionReqFd(job.id, task.id),
      );
      expect(okCr.ok).toBe(true);

      const act = await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
      expect(act.ok).toBe(true);
      const jobAfter = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
      const baseline = activationBaselineV1Schema.parse(jobAfter.activationBaselineJson);
      const t0 = baseline.lines[0]?.stages[0]?.tasks[0];
      expect(t0?.completionRequirementsJson).toBeTruthy();
      const crJson = t0?.completionRequirementsJson as { evidence?: { minAcceptedCount?: number } };
      expect(crJson?.evidence?.minAcceptedCount).toBe(3);

      const snapAfter = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { sentSnapshotJson: true } });
      expect(JSON.stringify(snapAfter.sentSnapshotJson)).toBe(snapJson);

      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });

    it("completion requirements remain editable when job ACTIVE (non-closed)", async () => {
      const { oppId, job, task } = await seedReviewJobOrgA();
      await jobMutationActivateExecution(officeCtxA, fd({ jobId: job.id }));
      const activeEdit = await jobMutationUpdateJobTaskCompletionRequirements(
        officeCtxA,
        completionReqFd(job.id, task.id),
      );
      expect(activeEdit.ok).toBe(true);
      await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
      await prisma.opportunity.delete({ where: { id: oppId } });
    });
  });
});
