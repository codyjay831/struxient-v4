/**
 * Phase 13: completion requirements parser, evidence gate, requirement edits, override, Work Station hints.
 * Requires DATABASE_URL and PostgreSQL.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import {
  CustomerContactType,
  JobEvidenceStatus,
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
import {
  quoteMutationActivateAcceptedQuoteAsJob,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { acceptJobEvidence } from "@/server/phase12/job-evidence-mutations";
import { getWorkStationFeed, parseWorkStationFeedFilters } from "@/server/phase6/work-station-feed";
import {
  acceptedEvidenceCountForTaskFromMaps,
  evaluateJobTaskCompletionRequirements,
  loadAcceptedEvidenceCountMapsForJob,
} from "@/server/phase13/evidence-requirement-evaluation";
import { jobMutationUpdateJobTaskCompletionRequirements } from "@/server/phase13/completion-requirement-mutations";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 13 completion requirements + evidence gate (integration)", () => {
  let orgAId: string;
  let userSalesAId: string;
  let userOfficeAId: string;
  let userCrewAId: string;
  let userFieldAId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  let crewCtxA: OrgSessionContext;
  let fieldCtxA: OrgSessionContext;
  const suffix = `p13-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase13-pass-12", 8);
    const orgA = await prisma.organization.create({
      data: { name: `Org P13A ${suffix}`, slug: `org-p13a-${suffix}` },
    });
    orgAId = orgA.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p13a-${suffix}@test.local`, passwordHash, name: "Sales P13A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p13a-${suffix}@test.local`, passwordHash, name: "Office P13A" },
    });
    const userCrewA = await prisma.user.create({
      data: { email: `crew-p13a-${suffix}@test.local`, passwordHash, name: "Crew P13A" },
    });
    const userFieldA = await prisma.user.create({
      data: { email: `field-p13a-${suffix}@test.local`, passwordHash, name: "Field P13A" },
    });
    userSalesAId = userSalesA.id;
    userOfficeAId = userOfficeA.id;
    userCrewAId = userCrewA.id;
    userFieldAId = userFieldA.id;

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
      data: { userId: userFieldAId, organizationId: orgAId, role: MembershipRole.FIELD_WORKER },
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
    fieldCtxA = {
      userId: userFieldAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.FIELD_WORKER,
      email: userFieldA.email!,
      name: userFieldA.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer P13 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p13-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgAId } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userOfficeAId, userCrewAId, userFieldAId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedJobWithTwoTasks() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P13 ${suffix}`,
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
    await prisma.quote.update({ where: { id: quoteId }, data: { customerFacingIntro: "Intro" } });

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
    const act = await quoteMutationActivateAcceptedQuoteAsJob(officeCtxA, fd({ quoteId }));
    expect(act.ok).toBe(true);
    if (!act.ok) throw new Error("activate");

    const job = await prisma.job.findUniqueOrThrow({ where: { quoteId } });
    const tasks = await prisma.jobTask.findMany({ where: { jobId: job.id }, orderBy: { sortOrder: "asc" } });
    return { jobId: job.id, taskAId: tasks[0]!.id, taskBId: tasks[1]!.id };
  }

  it("blocks COMPLETE when evidence required and no ACCEPTED evidence; allows after accept", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();

    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
        },
      },
    });

    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));

    const block = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(block.ok).toBe(false);
    if (!block.ok) {
      expect(block.error).toMatch(/accepted evidence/i);
    }
    const tAfterBlock = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tAfterBlock.status).toBe(JobTaskStatus.IN_PROGRESS);
    expect(tAfterBlock.completedAt).toBeNull();

    const ev = await prisma.jobEvidence.create({
      data: {
        organizationId: orgAId,
        jobId,
        jobTaskId: taskAId,
        status: JobEvidenceStatus.CANDIDATE,
        title: "Permit scan",
      },
    });
    const stillBlock = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(stillBlock.ok).toBe(false);

    await acceptJobEvidence(officeCtxA, ev.id);

    const ok = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(ok.ok).toBe(true);
    const tDone = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tDone.status).toBe(JobTaskStatus.COMPLETE);
    expect(tDone.completedAt).toBeTruthy();

    const tAfterFirstComplete = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tAfterFirstComplete.status).toBe(JobTaskStatus.COMPLETE);
    await acceptJobEvidence(
      officeCtxA,
      (
        await prisma.jobEvidence.create({
          data: {
            organizationId: orgAId,
            jobId,
            jobTaskId: taskAId,
            status: JobEvidenceStatus.CANDIDATE,
            title: "Second file",
          },
        })
      ).id,
    );
    const tStillComplete = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(tStillComplete.status).toBe(JobTaskStatus.COMPLETE);
  });

  it("accepting evidence does not auto-complete a task", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    const ev = await prisma.jobEvidence.create({
      data: {
        organizationId: orgAId,
        jobId,
        jobTaskId: taskAId,
        status: JobEvidenceStatus.CANDIDATE,
        title: "Photo",
      },
    });
    const acc = await acceptJobEvidence(officeCtxA, ev.id);
    expect(acc.ok).toBe(true);
    const t = await prisma.jobTask.findUniqueOrThrow({ where: { id: taskAId } });
    expect(t.status).toBe(JobTaskStatus.IN_PROGRESS);
  });

  it("job-level ACCEPTED evidence does not satisfy task requirement unless allowJobLevelEvidence", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
        },
      },
    });
    await prisma.jobEvidence.create({
      data: {
        organizationId: orgAId,
        jobId,
        jobTaskId: null,
        status: JobEvidenceStatus.ACCEPTED,
        title: "Job-level doc",
        reviewedAt: new Date(),
        reviewedByUserId: userOfficeAId,
      },
    });
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    const block = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(block.ok).toBe(false);

    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: true },
        },
      },
    });
    const ok = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(ok.ok).toBe(true);
  });

  it("invalid completionRequirementsJson fails closed for COMPLETE", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    await prisma.jobTask.update({
      where: { id: taskAId },
      data: { completionRequirementsJson: { version: 99, evidence: { required: true, minAcceptedCount: 1 } } },
    });
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    const r = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid completion requirement/i);
  });

  it("management override completes without accepted evidence when reason provided", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
        },
      },
    });
    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    const f = fd({
      jobId,
      taskId: taskAId,
      status: JobTaskStatus.COMPLETE,
      evidenceCompletionOverride: "true",
      overrideReason: "Emergency closeout authorized by ops manager.",
    });
    const r = await jobMutationUpdateTaskStatus(officeCtxA, f);
    expect(r.ok).toBe(true);
    const audits = await prisma.auditEvent.findMany({
      where: { organizationId: orgAId, type: "JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE" },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    expect(audits.some((a) => (a.payload as { jobTaskId?: string }).jobTaskId === taskAId)).toBe(true);
    const evs = await prisma.jobActivityEvent.findMany({
      where: { jobId, eventType: JobActivityEventType.JOB_TASK_COMPLETED_WITH_EVIDENCE_OVERRIDE },
    });
    expect(evs.length).toBeGreaterThanOrEqual(1);
  });

  it("crew cannot use evidence override", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
        },
      },
    });
    await jobMutationUpdateTaskStatus(crewCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    const r = await jobMutationUpdateTaskStatus(
      crewCtxA,
      fd({
        jobId,
        taskId: taskAId,
        status: JobTaskStatus.COMPLETE,
        evidenceCompletionOverride: "true",
        overrideReason: "Trying to bypass",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/permission to override|accepted evidence/i);
  });

  it("field worker can complete when requirement satisfied", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
        },
      },
    });
    const ev = await prisma.jobEvidence.create({
      data: {
        organizationId: orgAId,
        jobId,
        jobTaskId: taskAId,
        status: JobEvidenceStatus.CANDIDATE,
        title: "Site photo",
      },
    });
    await acceptJobEvidence(officeCtxA, ev.id);
    await jobMutationUpdateTaskStatus(fieldCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.IN_PROGRESS }));
    const r = await jobMutationUpdateTaskStatus(fieldCtxA, fd({ jobId, taskId: taskAId, status: JobTaskStatus.COMPLETE }));
    expect(r.ok).toBe(true);
  });

  it("denies requirement edit for crew; allows office", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    const deny = await jobMutationUpdateJobTaskCompletionRequirements(
      crewCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        required: "true",
        minAcceptedCount: "1",
        allowJobLevelEvidence: "false",
      }),
    );
    expect(deny.ok).toBe(false);

    const ok = await jobMutationUpdateJobTaskCompletionRequirements(
      officeCtxA,
      fd({
        jobId,
        jobTaskId: taskAId,
        required: "true",
        minAcceptedCount: "2",
        allowJobLevelEvidence: "false",
      }),
    );
    expect(ok.ok).toBe(true);
    const audits = await prisma.auditEvent.findMany({
      where: { organizationId: orgAId, type: "JOB_TASK_COMPLETION_REQUIREMENTS_UPDATED" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("loadAcceptedEvidenceCountMapsForJob + acceptedEvidenceCountForTaskFromMaps matches OR semantics", async () => {
    const { jobId, taskAId, taskBId } = await seedJobWithTwoTasks();
    await prisma.jobEvidence.create({
      data: {
        organizationId: orgAId,
        jobId,
        jobTaskId: null,
        status: JobEvidenceStatus.ACCEPTED,
        title: "Shared",
        reviewedAt: new Date(),
        reviewedByUserId: userOfficeAId,
      },
    });
    await prisma.jobEvidence.create({
      data: {
        organizationId: orgAId,
        jobId,
        jobTaskId: taskAId,
        status: JobEvidenceStatus.ACCEPTED,
        title: "A only",
        reviewedAt: new Date(),
        reviewedByUserId: userOfficeAId,
      },
    });
    const maps = await loadAcceptedEvidenceCountMapsForJob(officeCtxA, jobId);
    expect(acceptedEvidenceCountForTaskFromMaps(taskAId, false, maps)).toBe(1);
    expect(acceptedEvidenceCountForTaskFromMaps(taskAId, true, maps)).toBe(2);
    expect(acceptedEvidenceCountForTaskFromMaps(taskBId, true, maps)).toBe(1);
    expect(acceptedEvidenceCountForTaskFromMaps(taskBId, false, maps)).toBe(0);
  });

  it("Work Station shows evidence requirement card for office when task READY and shortfall", async () => {
    const { taskAId } = await seedJobWithTwoTasks();
    await prisma.jobTask.update({
      where: { id: taskAId },
      data: {
        status: JobTaskStatus.READY,
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
        },
      },
    });
    const feed = await getWorkStationFeed(officeCtxA, parseWorkStationFeedFilters({}));
    const hit = feed.cards.find((c) => c.id === `JOB_TASK:${taskAId}:evidence_requirement`);
    expect(hit).toBeTruthy();
    expect(hit?.sourceType).toBe("JOB_TASK");
    expect(hit?.title).toMatch(/accepted evidence/i);

    const crewFeed = await getWorkStationFeed(crewCtxA, parseWorkStationFeedFilters({}));
    expect(crewFeed.cards.some((c) => c.id === `JOB_TASK:${taskAId}:evidence_requirement`)).toBe(false);
  });

  it("evaluateJobTaskCompletionRequirements returns satisfied none when json null", async () => {
    const { jobId, taskAId } = await seedJobWithTwoTasks();
    const ev = await evaluateJobTaskCompletionRequirements({
      organizationId: orgAId,
      jobId,
      jobTaskId: taskAId,
      completionRequirementsJson: null,
    });
    expect(ev.satisfied).toBe(true);
    expect(ev.reason).toBe("none");
  });
});
