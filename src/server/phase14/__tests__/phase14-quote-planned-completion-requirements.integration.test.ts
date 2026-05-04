/**
 * Phase 14: quote planned execution completion requirements → snapshot v2 → activation → JobTask.
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
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  quoteMutationAddLineExecutionStage,
  quoteMutationAddLineExecutionTask,
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
  quoteMutationUpdateLineExecutionTask,
} from "@/server/phase2/quote-mutations";
import { jobMutationUpdateTaskStatus } from "@/server/phase4/job-mutations";
import {
  quoteMutationInitializeJobFromAcceptedQuote,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { jobMutationActivateExecution } from "@/server/phase4/job-activation";
import {
  parseSentSnapshotPreviewDto,
  parseValidatedSentQuoteSnapshot,
  sentQuoteSnapshotV2Schema,
} from "@/server/phase2/customer-preview";

config({ path: ".env" });

function fd(map: Record<string, string | undefined>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) f.set(k, v);
  }
  return f;
}

describe("Phase 14 quote planned completion requirements (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userSalesBId: string;
  let userOfficeAId: string;
  let customerAId: string;
  let salesCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  const suffix = `p14-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase14-pass-12", 8);
    const orgA = await prisma.organization.create({
      data: { name: `Org P14A ${suffix}`, slug: `org-p14a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P14B ${suffix}`, slug: `org-p14b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p14a-${suffix}@test.local`, passwordHash, name: "Sales P14A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p14b-${suffix}@test.local`, passwordHash, name: "Sales P14B" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p14a-${suffix}@test.local`, passwordHash, name: "Office P14A" },
    });
    userSalesAId = userSalesA.id;
    userSalesBId = userSalesB.id;
    userOfficeAId = userOfficeA.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userSalesBId, organizationId: orgBId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userOfficeAId, organizationId: orgAId, role: MembershipRole.OFFICE },
    });

    salesCtxA = {
      userId: userSalesAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.SALES,
      email: userSalesA.email!,
      name: userSalesA.name,
    };
    salesCtxB = {
      userId: userSalesBId,
      organizationId: orgBId,
      organizationName: orgB.name,
      role: MembershipRole.SALES,
      email: userSalesB.email!,
      name: userSalesB.name,
    };
    officeCtxA = {
      userId: userOfficeAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.OFFICE,
      email: userOfficeA.email!,
      name: userOfficeA.name,
    };

    const customerA = await prisma.customer.create({
      data: { organizationId: orgAId, displayName: `Customer P14 ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p14-${suffix}@example.com`,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userSalesBId, userOfficeAId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function seedDraftQuoteWithLineAndStage() {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P14 ${suffix}`,
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
    const stg = await quoteMutationAddLineExecutionStage(
      salesCtxA,
      fd({ quoteId, lineItemId: li.id, title: "Stage 1" }),
    );
    expect(stg.ok).toBe(true);
    const st = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: li.id } });
    return { oppId: opp.id, quoteId, lineItemId: li.id, stageId: st.id };
  }

  async function deleteQuoteCascade(quoteId: string) {
    const q = await prisma.quote.findUnique({ where: { id: quoteId }, select: { opportunityId: true } });
    await prisma.quote.deleteMany({ where: { id: quoteId } });
    if (q?.opportunityId) {
      await prisma.opportunity.delete({ where: { id: q.opportunityId } });
    }
  }

  it("add line execution task with evidence requirement stores canonical v1 JSON", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    const add = await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        title: "Permit filing",
        evidenceRequired: "true",
        minAcceptedEvidenceCount: "2",
        allowJobLevelEvidence: "true",
      }),
    );
    expect(add.ok).toBe(true);
    const t = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId } });
    expect(t.completionRequirementsJson).toEqual({
      version: 1,
      evidence: { required: true, minAcceptedCount: 2, allowJobLevelEvidence: true },
    });
    await deleteQuoteCascade(quoteId);
  });

  it("update line execution task clears requirement when toggle off", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    const add = await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        title: "Task one",
        evidenceRequired: "true",
        minAcceptedEvidenceCount: "1",
      }),
    );
    expect(add.ok).toBe(true);
    const t = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId } });
    const clear = await quoteMutationUpdateLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        taskId: t.id,
        title: "Task one",
        description: "",
        isRequired: "true",
        assignedRole: "",
        customerVisible: undefined,
        customerLabel: "",
        internalNotes: "",
        minAcceptedEvidenceCount: "1",
      }),
    );
    expect(clear.ok).toBe(true);
    const after = await prisma.quoteLineExecutionTask.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.completionRequirementsJson).toBeNull();
    await deleteQuoteCascade(quoteId);
  });

  it("rejects invalid minAcceptedEvidenceCount on add", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    const add = await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        title: "Bad",
        evidenceRequired: "true",
        minAcceptedEvidenceCount: "0",
      }),
    );
    expect(add.ok).toBe(false);
    await deleteQuoteCascade(quoteId);
  });

  it("denies line execution task update when quote is SENT", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    const add = await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({ quoteId, stageId, title: "T", evidenceRequired: "true", minAcceptedEvidenceCount: "1" }),
    );
    expect(add.ok).toBe(true);
    const t = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId } });
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    const denied = await quoteMutationUpdateLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        taskId: t.id,
        title: "Changed",
        description: "",
        isRequired: "true",
        assignedRole: "",
        customerVisible: undefined,
        customerLabel: "",
        internalNotes: "",
        minAcceptedEvidenceCount: "1",
      }),
    );
    expect(denied.ok).toBe(false);
    await deleteQuoteCascade(quoteId);
  });

  it("denies cross-org line execution task update", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    const add = await quoteMutationAddLineExecutionTask(salesCtxA, fd({ quoteId, stageId, title: "T" }));
    expect(add.ok).toBe(true);
    const t = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId } });
    const denied = await quoteMutationUpdateLineExecutionTask(
      salesCtxB,
      fd({
        quoteId,
        stageId,
        taskId: t.id,
        title: "Hacked",
        description: "",
        isRequired: undefined,
        assignedRole: "",
        customerVisible: undefined,
        customerLabel: "",
        internalNotes: "",
        minAcceptedEvidenceCount: "1",
      }),
    );
    expect(denied.ok).toBe(false);
    await deleteQuoteCascade(quoteId);
  });

  it("mark sent embeds completionRequirementsJson in internalExecutionPlan; preview stays clean", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        title: "Evidence task",
        evidenceRequired: "true",
        minAcceptedEvidenceCount: "1",
        allowJobLevelEvidence: "true",
      }),
    );
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    const sent = await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    expect(sent.ok).toBe(true);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const snap = parseValidatedSentQuoteSnapshot(row.sentSnapshotJson);
    expect(snap && "internalExecutionPlan" in snap).toBe(true);
    if (!snap || !("internalExecutionPlan" in snap)) throw new Error("snap");
    const plan = snap.internalExecutionPlan;
    const task0 = plan.lines[0]?.stages[0]?.tasks[0];
    expect(task0?.completionRequirementsJson).toEqual({
      version: 1,
      evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: true },
    });

    const preview = parseSentSnapshotPreviewDto(row.sentSnapshotJson);
    expect(preview).toBeTruthy();
    const prevStr = JSON.stringify(preview).toLowerCase();
    expect(prevStr).not.toContain("completionrequirementsjson");
    expect(prevStr).not.toContain("internalexecutionplan");

    await deleteQuoteCascade(quoteId);
  });

  it("mark send blocked when DB holds invalid completionRequirementsJson", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    await quoteMutationAddLineExecutionTask(salesCtxA, fd({ quoteId, stageId, title: "T" }));
    const t = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId } });
    await prisma.quoteLineExecutionTask.update({
      where: { id: t.id },
      data: {
        completionRequirementsJson: { version: 99, evidence: { required: true, minAcceptedCount: 1 } },
      },
    });
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    const sent = await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    expect(sent.ok).toBe(false);
    if (!sent.ok) expect(sent.error).toMatch(/invalid|unsupported|send blocked/i);
    await deleteQuoteCascade(quoteId);
  });

  it("activation copies frozen snapshot requirement; post-SENT live row mutation does not change job", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        title: "Gate task",
        evidenceRequired: "true",
        minAcceptedEvidenceCount: "1",
        allowJobLevelEvidence: undefined,
      }),
    );
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    const qt = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId } });
    await prisma.quoteLineExecutionTask.update({
      where: { id: qt.id },
      data: {
        completionRequirementsJson: {
          version: 1,
          evidence: { required: true, minAcceptedCount: 3, allowJobLevelEvidence: true },
        },
      },
    });

    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const initRes = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(initRes.ok).toBe(true);
    if (!initRes.ok || !initRes.jobId) return;

    // Activate for execution
    const activateRes = await jobMutationActivateExecution(officeCtxA, fd({ jobId: initRes.jobId }));
    expect(activateRes.ok).toBe(true);

    const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: initRes.jobId } });
    expect(jt.completionRequirementsJson).toEqual({
      version: 1,
      evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
    });

    await deleteQuoteCascade(quoteId);
  });

  it("activation fails closed on invalid snapshot completionRequirementsJson", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    await quoteMutationAddLineExecutionTask(salesCtxA, fd({ quoteId, stageId, title: "T" }));
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const initRes = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(initRes.ok).toBe(true);
    if (!initRes.ok) return;

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const snap = sentQuoteSnapshotV2Schema.parse(row.sentSnapshotJson);
    const tampered = {
      ...snap,
      internalExecutionPlan: {
        lines: snap.internalExecutionPlan.lines.map((l) => ({
          ...l,
          stages: l.stages.map((s) => ({
            ...s,
            tasks: s.tasks.map((tk) => ({
              ...tk,
              completionRequirementsJson: { version: 99, evidence: { required: true, minAcceptedCount: 1 } },
            })),
          })),
        })),
      },
    };
    await prisma.quote.update({
      where: { id: quoteId },
      data: { sentSnapshotJson: tampered as object },
    });
    const actRes = await jobMutationActivateExecution(officeCtxA, fd({ jobId: initRes.jobId }));
    expect(actRes.ok).toBe(false);
    if (!actRes.ok) {
      expect(actRes.error.toLowerCase()).toMatch(/valid sent snapshot|activation blocked|invalid/);
    }

    await deleteQuoteCascade(quoteId);
  });

  it("activated requirement from quote enforces Phase 13 completion gate", async () => {
    const { quoteId, stageId } = await seedDraftQuoteWithLineAndStage();
    await quoteMutationAddLineExecutionTask(
      salesCtxA,
      fd({
        quoteId,
        stageId,
        title: "Needs proof",
        evidenceRequired: "true",
        minAcceptedEvidenceCount: "1",
      }),
    );
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
    const initRes = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
    expect(initRes.ok).toBe(true);
    if (!initRes.ok || !initRes.jobId) return;

    // Activate for execution
    const activateRes = await jobMutationActivateExecution(officeCtxA, fd({ jobId: initRes.jobId }));
    expect(activateRes.ok).toBe(true);
    if (!activateRes.ok) return;

    const jt = await prisma.jobTask.findFirstOrThrow({ where: { jobId: initRes.jobId } });
    expect(jt.completionRequirementsJson).toBeTruthy();

    await jobMutationUpdateTaskStatus(officeCtxA, fd({ jobId: initRes.jobId, taskId: jt.id, status: JobTaskStatus.IN_PROGRESS }));
    const block = await jobMutationUpdateTaskStatus(
      officeCtxA,
      fd({ jobId: initRes.jobId, taskId: jt.id, status: JobTaskStatus.COMPLETE }),
    );
    expect(block.ok).toBe(false);
    if (!block.ok) expect(block.error).toMatch(/accepted evidence/i);

    await deleteQuoteCascade(quoteId);
  });
});
