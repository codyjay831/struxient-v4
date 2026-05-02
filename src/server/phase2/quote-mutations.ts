/**
 * Phase 2 quote mutations: org-scoped, RBAC-checked server logic shared by server actions and tests.
 * Do not import from client components.
 */
import {
  OpportunityStatus,
  Prisma,
  PricingMode,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskKind,
  QuoteTaskStatus,
} from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { ActivityEventType } from "@/server/phase1/activity-events";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { recordBusinessActivity } from "@/server/phase1/record-activity";
import { activeContactMethods, allQuoteDraftBlockersPass, computeQuoteDraftReadiness } from "@/server/phase1/readiness";
import {
  buildInternalExecutionPlanFromLineItems,
  buildQuoteCustomerPreviewDTO,
  parseValidatedSentQuoteSnapshot,
} from "@/server/phase2/customer-preview";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import {
  findActiveDraftQuoteForOpportunity,
  getQuoteReadinessBundle,
  getQuoteWorkspace,
  nextQuoteDisplayNumber,
} from "@/server/phase2/quote-queries";
import { allQuoteSendBlockersPass, evaluateQuoteSendReadiness } from "@/server/phase2/quote-readiness";
import { recalculateQuoteTotals } from "@/server/phase2/recalculate-quote-totals";
import { recordQuoteActivity } from "@/server/phase2/record-quote-activity";
import {
  addQuoteAssumptionSchema,
  addQuoteLineExecutionStageSchema,
  addQuoteLineExecutionTaskSchema,
  addQuoteLineItemSchema,
  addQuoteTaskSchema,
  logQuotePreviewedSchema,
  markQuoteLifecycleSchema,
  markQuoteLineRemovedSchema,
  parsePositiveQuantity,
  removeQuoteAssumptionSchema,
  removeQuoteLineExecutionStageSchema,
  updateQuoteAssumptionSchema,
  updateQuoteDraftSchema,
  updateQuoteInternalNotesSchema,
  updateQuoteLineExecutionStageSchema,
  updateQuoteLineExecutionTaskSchema,
  updateQuoteLineExecutionTaskStatusSchema,
  updateQuoteLineItemSchema,
  updateQuoteTaskSchema,
  updateQuoteTaskStatusSchema,
} from "@/server/phase2/validation";

export type QuoteActionResult =
  | { ok: true; quoteId?: string; opportunityId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function zodActionFailure(error: ZodError): { error: string; fieldErrors: Record<string, string[]> } {
  return {
    error: error.issues[0]?.message ?? "Invalid input",
    fieldErrors: error.flatten().fieldErrors as unknown as Record<string, string[]>,
  };
}

async function assertMembershipInOrg(organizationId: string, userId: string | null | undefined) {
  if (!userId) return true;
  const m = await prisma.membership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  return Boolean(m);
}

export type CreateQuoteDraftMutationResult =
  | { ok: true; outcome: "created"; quoteId: string; opportunityId: string; customerId: string }
  | { ok: true; outcome: "existing_draft"; quoteId: string }
  | { ok: false; error: string };

export async function quoteMutationCreateDraftFromOpportunity(
  ctx: OrgSessionContext,
  opportunityId: string,
): Promise<CreateQuoteDraftMutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission to create quotes." };
  }

  const existing = await findActiveDraftQuoteForOpportunity(ctx.organizationId, opportunityId);
  if (existing) {
    return { ok: true, outcome: "existing_draft", quoteId: existing.id };
  }

  const opp = await prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId: ctx.organizationId },
    include: {
      customer: { include: { contactMethods: { where: { archivedAt: null } } } },
      tasks: true,
    },
  });
  if (!opp) {
    return { ok: false, error: "Opportunity not found." };
  }
  if (
    opp.status === OpportunityStatus.LOST ||
    opp.status === OpportunityStatus.NO_QUOTE ||
    opp.status === OpportunityStatus.ARCHIVED
  ) {
    return { ok: false, error: "Quotes cannot be created from a closed opportunity." };
  }

  const readiness = computeQuoteDraftReadiness({
    opportunity: opp,
    activeContactCount: activeContactMethods(opp.customer.contactMethods),
    tasks: opp.tasks,
  });
  if (!allQuoteDraftBlockersPass(readiness)) {
    const first = readiness.find((r) => r.status === "FAIL");
    return {
      ok: false,
      error: first
        ? `Intake is not ready to create a quote: ${first.explanation}`
        : "Intake is not ready to create a quote.",
    };
  }

  const quote = await prisma.$transaction(async (tx) => {
    const displayNumber = await nextQuoteDisplayNumber(ctx.organizationId, tx);
    const q = await tx.quote.create({
      data: {
        organizationId: ctx.organizationId,
        customerId: opp.customerId,
        opportunityId: opp.id,
        displayNumber,
        status: QuoteStatus.DRAFT,
        title: opp.title,
        serviceAddressText: opp.serviceAddressText,
        serviceAddressTbd: opp.serviceAddressTbd,
        scopeIntent: opp.scopeIntent,
        scopeSummary: null,
        customerFacingIntro: null,
        internalNotes: null,
        createdById: ctx.userId,
        ownerUserId: opp.salesOwnerUserId,
      },
    });

    await recordQuoteActivity(tx, {
      organizationId: ctx.organizationId,
      quoteId: q.id,
      opportunityId: q.opportunityId,
      customerId: q.customerId,
      actorUserId: ctx.userId,
      eventType: QuoteActivityEventType.QUOTE_DRAFT_CREATED,
      summary: `Quote #${q.displayNumber} draft created`,
      payload: { quoteId: q.id, opportunityId: q.opportunityId },
    });

    await recordBusinessActivity(tx, {
      organizationId: ctx.organizationId,
      opportunityId: opp.id,
      customerId: opp.customerId,
      eventType: ActivityEventType.QUOTE_DRAFT_CREATED_FROM_OPPORTUNITY,
      actorUserId: ctx.userId,
      summary: `Quote draft #${displayNumber} created from this opportunity`,
      payload: { quoteId: q.id },
    });

    await tx.opportunity.update({
      where: { id: opp.id },
      data: { status: OpportunityStatus.QUOTE_DRAFT_CREATED },
    });

    return q;
  });

  return {
    ok: true,
    outcome: "created",
    quoteId: quote.id,
    opportunityId: opp.id,
    customerId: opp.customerId,
  };
}

export async function quoteMutationUpdateQuote(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission to edit quotes." };
  }

  const quoteId = String(formData.get("quoteId") ?? "");
  const existing = await prisma.quote.findFirst({
    where: { id: quoteId, organizationId: ctx.organizationId },
  });
  if (!existing) {
    return { ok: false, error: "Quote not found." };
  }

  if (existing.status === QuoteStatus.SENT) {
    const parsed = updateQuoteInternalNotesSchema.safeParse({
      quoteId: formData.get("quoteId"),
      internalNotes: formData.get("internalNotes"),
    });
    if (!parsed.success) {
      return { ok: false, ...zodActionFailure(parsed.error) };
    }
    await prisma.quote.update({
      where: { id: existing.id },
      data: { internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null },
    });
    await recordQuoteActivity(prisma, {
      organizationId: ctx.organizationId,
      quoteId: existing.id,
      opportunityId: existing.opportunityId,
      customerId: existing.customerId,
      actorUserId: ctx.userId,
      eventType: QuoteActivityEventType.QUOTE_UPDATED,
      summary: "Internal notes updated (sent quote)",
      payload: { quoteId: existing.id },
    });
    return { ok: true, quoteId: existing.id };
  }

  const parsed = updateQuoteDraftSchema.safeParse({
    quoteId: formData.get("quoteId"),
    title: formData.get("title"),
    serviceAddressText: formData.get("serviceAddressText") || null,
    serviceAddressTbd: formData.get("serviceAddressTbd") === "on" || formData.get("serviceAddressTbd") === "true",
    scopeIntent: formData.get("scopeIntent"),
    scopeSummary: formData.get("scopeSummary") || null,
    customerFacingIntro: formData.get("customerFacingIntro") || null,
    internalNotes: formData.get("internalNotes") || null,
    status: formData.get("status") || undefined,
    ownerUserId: formData.get("ownerUserId") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const ownerId = parsed.data.ownerUserId?.trim() || null;
  if (ownerId && !(await assertMembershipInOrg(ctx.organizationId, ownerId))) {
    return { ok: false, error: "Owner must be a member of this organization.", fieldErrors: { ownerUserId: ["Invalid"] } };
  }

  await prisma.quote.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      serviceAddressText: parsed.data.serviceAddressText?.trim() ? parsed.data.serviceAddressText : null,
      serviceAddressTbd: parsed.data.serviceAddressTbd,
      scopeIntent: parsed.data.scopeIntent,
      scopeSummary: parsed.data.scopeSummary?.trim() ? parsed.data.scopeSummary : null,
      customerFacingIntro: parsed.data.customerFacingIntro?.trim() ? parsed.data.customerFacingIntro : null,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
      status: parsed.data.status ?? undefined,
      ownerUserId: ownerId,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: existing.id,
    opportunityId: existing.opportunityId,
    customerId: existing.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_UPDATED,
    summary: "Quote updated",
    payload: { quoteId: existing.id },
  });

  return { ok: true, quoteId: existing.id };
}

export async function quoteMutationAddLineItem(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = addQuoteLineItemSchema.safeParse({
    quoteId: formData.get("quoteId"),
    title: formData.get("title"),
    customerDescription: formData.get("customerDescription"),
    quantity: formData.get("quantity"),
    unitPriceCents: formData.get("unitPriceCents") || null,
    pricingMode: formData.get("pricingMode"),
    lineMode: formData.get("lineMode"),
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const qty = parsePositiveQuantity(parsed.data.quantity);
  if (!qty.ok) {
    return { ok: false, error: qty.message, fieldErrors: { quantity: [qty.message] } };
  }

  const maxSort = await prisma.quoteLineItem.aggregate({
    where: { quoteId: quote.id, organizationId: ctx.organizationId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const unit = parsed.data.unitPriceCents ?? null;
  const qtyDec = new Prisma.Decimal(qty.value);
  const lineTotalCents =
    parsed.data.pricingMode === PricingMode.FIXED_PRICE && unit != null
      ? Math.round(Number(qtyDec) * unit)
      : null;

  const line = await prisma.quoteLineItem.create({
    data: {
      organizationId: ctx.organizationId,
      quoteId: quote.id,
      title: parsed.data.title,
      customerDescription: parsed.data.customerDescription,
      quantity: qtyDec,
      unitPriceCents: unit,
      lineTotalCents,
      pricingMode: parsed.data.pricingMode,
      lineMode: parsed.data.lineMode,
      sortOrder,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await prisma.$transaction(async (tx) => {
    await recalculateQuoteTotals(tx, ctx.organizationId, quote.id);
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_ADDED,
    summary: `Line added: ${line.title}`,
    payload: { lineItemId: line.id },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationUpdateLineItem(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteLineItemSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
    title: formData.get("title"),
    customerDescription: formData.get("customerDescription"),
    quantity: formData.get("quantity"),
    unitPriceCents: formData.get("unitPriceCents") || null,
    pricingMode: formData.get("pricingMode"),
    lineMode: formData.get("lineMode"),
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const line = await prisma.quoteLineItem.findFirst({
    where: {
      id: parsed.data.lineItemId,
      quoteId: parsed.data.quoteId,
      organizationId: ctx.organizationId,
    },
    include: { quote: true },
  });
  if (!line) return { ok: false, error: "Line item not found." };
  if (line.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const qty = parsePositiveQuantity(parsed.data.quantity);
  if (!qty.ok) {
    return { ok: false, error: qty.message, fieldErrors: { quantity: [qty.message] } };
  }

  const unit = parsed.data.unitPriceCents ?? null;
  const qtyDec = new Prisma.Decimal(qty.value);
  const lineTotalCents =
    parsed.data.pricingMode === PricingMode.FIXED_PRICE && unit != null
      ? Math.round(Number(qtyDec) * unit)
      : null;

  await prisma.quoteLineItem.update({
    where: { id: line.id },
    data: {
      title: parsed.data.title,
      customerDescription: parsed.data.customerDescription,
      quantity: qtyDec,
      unitPriceCents: unit,
      lineTotalCents,
      pricingMode: parsed.data.pricingMode,
      lineMode: parsed.data.lineMode,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await prisma.$transaction(async (tx) => {
    await recalculateQuoteTotals(tx, ctx.organizationId, line.quoteId);
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: line.quoteId,
    opportunityId: line.quote.opportunityId,
    customerId: line.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_UPDATED,
    summary: `Line updated: ${parsed.data.title}`,
    payload: { lineItemId: line.id },
  });

  return { ok: true, quoteId: line.quoteId };
}

export async function quoteMutationMarkLineRemoved(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = markQuoteLineRemovedSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const line = await prisma.quoteLineItem.findFirst({
    where: {
      id: parsed.data.lineItemId,
      quoteId: parsed.data.quoteId,
      organizationId: ctx.organizationId,
    },
    include: { quote: true },
  });
  if (!line) return { ok: false, error: "Line item not found." };
  if (line.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.quoteLineExecutionStage.deleteMany({
      where: { quoteLineItemId: line.id, organizationId: ctx.organizationId },
    });
    await tx.quoteLineItem.update({
      where: { id: line.id },
      data: { lineMode: QuoteLineMode.REMOVED },
    });
    await recalculateQuoteTotals(tx, ctx.organizationId, line.quoteId);
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: line.quoteId,
    opportunityId: line.quote.opportunityId,
    customerId: line.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_REMOVED,
    summary: `Line removed from proposal: ${line.title}`,
    payload: { lineItemId: line.id },
  });

  return { ok: true, quoteId: line.quoteId };
}

export async function quoteMutationAddTask(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = addQuoteTaskSchema.safeParse({
    quoteId: formData.get("quoteId"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    assignedRole: formData.get("assignedRole") || null,
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes") || null,
    customerVisible: formData.get("customerVisible") === "on" || formData.get("customerVisible") === "true",
    customerLabel: formData.get("customerLabel") || null,
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const maxSort = await prisma.quoteTask.aggregate({
    where: { quoteId: quote.id, organizationId: ctx.organizationId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const task = await prisma.quoteTask.create({
    data: {
      organizationId: ctx.organizationId,
      quoteId: quote.id,
      kind: QuoteTaskKind.QUOTE_PREP,
      title: parsed.data.title,
      description: parsed.data.description?.trim() ? parsed.data.description : null,
      isRequired: Boolean(parsed.data.isRequired),
      sortOrder,
      assignedRole: parsed.data.assignedRole?.trim() ? parsed.data.assignedRole : null,
      estimatedDurationMinutes: parsed.data.estimatedDurationMinutes ?? null,
      customerVisible: Boolean(parsed.data.customerVisible),
      customerLabel: parsed.data.customerLabel?.trim() ? parsed.data.customerLabel : null,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_TASK_ADDED,
    summary: `Quote-prep task added: ${task.title}`,
    payload: { taskId: task.id, kind: QuoteTaskKind.QUOTE_PREP },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationUpdateTask(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteTaskSchema.safeParse({
    quoteId: formData.get("quoteId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    assignedRole: formData.get("assignedRole") || null,
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes") || null,
    customerVisible: formData.get("customerVisible") === "on" || formData.get("customerVisible") === "true",
    customerLabel: formData.get("customerLabel") || null,
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.quoteTask.findFirst({
    where: { id: parsed.data.taskId, quoteId: parsed.data.quoteId, organizationId: ctx.organizationId },
    include: { quote: true },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  await prisma.quoteTask.update({
    where: { id: task.id },
    data: {
      kind: QuoteTaskKind.QUOTE_PREP,
      title: parsed.data.title,
      description: parsed.data.description?.trim() ? parsed.data.description : null,
      isRequired: Boolean(parsed.data.isRequired),
      assignedRole: parsed.data.assignedRole?.trim() ? parsed.data.assignedRole : null,
      estimatedDurationMinutes: parsed.data.estimatedDurationMinutes ?? null,
      customerVisible: Boolean(parsed.data.customerVisible),
      customerLabel: parsed.data.customerLabel?.trim() ? parsed.data.customerLabel : null,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: task.quoteId,
    opportunityId: task.quote.opportunityId,
    customerId: task.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_TASK_UPDATED,
    summary: `Task updated: ${parsed.data.title}`,
    payload: { taskId: task.id },
  });

  return { ok: true, quoteId: task.quoteId };
}

export async function quoteMutationUpdateTaskStatus(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteTaskStatusSchema.safeParse({
    quoteId: formData.get("quoteId"),
    taskId: formData.get("taskId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.quoteTask.findFirst({
    where: { id: parsed.data.taskId, quoteId: parsed.data.quoteId, organizationId: ctx.organizationId },
    include: { quote: true },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const prev = task.status;
  const next = parsed.data.status;

  await prisma.quoteTask.update({
    where: { id: task.id },
    data: { status: next },
  });

  const completedNow = next === QuoteTaskStatus.COMPLETE && prev !== QuoteTaskStatus.COMPLETE;

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: task.quoteId,
    opportunityId: task.quote.opportunityId,
    customerId: task.quote.customerId,
    actorUserId: ctx.userId,
    eventType: completedNow ? QuoteActivityEventType.QUOTE_TASK_COMPLETED : QuoteActivityEventType.QUOTE_TASK_UPDATED,
    summary: completedNow ? `Task completed: ${task.title}` : `Task status updated: ${task.title}`,
    payload: { taskId: task.id, status: next },
  });

  return { ok: true, quoteId: task.quoteId };
}

export async function quoteMutationAddLineExecutionStage(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = addQuoteLineExecutionStageSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
    title: formData.get("title"),
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const line = await prisma.quoteLineItem.findFirst({
    where: {
      id: parsed.data.lineItemId,
      quoteId: parsed.data.quoteId,
      organizationId: ctx.organizationId,
    },
    include: { quote: true },
  });
  if (!line) return { ok: false, error: "Line item not found." };
  if (line.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const maxSort = await prisma.quoteLineExecutionStage.aggregate({
    where: { quoteLineItemId: line.id, organizationId: ctx.organizationId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const stage = await prisma.quoteLineExecutionStage.create({
    data: {
      organizationId: ctx.organizationId,
      quoteLineItemId: line.id,
      title: parsed.data.title,
      sortOrder,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: line.quoteId,
    opportunityId: line.quote.opportunityId,
    customerId: line.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_EXECUTION_STAGE_ADDED,
    summary: `Execution stage added on line: ${stage.title}`,
    payload: { stageId: stage.id, lineItemId: line.id },
  });

  return { ok: true, quoteId: line.quoteId };
}

export async function quoteMutationUpdateLineExecutionStage(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteLineExecutionStageSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
    stageId: formData.get("stageId"),
    title: formData.get("title"),
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const stage = await prisma.quoteLineExecutionStage.findFirst({
    where: {
      id: parsed.data.stageId,
      organizationId: ctx.organizationId,
      quoteLineItemId: parsed.data.lineItemId,
    },
    include: { quoteLineItem: { include: { quote: true } } },
  });
  if (!stage) return { ok: false, error: "Stage not found." };
  if (stage.quoteLineItem.quoteId !== parsed.data.quoteId) {
    return { ok: false, error: "Stage not found." };
  }
  if (stage.quoteLineItem.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  await prisma.quoteLineExecutionStage.update({
    where: { id: stage.id },
    data: {
      title: parsed.data.title,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: stage.quoteLineItem.quoteId,
    opportunityId: stage.quoteLineItem.quote.opportunityId,
    customerId: stage.quoteLineItem.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_EXECUTION_STAGE_UPDATED,
    summary: `Execution stage updated: ${parsed.data.title}`,
    payload: { stageId: stage.id, lineItemId: stage.quoteLineItemId },
  });

  return { ok: true, quoteId: stage.quoteLineItem.quoteId };
}

export async function quoteMutationRemoveLineExecutionStage(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = removeQuoteLineExecutionStageSchema.safeParse({
    quoteId: formData.get("quoteId"),
    stageId: formData.get("stageId"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const stage = await prisma.quoteLineExecutionStage.findFirst({
    where: { id: parsed.data.stageId, organizationId: ctx.organizationId },
    include: { quoteLineItem: { include: { quote: true } } },
  });
  if (!stage || stage.quoteLineItem.quoteId !== parsed.data.quoteId) {
    return { ok: false, error: "Stage not found." };
  }
  if (stage.quoteLineItem.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const quoteId = stage.quoteLineItem.quoteId;
  await prisma.quoteLineExecutionStage.delete({ where: { id: stage.id } });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId,
    opportunityId: stage.quoteLineItem.quote.opportunityId,
    customerId: stage.quoteLineItem.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_EXECUTION_STAGE_REMOVED,
    summary: "Execution stage removed",
    payload: { stageId: parsed.data.stageId, lineItemId: stage.quoteLineItemId },
  });

  return { ok: true, quoteId };
}

export async function quoteMutationAddLineExecutionTask(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = addQuoteLineExecutionTaskSchema.safeParse({
    quoteId: formData.get("quoteId"),
    stageId: formData.get("stageId"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    assignedRole: formData.get("assignedRole") || null,
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes") || null,
    customerVisible: formData.get("customerVisible") === "on" || formData.get("customerVisible") === "true",
    customerLabel: formData.get("customerLabel") || null,
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const stage = await prisma.quoteLineExecutionStage.findFirst({
    where: { id: parsed.data.stageId, organizationId: ctx.organizationId },
    include: { quoteLineItem: { include: { quote: true } } },
  });
  if (!stage || stage.quoteLineItem.quoteId !== parsed.data.quoteId) {
    return { ok: false, error: "Stage not found." };
  }
  if (stage.quoteLineItem.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const maxSort = await prisma.quoteLineExecutionTask.aggregate({
    where: { stageId: stage.id, organizationId: ctx.organizationId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const task = await prisma.quoteLineExecutionTask.create({
    data: {
      organizationId: ctx.organizationId,
      stageId: stage.id,
      title: parsed.data.title,
      description: parsed.data.description?.trim() ? parsed.data.description : null,
      isRequired: Boolean(parsed.data.isRequired),
      sortOrder,
      assignedRole: parsed.data.assignedRole?.trim() ? parsed.data.assignedRole : null,
      estimatedDurationMinutes: parsed.data.estimatedDurationMinutes ?? null,
      customerVisible: Boolean(parsed.data.customerVisible),
      customerLabel: parsed.data.customerLabel?.trim() ? parsed.data.customerLabel : null,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: stage.quoteLineItem.quoteId,
    opportunityId: stage.quoteLineItem.quote.opportunityId,
    customerId: stage.quoteLineItem.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_EXECUTION_TASK_ADDED,
    summary: `Line execution task added: ${task.title}`,
    payload: { taskId: task.id, stageId: stage.id, lineItemId: stage.quoteLineItemId },
  });

  return { ok: true, quoteId: stage.quoteLineItem.quoteId };
}

export async function quoteMutationUpdateLineExecutionTask(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteLineExecutionTaskSchema.safeParse({
    quoteId: formData.get("quoteId"),
    stageId: formData.get("stageId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || null,
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    assignedRole: formData.get("assignedRole") || null,
    estimatedDurationMinutes: formData.get("estimatedDurationMinutes") || null,
    customerVisible: formData.get("customerVisible") === "on" || formData.get("customerVisible") === "true",
    customerLabel: formData.get("customerLabel") || null,
    internalNotes: formData.get("internalNotes") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.quoteLineExecutionTask.findFirst({
    where: { id: parsed.data.taskId, organizationId: ctx.organizationId, stageId: parsed.data.stageId },
    include: { stage: { include: { quoteLineItem: { include: { quote: true } } } } },
  });
  if (!task || task.stage.quoteLineItem.quoteId !== parsed.data.quoteId) {
    return { ok: false, error: "Task not found." };
  }
  if (task.stage.quoteLineItem.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  await prisma.quoteLineExecutionTask.update({
    where: { id: task.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description?.trim() ? parsed.data.description : null,
      isRequired: Boolean(parsed.data.isRequired),
      assignedRole: parsed.data.assignedRole?.trim() ? parsed.data.assignedRole : null,
      estimatedDurationMinutes: parsed.data.estimatedDurationMinutes ?? null,
      customerVisible: Boolean(parsed.data.customerVisible),
      customerLabel: parsed.data.customerLabel?.trim() ? parsed.data.customerLabel : null,
      internalNotes: parsed.data.internalNotes?.trim() ? parsed.data.internalNotes : null,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: task.stage.quoteLineItem.quoteId,
    opportunityId: task.stage.quoteLineItem.quote.opportunityId,
    customerId: task.stage.quoteLineItem.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_LINE_EXECUTION_TASK_UPDATED,
    summary: `Line execution task updated: ${parsed.data.title}`,
    payload: { taskId: task.id, stageId: task.stageId, lineItemId: task.stage.quoteLineItemId },
  });

  return { ok: true, quoteId: task.stage.quoteLineItem.quoteId };
}

export async function quoteMutationUpdateLineExecutionTaskStatus(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteLineExecutionTaskStatusSchema.safeParse({
    quoteId: formData.get("quoteId"),
    taskId: formData.get("taskId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const task = await prisma.quoteLineExecutionTask.findFirst({
    where: { id: parsed.data.taskId, organizationId: ctx.organizationId },
    include: { stage: { include: { quoteLineItem: { include: { quote: true } } } } },
  });
  if (!task || task.stage.quoteLineItem.quoteId !== parsed.data.quoteId) {
    return { ok: false, error: "Task not found." };
  }
  if (task.stage.quoteLineItem.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const prev = task.status;
  const next = parsed.data.status;
  await prisma.quoteLineExecutionTask.update({
    where: { id: task.id },
    data: { status: next },
  });

  const completedNow = next === QuoteTaskStatus.COMPLETE && prev !== QuoteTaskStatus.COMPLETE;

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: task.stage.quoteLineItem.quoteId,
    opportunityId: task.stage.quoteLineItem.quote.opportunityId,
    customerId: task.stage.quoteLineItem.quote.customerId,
    actorUserId: ctx.userId,
    eventType: completedNow
      ? QuoteActivityEventType.QUOTE_LINE_EXECUTION_TASK_COMPLETED
      : QuoteActivityEventType.QUOTE_LINE_EXECUTION_TASK_UPDATED,
    summary: completedNow ? `Line execution task completed: ${task.title}` : `Line execution task status updated: ${task.title}`,
    payload: { taskId: task.id, status: next, stageId: task.stageId, lineItemId: task.stage.quoteLineItemId },
  });

  return { ok: true, quoteId: task.stage.quoteLineItem.quoteId };
}

export async function quoteMutationAddAssumption(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = addQuoteAssumptionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    quoteLineItemId: formData.get("quoteLineItemId") || null,
    visibility: formData.get("visibility"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const lineId = parsed.data.quoteLineItemId?.trim() || null;
  if (lineId) {
    const li = await prisma.quoteLineItem.findFirst({
      where: { id: lineId, quoteId: quote.id, organizationId: ctx.organizationId },
    });
    if (!li) return { ok: false, error: "Line item not found." };
  }

  const maxSort = await prisma.quoteAssumption.aggregate({
    where: { quoteId: quote.id, organizationId: ctx.organizationId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const row = await prisma.quoteAssumption.create({
    data: {
      organizationId: ctx.organizationId,
      quoteId: quote.id,
      quoteLineItemId: lineId,
      visibility: parsed.data.visibility,
      text: parsed.data.text,
      sortOrder,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_ASSUMPTION_ADDED,
    summary: "Assumption added",
    payload: { assumptionId: row.id },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationUpdateAssumption(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = updateQuoteAssumptionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    assumptionId: formData.get("assumptionId"),
    quoteLineItemId: formData.get("quoteLineItemId") || null,
    visibility: formData.get("visibility"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const row = await prisma.quoteAssumption.findFirst({
    where: {
      id: parsed.data.assumptionId,
      quoteId: parsed.data.quoteId,
      organizationId: ctx.organizationId,
    },
    include: { quote: true },
  });
  if (!row) return { ok: false, error: "Assumption not found." };
  if (row.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  const lineId = parsed.data.quoteLineItemId?.trim() || null;
  if (lineId) {
    const li = await prisma.quoteLineItem.findFirst({
      where: { id: lineId, quoteId: row.quoteId, organizationId: ctx.organizationId },
    });
    if (!li) return { ok: false, error: "Line item not found." };
  }

  await prisma.quoteAssumption.update({
    where: { id: row.id },
    data: {
      quoteLineItemId: lineId,
      visibility: parsed.data.visibility,
      text: parsed.data.text,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: row.quoteId,
    opportunityId: row.quote.opportunityId,
    customerId: row.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_ASSUMPTION_UPDATED,
    summary: "Assumption updated",
    payload: { assumptionId: row.id },
  });

  return { ok: true, quoteId: row.quoteId };
}

export async function quoteMutationRemoveAssumption(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = removeQuoteAssumptionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    assumptionId: formData.get("assumptionId"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const row = await prisma.quoteAssumption.findFirst({
    where: {
      id: parsed.data.assumptionId,
      quoteId: parsed.data.quoteId,
      organizationId: ctx.organizationId,
    },
    include: { quote: true },
  });
  if (!row) return { ok: false, error: "Assumption not found." };
  if (row.quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot be edited." };
  }

  await prisma.quoteAssumption.delete({ where: { id: row.id } });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: row.quoteId,
    opportunityId: row.quote.opportunityId,
    customerId: row.quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_ASSUMPTION_REMOVED,
    summary: "Assumption removed",
    payload: { assumptionId: row.id },
  });

  return { ok: true, quoteId: row.quoteId };
}

export async function quoteMutationMarkReadyToSend(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = markQuoteLifecycleSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const bundle = await getQuoteReadinessBundle(ctx.organizationId, parsed.data.quoteId);
  if (!bundle) return { ok: false, error: "Quote not found." };
  if (bundle.status === QuoteStatus.SENT) {
    return { ok: false, error: "Quote is already sent." };
  }

  const items = evaluateQuoteSendReadiness({
    quote: bundle,
    opportunity: bundle.opportunity,
    customerContacts: bundle.customer.contactMethods,
    lineItems: bundle.lineItems,
    quoteTasks: bundle.tasks,
    assumptions: bundle.assumptions,
  });
  if (!allQuoteSendBlockersPass(items)) {
    const blockers = items.filter((i) => i.severity === "BLOCKER" && i.status === "FAIL");
    return {
      ok: false,
      error: `Send readiness: ${blockers.map((b) => b.label).join("; ") || "resolve blockers"}.`,
    };
  }

  const prevStatus = bundle.status;
  await prisma.quote.update({
    where: { id: bundle.id },
    data: { status: QuoteStatus.READY_TO_SEND },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: bundle.id,
    opportunityId: bundle.opportunityId,
    customerId: bundle.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_MARKED_READY,
    summary: "Quote marked ready to send",
    payload: { fromStatus: prevStatus, toStatus: QuoteStatus.READY_TO_SEND },
  });
  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: bundle.id,
    opportunityId: bundle.opportunityId,
    customerId: bundle.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_STATUS_CHANGED,
    summary: `Status: ${prevStatus} → ${QuoteStatus.READY_TO_SEND}`,
    payload: { fromStatus: prevStatus, toStatus: QuoteStatus.READY_TO_SEND },
  });

  return { ok: true, quoteId: bundle.id };
}

export async function quoteMutationMarkSent(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = markQuoteLifecycleSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const full = await getQuoteWorkspace(ctx.organizationId, parsed.data.quoteId);
  if (!full) return { ok: false, error: "Quote not found." };
  if (full.status === QuoteStatus.SENT) {
    return { ok: false, error: "Quote is already sent." };
  }

  const items = evaluateQuoteSendReadiness({
    quote: full,
    opportunity: full.opportunity,
    customerContacts: full.customer.contactMethods,
    lineItems: full.lineItems,
    quoteTasks: full.tasks,
    assumptions: full.assumptions,
  });
  if (!allQuoteSendBlockersPass(items)) {
    const blockers = items.filter((i) => i.severity === "BLOCKER" && i.status === "FAIL");
    return {
      ok: false,
      error: `Cannot send: ${blockers.map((b) => b.label).join("; ") || "resolve blockers"}.`,
    };
  }

  const sentAt = new Date();
  const preview = buildQuoteCustomerPreviewDTO({
    organizationName: ctx.organizationName,
    quote: full,
    customer: full.customer,
    lineItems: full.lineItems,
    assumptions: full.assumptions,
    asOfDate: sentAt,
  });

  const internalExecutionPlan = buildInternalExecutionPlanFromLineItems(full.lineItems);

  const snapshot = {
    version: 2 as const,
    sentAt: sentAt.toISOString(),
    quoteId: full.id,
    displayNumber: full.displayNumber,
    preview,
    internalExecutionPlan,
  };

  const validated = parseValidatedSentQuoteSnapshot(snapshot);
  if (!validated) {
    return { ok: false, error: "Quote could not be marked sent: snapshot validation failed." };
  }

  const prevStatus = full.status;
  await prisma.quote.update({
    where: { id: full.id },
    data: {
      status: QuoteStatus.SENT,
      sentAt,
      sentSnapshotJson: validated as unknown as Prisma.InputJsonValue,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: full.id,
    opportunityId: full.opportunityId,
    customerId: full.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_SENT,
    summary: `Quote #${full.displayNumber} marked sent`,
    payload: { quoteId: full.id },
  });
  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: full.id,
    opportunityId: full.opportunityId,
    customerId: full.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_STATUS_CHANGED,
    summary: `Status: ${prevStatus} → ${QuoteStatus.SENT}`,
    payload: { fromStatus: prevStatus, toStatus: QuoteStatus.SENT },
  });

  return { ok: true, quoteId: full.id, opportunityId: full.opportunityId };
}

export async function quoteMutationLogPreviewed(ctx: OrgSessionContext, formData: FormData): Promise<QuoteActionResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }

  const parsed = logQuotePreviewedSchema.safeParse({ quoteId: formData.get("quoteId") });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_PREVIEWED,
    summary: "Internal customer preview opened",
    payload: { quoteId: quote.id },
  });

  return { ok: true, quoteId: quote.id };
}
