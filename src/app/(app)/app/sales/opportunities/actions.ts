"use server";

import { revalidatePath } from "next/cache";
import {
  OpportunityStatus,
  OpportunityTaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessPhase1CustomersAndSales } from "@/lib/phase1-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import { ActivityEventType } from "@/server/phase1/activity-events";
import { recordBusinessActivity } from "@/server/phase1/record-activity";
import type { ZodError } from "zod";
import {
  addOpportunityTaskSchema,
  createOpportunitySchema,
  markTerminalSchema,
  updateOpportunitySchema,
  updateOpportunityTaskStatusSchema,
} from "@/server/phase1/validation";

function zodActionFailure(error: ZodError): { error: string; fieldErrors: Record<string, string[]> } {
  return {
    error: error.issues[0]?.message ?? "Invalid input",
    fieldErrors: error.flatten().fieldErrors as unknown as Record<string, string[]>,
  };
}

export type ActionResult =
  | { ok: true; opportunityId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fieldErr(path: string, message: string): ActionResult {
  return { ok: false, error: message, fieldErrors: { [path]: [message] } };
}

async function assertCustomerInOrg(organizationId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true },
  });
}

async function getOpportunityForOrg(organizationId: string, opportunityId: string) {
  return prisma.opportunity.findFirst({
    where: { id: opportunityId, organizationId },
  });
}

async function assertUserInOrg(organizationId: string, userId: string | null | undefined) {
  if (!userId) return true;
  const m = await prisma.membership.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  return Boolean(m);
}

function parseOptionalDecimal(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) {
    return null;
  }
  return String(n);
}

function parseOptionalDateTime(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function createOpportunity(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to create opportunities." };
  }

  const parsed = createOpportunitySchema.safeParse({
    customerId: formData.get("customerId"),
    title: formData.get("title"),
    serviceType: formData.get("serviceType"),
    source: formData.get("source"),
    priority: formData.get("priority"),
    serviceAddressText: formData.get("serviceAddressText") || null,
    serviceAddressTbd: formData.get("serviceAddressTbd") === "on" || formData.get("serviceAddressTbd") === "true",
    contactIntakeWaived: formData.get("contactIntakeWaived") === "on" || formData.get("contactIntakeWaived") === "true",
    scopeIntent: formData.get("scopeIntent"),
    desiredTimeline: formData.get("desiredTimeline") || null,
    salesOwnerUserId: formData.get("salesOwnerUserId") || null,
    qualificationStatus: formData.get("qualificationStatus") || null,
    estimatedValue: formData.get("estimatedValue") || null,
    followUpAt: formData.get("followUpAt") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const cust = await assertCustomerInOrg(ctx.organizationId, parsed.data.customerId);
  if (!cust) {
    return { ok: false, error: "Customer not found for this organization." };
  }

  const ownerId = parsed.data.salesOwnerUserId?.trim() || null;
  if (ownerId && !(await assertUserInOrg(ctx.organizationId, ownerId))) {
    return fieldErr("salesOwnerUserId", "Sales owner must be a member of this organization.");
  }

  const est = parseOptionalDecimal(parsed.data.estimatedValue ?? undefined);
  if (parsed.data.estimatedValue?.trim() && est === null) {
    return fieldErr("estimatedValue", "Enter a valid number for estimated value.");
  }

  const followUp = parseOptionalDateTime(parsed.data.followUpAt ?? undefined);

  const opp = await prisma.opportunity.create({
    data: {
      organizationId: ctx.organizationId,
      customerId: parsed.data.customerId,
      title: parsed.data.title,
      serviceType: parsed.data.serviceType,
      source: parsed.data.source,
      priority: parsed.data.priority,
      serviceAddressText: parsed.data.serviceAddressText?.trim()
        ? parsed.data.serviceAddressText.trim()
        : null,
      serviceAddressTbd: parsed.data.serviceAddressTbd,
      contactIntakeWaived: parsed.data.contactIntakeWaived,
      scopeIntent: parsed.data.scopeIntent,
      desiredTimeline: parsed.data.desiredTimeline?.trim() ? parsed.data.desiredTimeline : null,
      salesOwnerUserId: ownerId,
      qualificationStatus: parsed.data.qualificationStatus?.trim()
        ? parsed.data.qualificationStatus
        : null,
      estimatedValue: est,
      followUpAt: followUp,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    opportunityId: opp.id,
    customerId: opp.customerId,
    eventType: ActivityEventType.OPPORTUNITY_CREATED,
    actorUserId: ctx.userId,
    summary: `Opportunity created: ${opp.title}`,
    payload: { opportunityId: opp.id, customerId: opp.customerId },
  });

  if (parsed.data.contactIntakeWaived) {
    await recordBusinessActivity(prisma, {
      organizationId: ctx.organizationId,
      opportunityId: opp.id,
      customerId: opp.customerId,
      eventType: ActivityEventType.CONTACT_INTAKE_WAIVED,
      actorUserId: ctx.userId,
      summary: "Contact intake waived for this opportunity.",
      payload: { opportunityId: opp.id },
    });
  }

  revalidatePath("/app/sales/opportunities");
  revalidatePath(`/app/sales/opportunities/${opp.id}`);
  revalidatePath(`/app/customers/${opp.customerId}`);
  return { ok: true, opportunityId: opp.id };
}

export async function updateOpportunity(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to update opportunities." };
  }

  const parsed = updateOpportunitySchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    customerId: formData.get("customerId"),
    title: formData.get("title"),
    serviceType: formData.get("serviceType"),
    source: formData.get("source"),
    priority: formData.get("priority"),
    status: formData.get("status"),
    serviceAddressText: formData.get("serviceAddressText") || null,
    serviceAddressTbd: formData.get("serviceAddressTbd") === "on" || formData.get("serviceAddressTbd") === "true",
    contactIntakeWaived: formData.get("contactIntakeWaived") === "on" || formData.get("contactIntakeWaived") === "true",
    scopeIntent: formData.get("scopeIntent"),
    desiredTimeline: formData.get("desiredTimeline") || null,
    salesOwnerUserId: formData.get("salesOwnerUserId") || null,
    qualificationStatus: formData.get("qualificationStatus") || null,
    estimatedValue: formData.get("estimatedValue") || null,
    followUpAt: formData.get("followUpAt") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const existing = await getOpportunityForOrg(ctx.organizationId, parsed.data.opportunityId);
  if (!existing) {
    return { ok: false, error: "Opportunity not found." };
  }
  if (
    existing.status === OpportunityStatus.LOST ||
    existing.status === OpportunityStatus.NO_QUOTE ||
    existing.status === OpportunityStatus.ARCHIVED
  ) {
    return { ok: false, error: "This opportunity is closed and cannot be edited here." };
  }

  if (existing.customerId !== parsed.data.customerId) {
    return { ok: false, error: "Changing the customer is not supported in this version." };
  }

  const cust = await assertCustomerInOrg(ctx.organizationId, parsed.data.customerId);
  if (!cust) {
    return { ok: false, error: "Customer not found." };
  }

  const ownerId = parsed.data.salesOwnerUserId?.trim() || null;
  if (ownerId && !(await assertUserInOrg(ctx.organizationId, ownerId))) {
    return fieldErr("salesOwnerUserId", "Sales owner must be a member of this organization.");
  }

  const est = parseOptionalDecimal(parsed.data.estimatedValue ?? undefined);
  if (parsed.data.estimatedValue?.trim() && est === null) {
    return fieldErr("estimatedValue", "Enter a valid number for estimated value.");
  }
  const followUp = parseOptionalDateTime(parsed.data.followUpAt ?? undefined);

  const prevWaiver = existing.contactIntakeWaived;
  const nextWaiver = parsed.data.contactIntakeWaived;

  await prisma.opportunity.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      serviceType: parsed.data.serviceType,
      source: parsed.data.source,
      priority: parsed.data.priority,
      status: parsed.data.status,
      serviceAddressText: parsed.data.serviceAddressText?.trim()
        ? parsed.data.serviceAddressText.trim()
        : null,
      serviceAddressTbd: parsed.data.serviceAddressTbd,
      contactIntakeWaived: parsed.data.contactIntakeWaived,
      scopeIntent: parsed.data.scopeIntent,
      desiredTimeline: parsed.data.desiredTimeline?.trim() ? parsed.data.desiredTimeline : null,
      salesOwnerUserId: ownerId,
      qualificationStatus: parsed.data.qualificationStatus?.trim()
        ? parsed.data.qualificationStatus
        : null,
      estimatedValue: est,
      followUpAt: followUp,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    opportunityId: existing.id,
    customerId: existing.customerId,
    eventType: ActivityEventType.OPPORTUNITY_UPDATED,
    actorUserId: ctx.userId,
    summary: "Opportunity updated",
    payload: { opportunityId: existing.id },
  });

  if (!prevWaiver && nextWaiver) {
    await recordBusinessActivity(prisma, {
      organizationId: ctx.organizationId,
      opportunityId: existing.id,
      customerId: existing.customerId,
      eventType: ActivityEventType.CONTACT_INTAKE_WAIVED,
      actorUserId: ctx.userId,
      summary: "Contact intake waived for this opportunity.",
      payload: { opportunityId: existing.id },
    });
  }
  if (prevWaiver && !nextWaiver) {
    await recordBusinessActivity(prisma, {
      organizationId: ctx.organizationId,
      opportunityId: existing.id,
      customerId: existing.customerId,
      eventType: ActivityEventType.CONTACT_INTAKE_WAIVER_REMOVED,
      actorUserId: ctx.userId,
      summary: "Contact intake waiver removed; add contact methods or waive again explicitly.",
      payload: { opportunityId: existing.id },
    });
  }

  revalidatePath("/app/sales/opportunities");
  revalidatePath(`/app/sales/opportunities/${existing.id}`);
  revalidatePath(`/app/customers/${existing.customerId}`);
  return { ok: true };
}

export async function addOpportunityTask(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to add tasks." };
  }

  const parsed = addOpportunityTaskSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    title: formData.get("title"),
    kind: formData.get("kind"),
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    dueAt: formData.get("dueAt") || null,
    assigneeUserId: formData.get("assigneeUserId") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const opp = await getOpportunityForOrg(ctx.organizationId, parsed.data.opportunityId);
  if (!opp) {
    return { ok: false, error: "Opportunity not found." };
  }
  if (opp.status === OpportunityStatus.LOST || opp.status === OpportunityStatus.NO_QUOTE) {
    return { ok: false, error: "Cannot add tasks to a closed opportunity." };
  }

  const assignee = parsed.data.assigneeUserId?.trim() || null;
  if (assignee && !(await assertUserInOrg(ctx.organizationId, assignee))) {
    return fieldErr("assigneeUserId", "Assignee must be a member of this organization.");
  }

  const due = parseOptionalDateTime(parsed.data.dueAt ?? undefined);

  const task = await prisma.opportunityTask.create({
    data: {
      opportunityId: opp.id,
      title: parsed.data.title,
      kind: parsed.data.kind,
      isRequired: Boolean(parsed.data.isRequired),
      dueAt: due,
      assigneeUserId: assignee,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    opportunityId: opp.id,
    customerId: opp.customerId,
    eventType: ActivityEventType.OPPORTUNITY_TASK_ADDED,
    actorUserId: ctx.userId,
    summary: `Task added: ${task.title}`,
    payload: { opportunityId: opp.id, taskId: task.id },
  });

  revalidatePath(`/app/sales/opportunities/${opp.id}`);
  return { ok: true };
}

export async function updateOpportunityTaskStatus(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to update tasks." };
  }

  const parsed = updateOpportunityTaskStatusSchema.safeParse({
    taskId: formData.get("taskId"),
    opportunityId: formData.get("opportunityId"),
    status: formData.get("status"),
    outcome: formData.get("outcome") || null,
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const opp = await getOpportunityForOrg(ctx.organizationId, parsed.data.opportunityId);
  if (!opp) {
    return { ok: false, error: "Opportunity not found." };
  }

  const task = await prisma.opportunityTask.findFirst({
    where: { id: parsed.data.taskId, opportunityId: opp.id },
  });
  if (!task) {
    return { ok: false, error: "Task not found." };
  }

  const prev = task.status;
  const next = parsed.data.status;

  await prisma.opportunityTask.update({
    where: { id: task.id },
    data: {
      status: next,
      outcome: parsed.data.outcome?.trim() ? parsed.data.outcome : null,
    },
  });

  const completedNow = next === OpportunityTaskStatus.COMPLETE && prev !== OpportunityTaskStatus.COMPLETE;

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    opportunityId: opp.id,
    customerId: opp.customerId,
    eventType: completedNow
      ? ActivityEventType.OPPORTUNITY_TASK_COMPLETED
      : ActivityEventType.OPPORTUNITY_TASK_UPDATED,
    actorUserId: ctx.userId,
    summary: completedNow ? `Task completed: ${task.title}` : `Task updated: ${task.title}`,
    payload: { opportunityId: opp.id, taskId: task.id, status: next },
  });

  revalidatePath(`/app/sales/opportunities/${opp.id}`);
  return { ok: true };
}

export async function markOpportunityLost(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access." };
  }

  const parsed = markTerminalSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const opp = await getOpportunityForOrg(ctx.organizationId, parsed.data.opportunityId);
  if (!opp) {
    return { ok: false, error: "Opportunity not found." };
  }
  if (
    opp.status === OpportunityStatus.LOST ||
    opp.status === OpportunityStatus.NO_QUOTE ||
    opp.status === OpportunityStatus.ARCHIVED
  ) {
    return { ok: false, error: "This opportunity is already closed." };
  }

  await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      status: OpportunityStatus.LOST,
      lostReason: parsed.data.reason,
      noQuoteReason: null,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    opportunityId: opp.id,
    customerId: opp.customerId,
    eventType: ActivityEventType.OPPORTUNITY_MARKED_LOST,
    actorUserId: ctx.userId,
    summary: "Opportunity marked lost",
    payload: { opportunityId: opp.id, reason: parsed.data.reason },
  });

  revalidatePath(`/app/sales/opportunities/${opp.id}`);
  revalidatePath("/app/sales/opportunities");
  revalidatePath(`/app/customers/${opp.customerId}`);
  return { ok: true };
}

export async function markOpportunityNoQuote(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access." };
  }

  const parsed = markTerminalSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { ok: false, ...zodActionFailure(parsed.error) };
  }

  const opp = await getOpportunityForOrg(ctx.organizationId, parsed.data.opportunityId);
  if (!opp) {
    return { ok: false, error: "Opportunity not found." };
  }
  if (
    opp.status === OpportunityStatus.LOST ||
    opp.status === OpportunityStatus.NO_QUOTE ||
    opp.status === OpportunityStatus.ARCHIVED
  ) {
    return { ok: false, error: "This opportunity is already closed." };
  }

  await prisma.opportunity.update({
    where: { id: opp.id },
    data: {
      status: OpportunityStatus.NO_QUOTE,
      noQuoteReason: parsed.data.reason,
      lostReason: null,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    opportunityId: opp.id,
    customerId: opp.customerId,
    eventType: ActivityEventType.OPPORTUNITY_MARKED_NO_QUOTE,
    actorUserId: ctx.userId,
    summary: "Opportunity marked as no quote",
    payload: { opportunityId: opp.id, reason: parsed.data.reason },
  });

  revalidatePath(`/app/sales/opportunities/${opp.id}`);
  revalidatePath("/app/sales/opportunities");
  revalidatePath(`/app/customers/${opp.customerId}`);
  return { ok: true };
}
