/**
 * Phase 2 quote server mutations — RBAC, tenant isolation, SENT guards, snapshot integrity.
 * Requires DATABASE_URL (e.g. from `.env`) and PostgreSQL.
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
  QuoteTaskKind,
  QuoteTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { parseValidatedSentQuoteSnapshot } from "@/server/phase2/customer-preview";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import {
  quoteMutationAddAssumption,
  quoteMutationAddLineExecutionStage,
  quoteMutationAddLineItem,
  quoteMutationAddTask,
  quoteMutationCreateDraftFromOpportunity,
  quoteMutationMarkLineRemoved,
  quoteMutationMarkReadyToSend,
  quoteMutationMarkSent,
  quoteMutationRemoveAssumption,
  quoteMutationUpdateAssumption,
  quoteMutationUpdateLineExecutionTask,
  quoteMutationUpdateLineExecutionTaskStatus,
  quoteMutationUpdateLineItem,
  quoteMutationUpdateQuote,
  quoteMutationUpdateTask,
  quoteMutationUpdateTaskStatus,
} from "@/server/phase2/quote-mutations";

config({ path: ".env" });

function fd(map: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(map)) f.set(k, v);
  return f;
}

describe("Phase 2 quote mutations (integration)", () => {
  let orgAId: string;
  let orgBId: string;
  let userSalesAId: string;
  let userMemberAId: string;
  let userSalesBId: string;
  let customerAId: string;
  let opportunityAId: string;
  let opportunityBId: string;
  let salesCtxA: OrgSessionContext;
  let memberCtxA: OrgSessionContext;
  let salesCtxB: OrgSessionContext;
  const suffix = `q2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for integration tests (load from .env).");
    }

    const passwordHash = await bcrypt.hash("phase2-quote-mutations-pass-12", 8);

    const orgA = await prisma.organization.create({
      data: { name: `Org QA ${suffix}`, slug: `org-qa-${suffix}` },
    });
    const orgB = await prisma.organization.create({
      data: { name: `Org QB ${suffix}`, slug: `org-qb-${suffix}` },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userSalesA = await prisma.user.create({
      data: { email: `sales-a-${suffix}@q2.test`, passwordHash, name: "Sales A" },
    });
    const userMemberA = await prisma.user.create({
      data: { email: `member-a-${suffix}@q2.test`, passwordHash, name: "Member A" },
    });
    const userSalesB = await prisma.user.create({
      data: { email: `sales-b-${suffix}@q2.test`, passwordHash, name: "Sales B" },
    });
    userSalesAId = userSalesA.id;
    userMemberAId = userMemberA.id;
    userSalesBId = userSalesB.id;

    await prisma.membership.create({
      data: { userId: userSalesAId, organizationId: orgAId, role: MembershipRole.SALES },
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
      data: { organizationId: orgAId, displayName: `Customer QA ${suffix}` },
    });
    customerAId = customerA.id;

    await prisma.customerContactMethod.create({
      data: {
        customerId: customerAId,
        type: CustomerContactType.EMAIL,
        value: `cust-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const customerB = await prisma.customer.create({
      data: { organizationId: orgBId, displayName: `Customer QB ${suffix}` },
    });
    await prisma.customerContactMethod.create({
      data: {
        customerId: customerB.id,
        type: CustomerContactType.EMAIL,
        value: `cust-b-${suffix}@example.com`,
        isPrimary: true,
      },
    });

    const oppA = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp QA ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Kitchen refresh",
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

    const oppB = await prisma.opportunity.create({
      data: {
        organizationId: orgBId,
        customerId: customerB.id,
        title: `Opp QB ${suffix}`,
        serviceType: "Other",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Work",
      },
    });
    opportunityBId = oppB.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: [userSalesAId, userMemberAId, userSalesBId] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("createQuoteDraftFromOpportunity: sales creates org-scoped quote, opp status + activities", async () => {
    const r = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opportunityAId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcome).toBe("created");
    const q = await prisma.quote.findFirstOrThrow({
      where: { id: r.quoteId, organizationId: orgAId },
      include: { opportunity: true },
    });
    expect(q.customerId).toBe(customerAId);
    expect(q.opportunityId).toBe(opportunityAId);
    expect(q.opportunity.status).toBe(OpportunityStatus.QUOTE_DRAFT_CREATED);

    const quoteActs = await prisma.quoteActivityEvent.findMany({
      where: { organizationId: orgAId, quoteId: r.quoteId },
      orderBy: { createdAt: "asc" },
    });
    expect(quoteActs.some((e) => e.eventType === QuoteActivityEventType.QUOTE_DRAFT_CREATED)).toBe(true);

    const biz = await prisma.opportunityActivityEvent.findMany({
      where: { organizationId: orgAId, opportunityId: opportunityAId },
    });
    expect(biz.some((e) => e.eventType === "QUOTE_DRAFT_CREATED_FROM_OPPORTUNITY")).toBe(true);
  });

  it("createQuoteDraftFromOpportunity: second call returns existing draft, no duplicate quote", async () => {
    const before = await prisma.quote.count({ where: { organizationId: orgAId, opportunityId: opportunityAId } });
    const r = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opportunityAId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.outcome).toBe("existing_draft");
    const after = await prisma.quote.count({ where: { organizationId: orgAId, opportunityId: opportunityAId } });
    expect(after).toBe(before);
  });

  it("createQuoteDraftFromOpportunity: member cannot create", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp member test ${suffix}`,
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
    const r = await quoteMutationCreateDraftFromOpportunity(memberCtxA, opp.id);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/permission/i);
    await prisma.opportunity.delete({ where: { id: opp.id } });
  });

  it("createQuoteDraftFromOpportunity: cross-org opportunity id is rejected", async () => {
    const r = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opportunityBId);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/not found/i);
  });

  it("markQuoteReadyToSend: member role cannot mark ready", async () => {
    const q = await prisma.quote.findFirst({
      where: { organizationId: orgAId, opportunityId: opportunityAId },
      select: { id: true },
    });
    expect(q).toBeTruthy();
    const r = await quoteMutationMarkReadyToSend(memberCtxA, fd({ quoteId: q!.id }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/permission/i);
  });

  it("markQuoteReadyToSend: readiness blockers prevent ready", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp ready block ${suffix}`,
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
    const draft = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;
    const quoteId = draft.quoteId;
    const ready = await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    expect(ready.ok).toBe(false);
    if (ready.ok) return;
    expect(ready.error).toMatch(/readiness|line items|Send readiness/i);
    await prisma.quote.deleteMany({ where: { opportunityId: opp.id } });
    await prisma.opportunity.delete({ where: { id: opp.id } });
  });

  it("markQuoteReadyToSend / markQuoteSent: happy path, snapshot shape, tenant isolation", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp send ${suffix}`,
        serviceType: "Remodel",
        source: "test",
        status: OpportunityStatus.NEW,
        priority: OpportunityPriority.NORMAL,
        serviceAddressTbd: true,
        scopeIntent: "Scope for send test",
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
    const created = await quoteMutationCreateDraftFromOpportunity(salesCtxA, opp.id);
    expect(created.ok).toBe(true);
    if (!created.ok || created.outcome !== "created") return;
    const quoteId = created.quoteId;

    await prisma.quote.update({
      where: { id: quoteId },
      data: { customerFacingIntro: "Hello customer.", internalNotes: "INTERNAL_NOTES_SECRET" },
    });

    const line = await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Cabinets",
        customerDescription: "New cabinets installed",
        quantity: "1",
        unitPriceCents: "5000",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
        internalNotes: "INTERNAL_LINE_SECRET",
      }),
    );
    expect(line.ok).toBe(true);

    await prisma.quoteAssumption.create({
      data: {
        organizationId: orgAId,
        quoteId,
        visibility: QuoteAssumptionVisibility.INTERNAL_ONLY,
        text: "SECRET_ASSUMPTION",
        sortOrder: 0,
      },
    });
    await prisma.quoteAssumption.create({
      data: {
        organizationId: orgAId,
        quoteId,
        visibility: QuoteAssumptionVisibility.CUSTOMER_VISIBLE,
        text: "Visible terms text",
        sortOrder: 1,
      },
    });

    await prisma.quoteTask.create({
      data: {
        organizationId: orgAId,
        quoteId,
        kind: QuoteTaskKind.QUOTE_PREP,
        title: "PREP_SECRET_TITLE",
        status: QuoteTaskStatus.NOT_READY,
        isRequired: false,
        sortOrder: 0,
        customerVisible: false,
      },
    });
    const lineRow = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const execStage = await prisma.quoteLineExecutionStage.create({
      data: {
        organizationId: orgAId,
        quoteLineItemId: lineRow.id,
        title: "Permitting",
        sortOrder: 0,
      },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: execStage.id,
        title: "Plan permit",
        status: QuoteTaskStatus.NOT_READY,
        isRequired: false,
        sortOrder: 0,
        customerVisible: true,
        customerLabel: "Permitting",
      },
    });

    const ready = await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    expect(ready.ok).toBe(true);

    const sent = await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    expect(sent.ok).toBe(true);

    const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row.status).toBe(QuoteStatus.SENT);
    expect(row.sentAt).toBeTruthy();
    const snap = parseValidatedSentQuoteSnapshot(row.sentSnapshotJson);
    expect(snap).toBeTruthy();
    if (!snap) return;
    expect(snap.version).toBe(2);
    expect("internalExecutionPlan" in snap).toBe(true);
    if (snap.version !== 2) return;
    expect(snap.preview.lineItems.length).toBe(1);
    expect(snap.preview.lineItems[0]?.title).toBe("Cabinets");
    expect(snap.preview.lineItems[0]?.customerVisibleExecutionHighlights?.map((h) => h.label)).toContain("Permitting");
    const frozenLine = snap.internalExecutionPlan.lines.find((l) => l.quoteLineItemId === lineRow.id);
    expect(frozenLine?.title).toBe("Cabinets");
    expect(frozenLine?.stages.length).toBeGreaterThanOrEqual(1);
    const frozenTask = frozenLine?.stages[0]?.tasks.find((t) => t.customerLabel === "Permitting");
    expect(frozenTask?.title).toMatch(/permit/i);
    expect(snap.preview.customerVisibleQuoteAssumptions.join(" ")).toContain("Visible terms");
    const snapStr = JSON.stringify(snap);
    expect(snapStr).not.toMatch(/INTERNAL_NOTES_SECRET|INTERNAL_LINE_SECRET|SECRET_ASSUMPTION|PREP_SECRET_TITLE/);
    expect(snapStr).not.toMatch(/readiness|activity|QUOTE_PREP/i);

    const again = await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toMatch(/already sent/i);

    const crossReady = await quoteMutationMarkReadyToSend(salesCtxB, fd({ quoteId }));
    expect(crossReady.ok).toBe(false);

    const crossSent = await quoteMutationMarkSent(salesCtxB, fd({ quoteId }));
    expect(crossSent.ok).toBe(false);

    const snapshotBefore = JSON.stringify(row.sentSnapshotJson);
    const upd = await quoteMutationUpdateQuote(
      salesCtxA,
      fd({
        quoteId,
        internalNotes: "Updated internal only",
      }),
    );
    expect(upd.ok).toBe(true);
    const row2 = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(row2.internalNotes).toContain("Updated internal");
    expect(JSON.stringify(row2.sentSnapshotJson)).toBe(snapshotBefore);

    await prisma.quote.deleteMany({ where: { opportunityId: opp.id } });
    await prisma.opportunity.delete({ where: { id: opp.id } });
  });

  it("markQuoteLineRemoved deletes execution stages and tasks for the line", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp line rm exec ${suffix}`,
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
    if (!c.ok || c.outcome !== "created") return;
    const quoteId = c.quoteId;

    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Line to remove",
        customerDescription: "Desc",
        quantity: "1",
        unitPriceCents: "100",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    const li = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const st = await prisma.quoteLineExecutionStage.create({
      data: { organizationId: orgAId, quoteLineItemId: li.id, title: "Stage", sortOrder: 0 },
    });
    await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: st.id,
        title: "Task",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
      },
    });

    const rm = await quoteMutationMarkLineRemoved(salesCtxA, fd({ quoteId, lineItemId: li.id }));
    expect(rm.ok).toBe(true);

    const stages = await prisma.quoteLineExecutionStage.count({ where: { quoteLineItemId: li.id } });
    const tasks = await prisma.quoteLineExecutionTask.count({ where: { stageId: st.id } });
    expect(stages).toBe(0);
    expect(tasks).toBe(0);

    const line = await prisma.quoteLineItem.findUniqueOrThrow({ where: { id: li.id } });
    expect(line.lineMode).toBe(QuoteLineMode.REMOVED);

    await prisma.quote.deleteMany({ where: { opportunityId: opp.id } });
    await prisma.opportunity.delete({ where: { id: opp.id } });
  });

  it("SENT edit guards: structural mutations denied server-side", async () => {
    const opp = await prisma.opportunity.create({
      data: {
        organizationId: orgAId,
        customerId: customerAId,
        title: `Opp sent guard ${suffix}`,
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
    if (!c.ok || c.outcome !== "created") return;
    const quoteId = c.quoteId;

    await prisma.quote.update({
      where: { id: quoteId },
      data: { customerFacingIntro: "Intro" },
    });
    await quoteMutationAddLineItem(
      salesCtxA,
      fd({
        quoteId,
        title: "Line",
        customerDescription: "Desc",
        quantity: "1",
        unitPriceCents: "100",
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      }),
    );
    await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId }));
    await quoteMutationMarkSent(salesCtxA, fd({ quoteId }));

    const li = await prisma.quoteLineItem.findFirstOrThrow({ where: { quoteId } });
    const prepTask = await prisma.quoteTask.create({
      data: {
        organizationId: orgAId,
        quoteId,
        kind: QuoteTaskKind.QUOTE_PREP,
        title: "T",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
      },
    });
    const execSt = await prisma.quoteLineExecutionStage.create({
      data: {
        organizationId: orgAId,
        quoteLineItemId: li.id,
        title: "Stage",
        sortOrder: 0,
      },
    });
    const execTask = await prisma.quoteLineExecutionTask.create({
      data: {
        organizationId: orgAId,
        stageId: execSt.id,
        title: "Exec",
        status: QuoteTaskStatus.NOT_READY,
        sortOrder: 0,
      },
    });
    const asm = await prisma.quoteAssumption.create({
      data: {
        organizationId: orgAId,
        quoteId,
        visibility: QuoteAssumptionVisibility.CUSTOMER_VISIBLE,
        text: "A",
        sortOrder: 0,
      },
    });

    const deny = (msg: string, r: { ok: boolean; error?: string }) => {
      expect(r.ok, msg).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/sent|cannot be edited/i);
    };

    deny(
      "add line",
      await quoteMutationAddLineItem(
        salesCtxA,
        fd({
          quoteId,
          title: "X",
          customerDescription: "Y",
          quantity: "1",
          unitPriceCents: "1",
          pricingMode: PricingMode.FIXED_PRICE,
          lineMode: QuoteLineMode.REQUIRED,
        }),
      ),
    );

    deny(
      "update line",
      await quoteMutationUpdateLineItem(
        salesCtxA,
        fd({
          quoteId,
          lineItemId: li.id,
          title: "Hacked",
          customerDescription: li.customerDescription,
          quantity: "1",
          unitPriceCents: String(li.unitPriceCents ?? ""),
          pricingMode: li.pricingMode,
          lineMode: li.lineMode,
        }),
      ),
    );

    deny(
      "remove line",
      await quoteMutationMarkLineRemoved(salesCtxA, fd({ quoteId, lineItemId: li.id })),
    );

    deny(
      "add quote-prep task",
      await quoteMutationAddTask(
        salesCtxA,
        fd({
          quoteId,
          title: "New",
          isRequired: "false",
          customerVisible: "false",
        }),
      ),
    );

    deny(
      "add line execution stage",
      await quoteMutationAddLineExecutionStage(
        salesCtxA,
        fd({ quoteId, lineItemId: li.id, title: "Blocked stage" }),
      ),
    );

    deny(
      "update quote-prep task",
      await quoteMutationUpdateTask(
        salesCtxA,
        fd({
          quoteId,
          taskId: prepTask.id,
          title: "Hacked",
          isRequired: "false",
          customerVisible: "false",
        }),
      ),
    );

    deny(
      "quote-prep task status",
      await quoteMutationUpdateTaskStatus(
        salesCtxA,
        fd({ quoteId, taskId: prepTask.id, status: QuoteTaskStatus.COMPLETE }),
      ),
    );

    deny(
      "update line execution task",
      await quoteMutationUpdateLineExecutionTask(
        salesCtxA,
        fd({
          quoteId,
          stageId: execSt.id,
          taskId: execTask.id,
          title: "Hacked",
          isRequired: "false",
          customerVisible: "false",
        }),
      ),
    );

    deny(
      "line execution task status",
      await quoteMutationUpdateLineExecutionTaskStatus(
        salesCtxA,
        fd({ quoteId, taskId: execTask.id, status: QuoteTaskStatus.COMPLETE }),
      ),
    );

    deny(
      "add assumption",
      await quoteMutationAddAssumption(
        salesCtxA,
        fd({
          quoteId,
          visibility: QuoteAssumptionVisibility.CUSTOMER_VISIBLE,
          text: "N",
        }),
      ),
    );

    deny(
      "update assumption",
      await quoteMutationUpdateAssumption(
        salesCtxA,
        fd({
          quoteId,
          assumptionId: asm.id,
          visibility: QuoteAssumptionVisibility.CUSTOMER_VISIBLE,
          text: "H",
        }),
      ),
    );

    deny(
      "remove assumption",
      await quoteMutationRemoveAssumption(salesCtxA, fd({ quoteId, assumptionId: asm.id })),
    );

    deny("mark ready again", await quoteMutationMarkReadyToSend(salesCtxA, fd({ quoteId })));

    await prisma.quote.deleteMany({ where: { opportunityId: opp.id } });
    await prisma.opportunity.delete({ where: { id: opp.id } });
  });
});
