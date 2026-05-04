/**
 * Phase 5: job activity, lifecycle, task transitions, RBAC, tenant isolation, quote non-mutation.
 * Requires DATABASE_URL and PostgreSQL (migration applied).
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
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import { listJobActivityForJob, listJobsForOrganization } from "@/server/phase4/job-queries";
import {
  quoteMutationInitializeJobFromAcceptedQuote,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import {
  jobMutationCancel,
  jobMutationComplete,
  jobMutationPause,
  jobMutationResume,
} from "@/server/phase5/job-status-mutations";
import { getJobProgressForJob } from "@/server/phase5/job-progress";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 5 job execution + activity (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userCrewAId: string;
  let userOfficeBId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let crewCtxA: OrgSessionContext;
  let officeCtxB: OrgSessionContext;
  const suffix = `p5-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase5-job-pass-12", 8);
    const orgA = await prisma.organization.create({
      data: { name: `Org P5A ${suffix}`, slug: `org-p5a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P5B ${suffix}`, slug: `org-p5b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p5a-${suffix}@test.local`, passwordHash, name: "Sales P5A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p5a-${suffix}@test.local`, passwordHash, name: "Office P5A" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-p5a-${suffix}@test.local`, passwordHash, name: "Crew P5A" },
    });
    const userOfficeB = await prisma.user.create({
      data: { email: `office-p5b-${suffix}@test.local`, passwordHash, name: "Office P5B" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userCrewAId = userCrewA.id;
    userOfficeBId = userOfficeB.id;

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
      data: { userId: userOfficeBId, organizationId: orgBId, role: MembershipRole.OFFICE },
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
    officeCtxB = {
      userId: userOfficeBId,
      organizationId: orgBId,
      organizationName: orgB.name,
      role: MembershipRole.OFFICE,
      email: userOfficeB.email!,
      name: userOfficeB.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer P5 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p5-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userCrewAId, userOfficeBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedActivatedJobWithTwoRequiredTasks() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P5 ${suffix}`,
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
        title: "Task A",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
        isRequired: true,
      },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: st.id,
        title: "Task B",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 1,
        isRequired: true,
      },
    });

    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const act = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) throw new Error("activate");

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });

    // Manually activate for phase 5 tests
    await prisma.job.update({ where: { id: job.id }, data: { status: JobStatus.ACTIVE, activatedAt: new Date() } });

    const tasks = await prisma.jobTask.findMany({ where: { jobId: job.id }, orderBy: { sortOrder: "asc" } });
    expect(tasks.length).toBe(2);

    return { oppId: opp.id, quoteId, jobId: job.id, taskAId: tasks[0]!.id, taskBId: tasks[1]!.id };
  }

  it("JOB_CREATED, task activity, job status activity; pause/crew/office rules; complete/cancel; SALES denied; cross-org", async () => {
    const { oppId, jobId, taskAId, taskBId } = await seedActivatedJobWithTwoRequiredTasks();

    const progress0 = await getJobProgressForJob(orgAId, jobId);
    expect(progress0.requiredTotal).toBe(2);
    expect(progress0.requiredComplete).toBe(0);
    expect(progress0.totalTasks).toBe(2);

    expect(await prisma.jobActivityEvent.count({ where: { jobId, eventType: JobActivityEventType.JOB_WORK_PLAN_CREATED } })).toBe(
      1,
    );

    const denySalesTask = await jobMutationUpdateTaskStatus(
      salesCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(denySalesTask.ok).toBe(false);

    const denySalesPause = await jobMutationPause(salesCtxA, fd({ jobId }));
    expect(denySalesPause.ok).toBe(false);

    const crewUpd = await jobMutationUpdateTaskStatus(
      crewCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(crewUpd.ok).toBe(true);

    const pause = await jobMutationPause(officeCtxA, fd({ jobId, statusReason: "Weather" }));
    expect(pause.ok).toBe(true);
    const jobPaused = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(jobPaused.status).toBe(JobStatus.PAUSED);
    expect(jobPaused.pausedAt).toBeTruthy();

    const denyCrewWhilePaused = await jobMutationUpdateTaskStatus(
      crewCtxA,
      fd({ jobId, taskId: taskBId, status: JobTaskStatus.READY }),
    );
    expect(denyCrewWhilePaused.ok).toBe(false);

    const officeWhilePaused = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskBId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(officeWhilePaused.ok).toBe(true);

    const denyCompleteEarly = await jobMutationComplete(officeCtxA, fd({ jobId }));
    expect(denyCompleteEarly.ok).toBe(false);
    if (!denyCompleteEarly.ok) {
      expect(denyCompleteEarly.error).toMatch(/required tasks/i);
    }

    const resume = await jobMutationResume(officeCtxA, fd({ jobId }));
    expect(resume.ok).toBe(true);
    const jobActive = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(jobActive.status).toBe(JobStatus.ACTIVE);
    expect(jobActive.statusReason).toBeNull();

    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }));
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskBId, status: JobTaskStatus.COMPLETE }));

    const complete = await jobMutationComplete(officeCtxA, fd({ jobId }));
    expect(complete.ok).toBe(true);
    const jobDone = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(jobDone.status).toBe(JobStatus.COMPLETED);
    expect(jobDone.completedAt).toBeTruthy();

    const denyTaskWhenClosed = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(denyTaskWhenClosed.ok).toBe(false);

    const statusEvents = await prisma.jobActivityEvent.count({
      where: { jobId, eventType: JobActivityEventType.JOB_STATUS_CHANGED },
    });
    expect(statusEvents).toBeGreaterThanOrEqual(3);

    const activities = await listJobActivityForJob(orgAId, jobId);
    // Newest first (descending createdAt)
    for (let i = 1; i < activities.length; i++) {
      expect(activities[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(activities[i]!.createdAt.getTime());
    }

    const crossOrgActs = await listJobActivityForJob(orgBId, jobId);
    expect(crossOrgActs.length).toBe(0);

    const crossTask = await jobMutationUpdateTaskStatus(
      officeCtxB,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(crossTask.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("cancel requires reason and blocks tasks; invalid task transition denied; BLOCKED requires reason", async () => {
    const { oppId, jobId, taskAId } = await seedActivatedJobWithTwoRequiredTasks();

    const denyCancelNoReason = await jobMutationCancel(officeCtxA, fd({ jobId, reason: "" }));
    expect(denyCancelNoReason.ok).toBe(false);

    const cancel = await jobMutationCancel(officeCtxA, fd({ jobId, reason: "Customer pulled funding." }));
    expect(cancel.ok).toBe(true);
    const jobCanceled = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    expect(jobCanceled.status).toBe(JobStatus.CANCELED);
    expect(jobCanceled.statusReason).toContain("Customer");

    const denyTask = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(denyTask.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("invalid transition denied; BLOCKED stores reason; leaving BLOCKED clears; COMPLETE sets timestamps", async () => {
    const { oppId, jobId, taskAId } = await seedActivatedJobWithTwoRequiredTasks();

    const badJump = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(badJump.ok).toBe(false);

    const blockNoReason = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.BLOCKED }),
    );
    expect(blockNoReason.ok).toBe(false);

    const blockOk = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.BLOCKED, blockedReason: "  Permit pending  " }),
    );
    expect(blockOk.ok).toBe(true);
    const tBlocked = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tBlocked.status).toBe(JobTaskStatus.BLOCKED);
    expect(tBlocked.blockedReason).toContain("Permit");
    expect(tBlocked.lastStatusChangedAt).toBeTruthy();
    expect(tBlocked.lastStatusChangedByUserId).toBe(userOfficeAId);

    const unblock = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.READY }),
    );
    expect(unblock.ok).toBe(true);
    const tReady = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tReady.blockedReason).toBeNull();

    const toComplete = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(toComplete.ok).toBe(true);
    const fin = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(fin.ok).toBe(true);
    const tDone = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tDone.completedAt).toBeTruthy();
    expect(tDone.completedByUserId).toBe(userOfficeAId);

    const reopen = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(reopen.ok).toBe(true);
    const tReopen = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tReopen.completedAt).toBeNull();
    expect(tReopen.completedByUserId).toBeNull();

    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }));
    const crewReopenDenied = await jobMutationUpdateTaskStatus(
      crewCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }),
    );
    expect(crewReopenDenied.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("job status and task updates do not mutate quote execution rows", async () => {
    const { oppId, quoteId, jobId, taskAId } = await seedActivatedJobWithTwoRequiredTasks();
    const execTasks = await prisma.quoteLineExecutionTask.findMany({
      where: { stage: { quoteLineItem: { quoteId } } },
    });
    expect(execTasks.length).toBe(2);
    const exec = execTasks[0]!;

    await jobMutationPause(officeCtxA, fd({ jobId }));
    await jobMutationResume(officeCtxA, fd({ jobId }));
    await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.BLOCKED, blockedReason: "Test block" }),
    );
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.READY }));

    const execAfter = await prisma.quoteLineExecutionTask.findUniqueOrThrow({ where: { id: exec.id } });
    expect(execAfter.status).toBe(exec.status);
    expect(execAfter.title).toBe(exec.title);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("listJobsForOrganization filters by status", async () => {
    const { oppId, jobId } = await seedActivatedJobWithTwoRequiredTasks();
    await jobMutationPause(officeCtxA, fd({ jobId }));

    const pausedOnly = await listJobsForOrganization(orgAId, { status: JobStatus.PAUSED });
    expect(pausedOnly.some((j) => j.id === jobId)).toBe(true);

    const activeOnly = await listJobsForOrganization(orgAId, { status: JobStatus.ACTIVE });
    expect(activeOnly.some((j) => j.id === jobId)).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });
});
