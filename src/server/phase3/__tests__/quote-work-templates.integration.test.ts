/**
 * Phase 3A quote work templates — org isolation, copy semantics, SENT guards, preview/snapshot.
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
  QuoteAssumptionVisibility,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskStatus,
  QuoteWorkTemplateKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import {
  buildQuoteCustomerPreviewDTO,
  parseSentSnapshotPreviewDto,
  parseValidatedSentQuoteSnapshot,
} from "@/server/phase2/customer-preview";
import { evaluateQuoteSendReadiness, allQuoteSendBlockersPass } from "@/server/phase2/quote-readiness";
import {
  quoteMutationAddLineExecutionTask,
  quoteMutationAddLineItem,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
  quoteMutationUpdateLineExecutionTask,
} from "@/server/phase2/quote-mutations";
import { getQuoteWorkspace } from "@/server/phase2/quote-queries";
import {
  quoteMutationArchiveQuoteWorkTemplate,
  quoteMutationInsertLineItemTemplateIntoQuote,
  quoteMutationInsertStageTemplateIntoLine,
  quoteMutationInsertTaskTemplateIntoStage,
  quoteMutationRestoreQuoteWorkTemplate,
  quoteMutationSaveExecutionTaskAsTemplate,
  quoteMutationSaveLineItemAsTemplate,
  quoteMutationSaveStageAsTemplate,
  quoteMutationUpdateQuoteWorkTemplateMetadata,
} from "@/server/phase3/template-mutations";
import {
  listActiveQuoteWorkTemplates,
  listActiveQuoteWorkTemplatesGrouped,
  listQuoteWorkTemplatesForLibrary,
  resolveQuoteWorkTemplateLibraryDetail,
} from "@/server/phase3/template-queries";
import { parseTaskOnlyPayload, TEMPLATE_PAYLOAD_VERSION, validatePayloadForKind } from "@/server/phase3/template-payloads";
import {
  quoteMutationInitializeJobFromAcceptedQuote,
  quoteMutationMarkAccepted,
} from "@/server/phase4/quote-accept-activate";
import { jobMutationActivateExecution } from "@/server/phase4/job-activation";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 3A quote work templates (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userMemberAId: string;
  let userSalesBId: string;
  let userAdminAId: string;
  let userOfficeAId: string;
  let customerAId: string;
  let opportunityAId: string;
  let salesCtxA: OrgSessionContext;
  let memberCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  let adminCtxA: OrgSessionContext;
  let officeCtxA: OrgSessionContext;
  const suffix = `p3a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase3a-templates-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org P3A A ${suffix}`, slug: `org-p3a-a-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org P3A B ${suffix}`, slug: `org-p3a-b-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-p3a-a-${suffix}@test.local`, passwordHash, name: "Sales P3A A" },
    });
    const userMemberA = await prisma.user.create({
      data: { email: `member-p3a-a-${suffix}@test.local`, passwordHash, name: "Member P3A A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-p3a-b-${suffix}@test.local`, passwordHash, name: "Sales P3A B" },
    });
    const userAdminA = await prisma.user.create({
      data: { email: `admin-p3a-a-${suffix}@test.local`, passwordHash, name: "Admin P3A A" },
    });
    const userOfficeA = await prisma.user.create({
      data: { email: `office-p3a-a-${suffix}@test.local`, passwordHash, name: "Office P3A A" },
    });
    userSalesAId = userSalesA.id;
    userMemberAId = userMemberA.id;
    userSalesBId = userSalesB.id;
    userAdminAId = userAdminA.id;
    userOfficeAId = userOfficeA.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
    });
    await prisma.membership.create({
      data: { userId: userMemberAId, organizationId: orgAId, role: MembershipRole.MEMBER },
    });
    await prisma.membership.create({
      data: { userId: userAdminAId, organizationId: orgAId, role: MembershipRole.ADMIN },
    });
    await prisma.membership.create({
      data: { userId: userOfficeAId, organizationId: orgAId, role: MembershipRole.OFFICE },
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
    adminCtxA = {
      userId: userAdminAId,
      organizationId: orgAId,
      organizationName: orgA.name,
      role: MembershipRole.ADMIN,
      email: userAdminA.email!,
      name: userAdminA.name,
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
      data: { organizationId: orgAId, displayName: `Customer P3A ${suffix}` },
    });
    customerAId = customerA.id;
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-p3a-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const oppA = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp P3A ${suffix}`,
        serviceType: "Electrical",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Install work",
      },
    });
    opportunityAId = oppA.id;
    await prisma.opportunityTask.create({
      data: {
        opportunityId: opportunityAId,
        title: "Intake optional",
        kind: OpportunityTaskKind.INTAKE,
        status: OpportunityTaskStatus.NOT_READY,
        isRequired: false,
      },
    });

    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer P3A B ${suffix}` },
    });
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerB.id,
        type: CustomerContactType.EMAIL,
        value: `cust-p3a-b-${suffix}@example.com`,
        isPrimary: true,
      },
    });
    const oppB = await prisma.opportunity.create({
      data: {
        organizationId: orgBId,
        customerId: customerB.id,
        title: `Opp P3A B ${suffix}`,
        serviceType: "Other",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Work",
      },
    });
    await prisma.opportunityTask.create({
      data: {
        opportunityId: oppB.id,
        title: "Opt",
        kind: OpportunityTaskKind.INTAKE,
        status: OpportunityTaskStatus.NOT_READY,
        isRequired: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: { id: { in: [userSalesAId, userMemberAId, userSalesBId, userAdminAId, userOfficeAId] } },
      })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  async function createReadyDraftQuote(): Promise<string> {
    await prisma.quote.deleteMany({ where: { organizationId: orgAId, opportunityId: opportunityAId } });
    const draft = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opportunityAId);
    expect(draft.ok && draft.outcome === "created").toBe(true);
    if (!draft.ok || draft.outcome !== "created") throw new Error("draft");
    const quoteId = draft.quoteId;
    await prisma.quote.update({
      where: { id: quoteId },
      data: { customerFacingIntro: "Intro for send path." },
    });
    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Service line",
        customerDescription: "Customer-facing scope text for tests.",
        quantity: "1",
        unitPriceCents: "10000",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const stage = await prisma.quoteLineExecutionStage.create({
      data: { organizationId: orgAId, quoteLineItemId: line.id, title: "Stage A", sortOrder: 0 },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: stage.id,
        title: "Visible milestone",
        status: QuoteTaskStatus.COMPLETE,
        isRequired: true,
        sortOrder: 0,
        customerVisible: true,
        customerLabel: "Milestone label",
        internalNotes: "INTERNAL_TASK_NOTE",
      },
    });
    await prisma.quoteAssumption.create({
      data: {
        organizationId: orgAId,
        quoteId,
        visibility: QuoteAssumptionVisibility.CUSTOMER_VISIBLE,
        text: "Standard terms apply.",
        sortOrder: 0,
      },
    });
    return quoteId;
  }

  it("save line / stage / task as template: strips operational ids; member denied", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
    const task = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId: stage.id } });

    const lineT = await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({
        quoteId,
        lineItemId: line.id,
        name: `Line tmpl ${suffix}`,
        description: "Desc",
        tags: "a, b",
      }),
    );
    expect(lineT.ok).toBe(true);

    const stageT = await quoteMutationSaveStageAsTemplate(
      salesCtxA,
      fd({
        quoteId,
        lineItemId: line.id,
        stageId: stage.id,
        name: `Stage tmpl ${suffix}`,
      }),
    );
    expect(stageT.ok).toBe(true);

    const taskT = await quoteMutationSaveExecutionTaskAsTemplate(
      salesCtxA,
      fd({
        quoteId,
        stageId: stage.id,
        taskId: task.id,
        name: `Task tmpl ${suffix}`,
      }),
    );
    expect(taskT.ok).toBe(true);

    const lt = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, kind: QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN, name: `Line tmpl ${suffix}` },
    });
    const payload = validatePayloadForKind(QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN, lt.payloadJson);
    const pStr = JSON.stringify(payload);
    expect(pStr).not.toMatch(/quoteId|customerId|opportunityId|organizationId/);
    expect(payload.stages.length).toBeGreaterThanOrEqual(1);

    const mem = await quoteMutationSaveLineItemAsTemplate(
      memberCtxA,
      fd({ quoteId, lineItemId: line.id, name: "Should fail" }),
    );
    expect(mem.ok).toBe(false);

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("cross-org: cannot save template from other org quote", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const r = await quoteMutationSaveLineItemAsTemplate(
      salesCtxB,
      fd({ quoteId, lineItemId: line.id, name: "Cross org" }),
    );
    expect(r.ok).toBe(false);
    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("list + archive: SALES cannot archive; ADMIN archives; archived hidden from active list; archived cannot be inserted", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, name: `Archive me ${suffix}` }),
    );
    const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `Archive me ${suffix}` },
    });
    const listedBefore = await listActiveQuoteWorkTemplates(orgAId, QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN);
    expect(listedBefore.some((t) => t.id === tmpl.id)).toBe(true);

    const denied = await quoteMutationArchiveQuoteWorkTemplate(salesCtxA, fd({ templateId: tmpl.id }));
    expect(denied.ok).toBe(false);
    const officeDenied = await quoteMutationArchiveQuoteWorkTemplate(officeCtxA, fd({ templateId: tmpl.id }));
    expect(officeDenied.ok).toBe(false);

    const arch = await quoteMutationArchiveQuoteWorkTemplate(adminCtxA, fd({ templateId: tmpl.id }));
    expect(arch.ok).toBe(true);

    const listedAfter = await listActiveQuoteWorkTemplates(orgAId, QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN);
    expect(listedAfter.some((t) => t.id === tmpl.id)).toBe(false);

    const ins = await quoteMutationInsertLineItemTemplateIntoQuote(
      salesCtxA,
      fd({ quoteId, templateId: tmpl.id }),
    );
    expect(ins.ok).toBe(false);
    if (!ins.ok) expect(ins.error).toMatch(/archived/i);

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("insert line template: new ids, NOT_READY tasks, source metadata; template unchanged after quote edit", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, name: `Insert line ${suffix}` }),
    );
    const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `Insert line ${suffix}` },
    });

    const beforeTaskIds = (
      await prisma.quoteLineExecutionTask.findMany({
        where: { organizationId: orgAId, stage: { quoteLineItem: { quoteId } } },
        select: { id: true },
      })
    ).map((t) => t.id);

    const ins = await quoteMutationInsertLineItemTemplateIntoQuote(
      salesCtxA,
      fd({ quoteId, templateId: tmpl.id }),
    );
    expect(ins.ok).toBe(true);

    const lines = await prisma.quoteLineItem.findMany({ where: { quoteId }, orderBy: { sortOrder: "asc" } });
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const inserted = lines.find((l) => l.sourceTemplateId === tmpl.id);
    expect(inserted).toBeTruthy();
    expect(inserted!.sourceTemplateKind).toBe(QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN);
    expect(inserted!.sourceTemplateName).toBe(tmpl.name);

    const newTasks = await prisma.quoteLineExecutionTask.findMany({
      where: { organizationId: orgAId, stage: { quoteLineItemId: inserted!.id } },
    });
    expect(newTasks.length).toBeGreaterThan(0);
    for (const t of newTasks) {
      expect(t.status).toBe(QuoteTaskStatus.NOT_READY);
      expect(beforeTaskIds).not.toContain(t.id);
    }

    await prisma.quoteLineItem.update({
      where: { id: inserted!.id },
      data: { title: "Mutated quote-owned title" },
    });
    const tmplReload = await prisma.quoteWorkTemplate.findUniqueOrThrow({ where: { id: tmpl.id } });
    const p2 = validatePayloadForKind(QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN, tmplReload.payloadJson);
    expect(p2.line.title).not.toBe("Mutated quote-owned title");

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("insert stage and task templates; cross-org and SENT denied", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
    const task = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId: stage.id } });

    await quoteMutationSaveStageAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, stageId: stage.id, name: `St ins ${suffix}` }),
    );
    await quoteMutationSaveExecutionTaskAsTemplate(
      salesCtxA,
      fd({ quoteId, stageId: stage.id, taskId: task.id, name: `Tk ins ${suffix}` }),
    );
    const stTmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `St ins ${suffix}` },
    });
    const tkTmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `Tk ins ${suffix}` },
    });

    const stIns = await quoteMutationInsertStageTemplateIntoLine(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, templateId: stTmpl.id }),
    );
    expect(stIns.ok).toBe(true);

    const stages = await prisma.quoteLineExecutionStage.findMany({ where: { quoteLineItemId: line.id } });
    expect(stages.length).toBeGreaterThanOrEqual(2);

    const newStage = stages.find((s) => s.title === stage.title && s.id !== stage.id);
    expect(newStage).toBeTruthy();

    const tkIns = await quoteMutationInsertTaskTemplateIntoStage(
      salesCtxA,
      fd({ quoteId, stageId: newStage!.id, templateId: tkTmpl.id }),
    );
    expect(tkIns.ok).toBe(true);

    const badOrg = await quoteMutationInsertTaskTemplateIntoStage(
      salesCtxB,
      fd({ quoteId, stageId: newStage!.id, templateId: tkTmpl.id }),
    );
    expect(badOrg.ok).toBe(false);

    await prisma.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.SENT, sentAt: new Date() } });
    const sentIns = await quoteMutationInsertLineItemTemplateIntoQuote(
      salesCtxA,
      fd({ quoteId, templateId: stTmpl.id }),
    );
    expect(sentIns.ok).toBe(false);

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("SENT quote: save-as-template denied", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await prisma.quote.update({ where: { id: quoteId }, data: { status: QuoteStatus.SENT, sentAt: new Date() } });
    const r = await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, name: "Should fail sent" }),
    );
    expect(r.ok).toBe(false);
    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("preview + readiness: inserted customer-visible task appears; snapshot v2 includes execution", async () => {
    const quoteId = await createReadyDraftQuote();
    const full = await getQuoteWorkspace(orgAId, quoteId);
    expect(full).toBeTruthy();
    if (!full) return;

    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: (await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } })).id,
        title: "Internal only",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 99,
        customerVisible: false,
      },
    });

    const preview = buildQuoteCustomerPreviewDTO({
      organizationName: "Test Org",
      quote: full,
      customer: full.customer,
      lineItems: full.lineItems,
      assumptions: full.assumptions,
    });
    const labels = preview.lineItems.flatMap((l) => (l.customerVisibleExecutionHighlights ?? []).map((h) => h.label));
    expect(labels.some((l) => l.includes("Milestone"))).toBe(true);

    const readiness = evaluateQuoteSendReadiness({
      quote: full,
      opportunity: full.opportunity,
      customerContacts: full.customer.contactMethods,
      lineItems: full.lineItems,
      quoteTasks: full.tasks,
      assumptions: full.assumptions,
    });
    expect(allQuoteSendBlockersPass(readiness)).toBe(true);

    const sent = await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    expect(sent.ok).toBe(true);
    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const snap = parseValidatedSentQuoteSnapshot(row.sentSnapshotJson);
    expect(snap?.version).toBe(2);
    if (!snap || snap.version !== 2) return;
    const frozenLine = snap.internalExecutionPlan.lines.find((l) => l.quoteLineItemId === line.id);
    expect(frozenLine?.stages?.length).toBeGreaterThan(0);
    const snapStr = JSON.stringify(snap);
    expect(snapStr).not.toMatch(/sourceTemplate/);

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("listActiveQuoteWorkTemplatesGrouped returns three buckets", async () => {
    const g = await listActiveQuoteWorkTemplatesGrouped(orgAId);
    expect(Array.isArray(g.line)).toBe(true);
    expect(Array.isArray(g.stage)).toBe(true);
    expect(Array.isArray(g.task)).toBe(true);
  });

  it("Phase 3B library list: status, kind, and search filters", async () => {
    const base = `LibFilter ${suffix}`;
    await prisma.quoteWorkTemplate.create({
      data: {
        organizationId: orgAId,
        kind: QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN,
        name: `${base} AlphaLine`,
        description: "UniqueSearchTokenXYZ",
        payloadVersion: TEMPLATE_PAYLOAD_VERSION,
        contentVersion: 3,
        payloadJson: {
          line: {
            title: "L",
            customerDescription: "CD",
            quantity: 1,
            pricingMode: PricingMode.FIXED_PRICE,
            lineMode: QuoteLineMode.REQUIRED,
          },
          stages: [],
        },
        createdById: userAdminAId,
      },
    });
    await prisma.quoteWorkTemplate.create({
      data: {
        organizationId: orgAId,
        kind: QuoteWorkTemplateKind.TASK,
        name: `${base} BetaTask`,
        description: null,
        archivedAt: new Date(),
        payloadVersion: TEMPLATE_PAYLOAD_VERSION,
        contentVersion: 1,
        payloadJson: {
          task: { title: "T", isRequired: false, customerVisible: false },
        },
        createdById: userAdminAId,
      },
    });

    const activeLines = await listQuoteWorkTemplatesForLibrary(orgAId, {
      status: "active",
      kind: QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN,
    });
    expect(activeLines.some((t) => t.name === `${base} AlphaLine`)).toBe(true);
    expect(activeLines.some((t) => t.name === `${base} BetaTask`)).toBe(false);

    const archivedOnly = await listQuoteWorkTemplatesForLibrary(orgAId, { status: "archived" });
    expect(archivedOnly.some((t) => t.name === `${base} BetaTask`)).toBe(true);

    const allRows = await listQuoteWorkTemplatesForLibrary(orgAId, { status: "all", search: "UniqueSearchTokenXYZ" });
    expect(allRows.some((t) => t.name === `${base} AlphaLine`)).toBe(true);

    await prisma.quoteWorkTemplate.deleteMany({ where: { organizationId: orgAId, name: { startsWith: base } } });
  });

  it("Phase 3B metadata: ADMIN updates; OFFICE denied; payloadJson and contentVersion unchanged", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, name: `Meta tmpl ${suffix}`, description: "Original desc", tags: "x" }),
    );
    const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `Meta tmpl ${suffix}` },
    });
    const payloadBefore = tmpl.payloadJson;
    const cvBefore = tmpl.contentVersion;

    const denied = await quoteMutationUpdateQuoteWorkTemplateMetadata(
      officeCtxA,
      fd({
        templateId: tmpl.id,
        name: "Should fail",
        description: "Nope",
        tags: "a",
      }),
    );
    expect(denied.ok).toBe(false);

    const ok = await quoteMutationUpdateQuoteWorkTemplateMetadata(
      adminCtxA,
      fd({
        templateId: tmpl.id,
        name: `Meta tmpl ${suffix} renamed`,
        description: "Updated desc",
        tags: "a, b",
      }),
    );
    expect(ok.ok).toBe(true);

    const reloaded = await prisma.quoteWorkTemplate.findUniqueOrThrow({ where: { id: tmpl.id } });
    expect(reloaded.name).toBe(`Meta tmpl ${suffix} renamed`);
    expect(reloaded.description).toBe("Updated desc");
    expect(JSON.stringify(reloaded.payloadJson)).toBe(JSON.stringify(payloadBefore));
    expect(reloaded.contentVersion).toBe(cvBefore);

    const memberMeta = await quoteMutationUpdateQuoteWorkTemplateMetadata(
      memberCtxA,
      fd({ templateId: tmpl.id, name: "Hack", description: null, tags: "" }),
    );
    expect(memberMeta.ok).toBe(false);

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("Phase 3B restore: archived template returns to active list; contentVersion unchanged", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, name: `Restore tmpl ${suffix}` }),
    );
    const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `Restore tmpl ${suffix}` },
    });
    const cv = tmpl.contentVersion;
    await quoteMutationArchiveQuoteWorkTemplate(adminCtxA, fd({ templateId: tmpl.id }));

    const denied = await quoteMutationRestoreQuoteWorkTemplate(officeCtxA, fd({ templateId: tmpl.id }));
    expect(denied.ok).toBe(false);

    const ok = await quoteMutationRestoreQuoteWorkTemplate(adminCtxA, fd({ templateId: tmpl.id }));
    expect(ok.ok).toBe(true);

    const active = await listActiveQuoteWorkTemplates(orgAId, QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN);
    expect(active.some((t) => t.id === tmpl.id)).toBe(true);
    const again = await prisma.quoteWorkTemplate.findUniqueOrThrow({ where: { id: tmpl.id } });
    expect(again.contentVersion).toBe(cv);
    expect(again.archivedAt).toBeNull();

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  it("Phase 3B resolveQuoteWorkTemplateLibraryDetail: cross-org id is not_found", async () => {
    const quoteId = await createReadyDraftQuote();
    const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    await quoteMutationSaveLineItemAsTemplate(
      salesCtxA,
      fd({ quoteId, lineItemId: line.id, name: `Cross detail ${suffix}` }),
    );
    const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
      where: { organizationId: orgAId, name: `Cross detail ${suffix}` },
    });
    const r = await resolveQuoteWorkTemplateLibraryDetail(orgBId, tmpl.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");

    await prisma.quote.delete({ where: { id: quoteId } });
  });

  describe("Phase 15: template completionRequirementsJson pass-through", () => {
    const canonicalReq = {
      version: 1 as const,
      evidence: { required: true, minAcceptedCount: 2, allowJobLevelEvidence: true },
    };

    it("legacy TASK template without completionRequirementsJson still applies with null quote row JSON", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      const legacy = await prisma.quoteWorkTemplate.create({
        data: {
          organizationId: orgAId,
          kind: QuoteWorkTemplateKind.TASK,
          name: `Legacy task tmpl ${suffix}`,
          payloadVersion: TEMPLATE_PAYLOAD_VERSION,
          contentVersion: 1,
          payloadJson: { task: { title: "Legacy only", isRequired: false, customerVisible: false } },
          createdById: userSalesAId,
        },
      });
      const beforeCount = await prisma.quoteLineExecutionTask.count({
        where: { organizationId: orgAId, stageId: stage.id },
      });
      const ins = await quoteMutationInsertTaskTemplateIntoStage(
        salesCtxA,
        fd({ quoteId, stageId: stage.id, templateId: legacy.id }),
      );
      expect(ins.ok).toBe(true);
      expect(await prisma.quoteLineExecutionTask.count({ where: { organizationId: orgAId, stageId: stage.id } })).toBe(
        beforeCount + 1,
      );
      const inserted = await prisma.quoteLineExecutionTask.findFirstOrThrow({
        where: { organizationId: orgAId, stageId: stage.id, title: "Legacy only" },
      });
      expect(inserted.completionRequirementsJson).toBeNull();
      await prisma.quoteWorkTemplate.delete({ where: { id: legacy.id } });
      await prisma.quote.delete({ where: { id: quoteId } });
    });

    it("save task template preserves canonical completionRequirementsJson; apply copies to quote row", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      const add = await quoteMutationAddLineExecutionTask(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          title: "Gated work unit",
          evidenceRequired: "true",
          minAcceptedEvidenceCount: "2",
          allowJobLevelEvidence: "true",
        }),
      );
      expect(add.ok).toBe(true);
      const gated = await prisma.quoteLineExecutionTask.findFirstOrThrow({
        where: { organizationId: orgAId, stageId: stage.id, title: "Gated work unit" },
      });
      expect(gated.completionRequirementsJson).toEqual(canonicalReq);

      const saveT = await quoteMutationSaveExecutionTaskAsTemplate(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          taskId: gated.id,
          name: `Gated task tmpl ${suffix}`,
        }),
      );
      expect(saveT.ok).toBe(true);
      const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
        where: { organizationId: orgAId, name: `Gated task tmpl ${suffix}` },
      });
      const parsed = parseTaskOnlyPayload(tmpl.payloadJson);
      expect(parsed.task.completionRequirementsJson).toEqual(canonicalReq);

      const stage2 = await prisma.quoteLineExecutionStage.create({
        data: { organizationId: orgAId, quoteLineItemId: line.id, title: "Insert target stage", sortOrder: 99 },
      });
      const ins = await quoteMutationInsertTaskTemplateIntoStage(
        salesCtxA,
        fd({ quoteId, stageId: stage2.id, templateId: tmpl.id }),
      );
      expect(ins.ok).toBe(true);
      const applied = await prisma.quoteLineExecutionTask.findFirstOrThrow({
        where: { organizationId: orgAId, stageId: stage2.id, title: "Gated work unit" },
      });
      expect(applied.completionRequirementsJson).toEqual(canonicalReq);

      await prisma.quoteWorkTemplate.delete({ where: { id: tmpl.id } });
      await prisma.quote.delete({ where: { id: quoteId } });
    });

    it("save-as-template fails closed when quote task has invalid completionRequirementsJson in DB", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      const task = await prisma.quoteLineExecutionTask.findFirstOrThrow({ where: { stageId: stage.id } });
      await prisma.quoteLineExecutionTask.update({
        where: { id: task.id },
        data: {
          completionRequirementsJson: { version: 99, evidence: { required: true, minAcceptedCount: 1 } },
        },
      });
      const r = await quoteMutationSaveExecutionTaskAsTemplate(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          taskId: task.id,
          name: `Should fail save ${suffix}`,
        }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/invalid completion requirements/i);
      await prisma.quote.delete({ where: { id: quoteId } });
    });

    it("insert task template fails closed when payload completionRequirementsJson is invalid", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      const bad = await prisma.quoteWorkTemplate.create({
        data: {
          organizationId: orgAId,
          kind: QuoteWorkTemplateKind.TASK,
          name: `Bad gate tmpl ${suffix}`,
          payloadVersion: TEMPLATE_PAYLOAD_VERSION,
          contentVersion: 1,
          payloadJson: {
            task: {
              title: "Bad",
              isRequired: false,
              completionRequirementsJson: { version: 99, evidence: { required: true, minAcceptedCount: 1 } },
            },
          },
          createdById: userSalesAId,
        },
      });
      const before = await prisma.quoteLineExecutionTask.count({ where: { stageId: stage.id, organizationId: orgAId } });
      const ins = await quoteMutationInsertTaskTemplateIntoStage(
        salesCtxA,
        fd({ quoteId, stageId: stage.id, templateId: bad.id }),
      );
      expect(ins.ok).toBe(false);
      expect(
        await prisma.quoteLineExecutionTask.count({ where: { stageId: stage.id, organizationId: orgAId } }),
      ).toBe(before);
      await prisma.quoteWorkTemplate.delete({ where: { id: bad.id } });
      await prisma.quote.delete({ where: { id: quoteId } });
    });

    it("line template save/apply carries nested task completionRequirementsJson", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      await quoteMutationAddLineExecutionTask(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          title: "Nested gate",
          evidenceRequired: "true",
          minAcceptedEvidenceCount: "1",
        }),
      );
      await quoteMutationSaveLineItemAsTemplate(
        salesCtxA,
        fd({ quoteId, lineItemId: line.id, name: `Line with gate ${suffix}` }),
      );
      const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
        where: { organizationId: orgAId, name: `Line with gate ${suffix}` },
      });
      const payload = validatePayloadForKind(QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN, tmpl.payloadJson);
      const nested = payload.stages.flatMap((s) => s.tasks).find((t) => t.title === "Nested gate");
      expect(nested?.completionRequirementsJson).toEqual({
        version: 1,
        evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
      });

      const ins = await quoteMutationInsertLineItemTemplateIntoQuote(
        salesCtxA,
        fd({ quoteId, templateId: tmpl.id }),
      );
      expect(ins.ok).toBe(true);
      const lines = await prisma.quoteLineItem.findMany({ where: { quoteId }, orderBy: { sortOrder: "asc" } });
      const insertedLine = lines.find((l) => l.sourceTemplateId === tmpl.id);
      expect(insertedLine).toBeTruthy();
      const insertedTask = await prisma.quoteLineExecutionTask.findFirst({
        where: {
          organizationId: orgAId,
          title: "Nested gate",
          stage: { quoteLineItemId: insertedLine!.id },
        },
      });
      expect(insertedTask?.completionRequirementsJson).toEqual({
        version: 1,
        evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
      });

      await prisma.quoteWorkTemplate.delete({ where: { id: tmpl.id } });
      await prisma.quote.delete({ where: { id: quoteId } });
    });

    it("editing quote task requirements after template apply does not mutate source template payload", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      const add = await quoteMutationAddLineExecutionTask(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          title: "Source gated",
          evidenceRequired: "true",
          minAcceptedEvidenceCount: "2",
          allowJobLevelEvidence: "true",
        }),
      );
      expect(add.ok).toBe(true);
      const sourceTask = await prisma.quoteLineExecutionTask.findFirstOrThrow({
        where: { stageId: stage.id, title: "Source gated" },
      });
      await quoteMutationSaveExecutionTaskAsTemplate(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          taskId: sourceTask.id,
          name: `No live mut ${suffix}`,
        }),
      );
      const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
        where: { organizationId: orgAId, name: `No live mut ${suffix}` },
      });
      const payloadJsonBefore = JSON.stringify(tmpl.payloadJson);

      const stage2 = await prisma.quoteLineExecutionStage.create({
        data: { organizationId: orgAId, quoteLineItemId: line.id, title: "Apply here", sortOrder: 98 },
      });
      const ins = await quoteMutationInsertTaskTemplateIntoStage(
        salesCtxA,
        fd({ quoteId, stageId: stage2.id, templateId: tmpl.id }),
      );
      expect(ins.ok).toBe(true);
      const appliedTask = await prisma.quoteLineExecutionTask.findFirstOrThrow({
        where: { stageId: stage2.id, title: "Source gated" },
      });
      const upd = await quoteMutationUpdateLineExecutionTask(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage2.id,
          taskId: appliedTask.id,
          title: "Source gated",
          description: "",
          isRequired: "true",
          assignedRole: "",
          customerVisible: undefined,
          customerLabel: "",
          internalNotes: "",
          evidenceRequired: "true",
          minAcceptedEvidenceCount: "3",
          allowJobLevelEvidence: "true",
        }),
      );
      expect(upd.ok).toBe(true);

      const tmplReload = await prisma.quoteWorkTemplate.findUniqueOrThrow({ where: { id: tmpl.id } });
      expect(JSON.stringify(tmplReload.payloadJson)).toBe(payloadJsonBefore);

      await prisma.quoteWorkTemplate.delete({ where: { id: tmpl.id } });
      await prisma.quote.delete({ where: { id: quoteId } });
    });

    it("apply → send → activate: JobTask receives completionRequirementsJson from frozen snapshot v2", async () => {
      const quoteId = await createReadyDraftQuote();
      const line = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
      const stage = await prisma.quoteLineExecutionStage.findFirstOrThrow({ where: { quoteLineItemId: line.id } });
      await quoteMutationAddLineExecutionTask(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          title: "Activation gate task",
          evidenceRequired: "true",
          minAcceptedEvidenceCount: "1",
        }),
      );
      await quoteMutationSaveExecutionTaskAsTemplate(
        salesCtxA,
        fd({
          quoteId,
          stageId: stage.id,
          taskId: (
            await prisma.quoteLineExecutionTask.findFirstOrThrow({
              where: { stageId: stage.id, title: "Activation gate task" },
            })
          ).id,
          name: `Act gate tmpl ${suffix}`,
        }),
      );
      const tmpl = await prisma.quoteWorkTemplate.findFirstOrThrow({
        where: { organizationId: orgAId, name: `Act gate tmpl ${suffix}` },
      });
      const stage2 = await prisma.quoteLineExecutionStage.create({
        data: { organizationId: orgAId, quoteLineItemId: line.id, title: "For activation insert", sortOrder: 97 },
      });
      const ins = await quoteMutationInsertTaskTemplateIntoStage(
        salesCtxA,
        fd({ quoteId, stageId: stage2.id, templateId: tmpl.id }),
      );
      expect(ins.ok).toBe(true);

      const sourceGated = await prisma.quoteLineExecutionTask.findFirstOrThrow({
        where: { organizationId: orgAId, stageId: stage.id, title: "Activation gate task" },
      });
      await prisma.quoteLineExecutionTask.delete({ where: { id: sourceGated.id } });

      const ready = await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
      expect(ready.ok).toBe(true);
      const sent = await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
      expect(sent.ok).toBe(true);
      const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
      const snap = parseValidatedSentQuoteSnapshot(row.sentSnapshotJson);
      expect(snap && "version" in snap && snap.version).toBe(2);
      if (!snap || !("internalExecutionPlan" in snap)) throw new Error("snap");
      const planStr = JSON.stringify(snap.internalExecutionPlan);
      expect(planStr).toContain("Activation gate task");
      expect(planStr).toContain("completionRequirementsJson");

      const preview = parseSentSnapshotPreviewDto(row.sentSnapshotJson);
      expect(preview).toBeTruthy();
      expect(JSON.stringify(preview).toLowerCase()).not.toContain("completionrequirementsjson");

      const acc = await quoteMutationMarkAccepted(salesCtxA, fd({ quoteId }));
      expect(acc.ok).toBe(true);
      const initRes = await quoteMutationInitializeJobFromAcceptedQuote(officeCtxA, fd({ quoteId }));
      expect(initRes.ok).toBe(true);
      if (!initRes.ok || !initRes.jobId) throw new Error("initialize");

      // Activate for execution
      const actRes = await jobMutationActivateExecution(officeCtxA, fd({ jobId: initRes.jobId }));
      expect(actRes.ok).toBe(true);

      const jt = await prisma.jobTask.findFirst({
        where: { organizationId: orgAId, jobId: initRes.jobId, title: "Activation gate task" },
      });
      expect(jt?.completionRequirementsJson).toEqual({
        version: 1,
        evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
      });

      await prisma.quoteWorkTemplate.delete({ where: { id: tmpl.id } });
      await prisma.quote.delete({ where: { id: quoteId } });
    });
  });
});
