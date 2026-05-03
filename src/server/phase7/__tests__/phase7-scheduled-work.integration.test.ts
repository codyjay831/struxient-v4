/**
 * Phase 7: ScheduledWork, scheduling mutations, RBAC, tenant isolation, readiness, queries, quote non-mutation.
 * Requires DATABASE_URL and PostgreSQL (migrations applied, including partial unique index on active schedule per task).
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  JobStatus,
  JobTaskStatus,
  MembershipRole,
  ScheduledWorkStatus,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
  PricingMode,
  QuoteLineMode,
  QuoteTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canMutateSchedule, canViewSchedule } from "@/lib/phase7-permissions";
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
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { jobMutationComplete, jobMutationPause } from "@/server/phase5/job-status-mutations";
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import {
  getReadinessForScheduledListRow,
  listScheduledWorkForJob,
  listScheduledWorkForOrganization,
} from "@/server/phase7/scheduled-work-queries";
import {
  jobMutationCancelScheduledWork,
  jobMutationRescheduleScheduledWork,
  jobMutationScheduleJobTask,
} from "@/server/phase7/scheduled-work-mutations";
import { deriveReadinessForScheduledWork } from "@/server/phase7/schedule-readiness";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) {
    f.set(k, v);
  }
  return f;
}

function nextDayWindow(hourUtc: number) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(hourUtc, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start, end };
}

describe("Phase 7 scheduled work (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userCrewAId: string;
  let userOfficeBId: string;
  let userMemberAId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let crewCtxA: OrgSessionContext;
  let officeCtxB: OrgSessionContext;
  let memberCtxA: OrgSessionContext;
  const suffix = `p7-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase7-sched-pass-12", 8);
    const orgA = await prisma.organization.create({
      data: { name: `Org P7A ${suffix}`, slug: `org-p7a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P7B ${suffix}`, slug: `org-p7b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p7a-${suffix}@test.local`, passwordHash, name: "Sales P7A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p7a-${suffix}@test.local`, passwordHash, name: "Office P7A" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-p7a-${suffix}@test.local`, passwordHash, name: "Crew P7A" },
    });
    const userOfficeB = await prisma.user.create({
      data: { email: `office-p7b-${suffix}@test.local`, passwordHash, name: "Office P7B" },
    });
    const userMemberA = await prisma.user.create({
      data: { email: `member-p7a-${suffix}@test.local`, passwordHash, name: "Member P7A" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userCrewAId = userCrewA.id;
    userOfficeBId = userOfficeB.id;
    userMemberAId = userMemberA.id;

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
    await prisma.membership.create({
      data: { userId: userMemberAId, organizationId: orgAId, role: MembershipRole.MEMBER },
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
    memberCtxA = {
      userId: userMemberAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.MEMBER,
      email: userMemberA.email!,
      name: userMemberA.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer P7 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p7-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: { id: { in: [userSalesAId, userOfficeAId, userCrewAId, userOfficeBId, userMemberAId] } },
      })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedActivatedJob() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P7 ${suffix}`,
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
        estimatedDurationMinutes: 120,
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
    const act = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) throw new Error("activate");

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const tasks = await prisma.jobTask.findMany({ where: { jobId: job.id }, orderBy: { sortOrder: "asc" } });
    expect(tasks.length).toBe(2);

    return { oppId: opp.id, quoteId, jobId: job.id, taskAId: tasks[0]!.id, taskBId: tasks[1]!.id };
  }

  it("permissions: view vs mutate; MEMBER denied view helper", () => {
    expect(canViewSchedule(MembershipRole.MEMBER)).toBe(false);
    expect(canMutateSchedule(MembershipRole.MEMBER)).toBe(false);
    expect(canMutateSchedule(MembershipRole.SALES)).toBe(false);
    expect(canMutateSchedule(MembershipRole.CREW_LEAD)).toBe(false);
    expect(canMutateSchedule(MembershipRole.OFFICE)).toBe(true);
    expect(canViewSchedule(MembershipRole.SALES)).toBe(true);
  });

  it("schedule, duplicate denied, cancel, reschedule; events; quote not mutated; cross-org denied", async () => {
    const { oppId, quoteId, jobId, taskAId, taskBId } = await seedActivatedJob();
    const quoteBefore = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });

    const { start, end } = nextDayWindow(15);
    const s1 = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
        notes: "First window",
      }),
    );
    expect(s1.ok).toBe(true);

    const dup = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(dup.ok).toBe(false);
    if (!dup.ok) {
      expect(dup.error).toMatch(/active scheduled|already has/i);
    }

    expect(
      await prisma.jobActivityEvent.count({
        where: { jobId, eventType: JobActivityEventType.SCHEDULED_WORK_CREATED },
      }),
    ).toBe(1);

    const row = await prisma.scheduledWork.findFirstOrThrow({
      where: { jobTaskId: taskAId, organizationId: orgAId },
    });

    const denySales = await jobMutationScheduleJobTask(
      salesCtxA,
      fd({
        jobId,
        jobTaskId: taskBId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(denySales.ok).toBe(false);

    const denyCrew = await jobMutationScheduleJobTask(
      crewCtxA,
      fd({
        jobId,
        jobTaskId: taskBId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(denyCrew.ok).toBe(false);

    const denyMember = await jobMutationScheduleJobTask(
      memberCtxA,
      fd({
        jobId,
        jobTaskId: taskBId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(denyMember.ok).toBe(false);

    const cross = await jobMutationScheduleJobTask(
      officeCtxB,
      fd({
        jobId,
        jobTaskId: taskBId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(cross.ok).toBe(false);

    const cancel = await jobMutationCancelScheduledWork(
      officeCtxA,
      fd({ scheduledWorkId: row.id, cancelReason: "Customer requested a different week." }),
    );
    expect(cancel.ok).toBe(true);
    expect(
      await prisma.jobActivityEvent.count({
        where: { jobId, eventType: JobActivityEventType.SCHEDULED_WORK_CANCELED },
      }),
    ).toBe(1);

    const { start: start2, end: end2 } = nextDayWindow(18);
    const s2 = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        scheduledStartAt: start2.toISOString(),
        scheduledEndAt: end2.toISOString(),
      }),
    );
    expect(s2.ok).toBe(true);

    const row2 = await prisma.scheduledWork.findFirstOrThrow({
      where: { jobTaskId: taskAId, organizationId: orgAId, status: "SCHEDULED" },
    });

    const newEnd = new Date(end2.getTime() + 30 * 60 * 1000);
    const res = await jobMutationRescheduleScheduledWork(
      officeCtxA,
      fd({
        scheduledWorkId: row2.id,
        scheduledStartAt: start2.toISOString(),
        scheduledEndAt: newEnd.toISOString(),
      }),
    );
    expect(res.ok).toBe(true);
    expect(
      await prisma.jobActivityEvent.count({
        where: { jobId, eventType: JobActivityEventType.SCHEDULED_WORK_RESCHEDULED },
      }),
    ).toBe(1);

    const quoteAfter = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quoteAfter.updatedAt.getTime()).toBe(quoteBefore.updatedAt.getTime());
    expect(quoteAfter.serviceAddressTbd).toBe(quoteBefore.serviceAddressTbd);

    const jobRows = await listScheduledWorkForJob(orgAId, jobId);
    expect(jobRows.some((r) => r.id === row2.id)).toBe(true);

    const globalRows = await listScheduledWorkForOrganization(officeCtxA, { range: "all", status: "all" });
    expect(globalRows.some((r) => r.id === row2.id)).toBe(true);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("readiness: SCHEDULED_BLOCKED and SCHEDULED_AT_RISK (paused)", async () => {
    const { oppId, jobId, taskAId } = await seedActivatedJob();

    const { start, end } = nextDayWindow(10);
    await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );

    await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.BLOCKED, blockedReason: "Awaiting panel delivery." }),
    );

    const rowsBlocked = await listScheduledWorkForJob(orgAId, jobId);
    const rBlocked = getReadinessForScheduledListRow(rowsBlocked[0]!);
    expect(rBlocked.label).toBe("SCHEDULED_BLOCKED");
    expect(rBlocked.explanation).toMatch(/blocked/i);

    await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.READY, blockedReason: "" }),
    );
    await jobMutationPause(officeCtxA, fd({ jobId, statusReason: "Weather hold on site." }));

    const rowsPaused = await listScheduledWorkForJob(orgAId, jobId);
    const rPaused = getReadinessForScheduledListRow(rowsPaused[0]!);
    expect(rPaused.label).toBe("SCHEDULED_AT_RISK");
    expect(rPaused.explanation).toMatch(/paused/i);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });

  it("deriveReadiness: missing duration yields AT_RISK", () => {
    const r = deriveReadinessForScheduledWork({
      scheduledWorkStatus: ScheduledWorkStatus.SCHEDULED,
      jobStatus: JobStatus.ACTIVE,
      jobStatusReason: null,
      taskStatus: JobTaskStatus.READY,
      taskBlockedReason: null,
      estimatedDurationMinutes: null,
      addressContext: {
        quoteServiceAddressText: "123 Main St",
        quoteServiceAddressTbd: false,
        opportunityServiceAddressText: null,
        opportunityServiceAddressTbd: false,
      },
    });
    expect(r.label).toBe("SCHEDULED_AT_RISK");
    expect(r.explanation).toMatch(/duration/i);
  });

  it("cannot schedule complete task or closed job", async () => {
    const { oppId, jobId, taskAId, taskBId } = await seedActivatedJob();
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }));
    const { start, end } = nextDayWindow(12);
    const denyCompleteTask = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(denyCompleteTask.ok).toBe(false);

    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskBId, status: JobTaskStatus.IN_PROGRESS }));
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskBId, status: JobTaskStatus.COMPLETE }));
    const done = await jobMutationComplete(officeCtxA, fd({ jobId }));
    expect(done.ok).toBe(true);

    const denyClosedJob = await jobMutationScheduleJobTask(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskBId,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
      }),
    );
    expect(denyClosedJob.ok).toBe(false);

    await prisma.quote.deleteMany({ where: { opportunityId: oppId } });
    await prisma.opportunity.delete({ where: { id: oppId } });
  });
});
