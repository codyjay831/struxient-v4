"use server";

import { revalidatePath } from "next/cache";
import type { CustomerContactType, Prisma } from "@prisma/client";
import { CustomerKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessPhase1CustomersAndSales } from "@/lib/phase1-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import { ActivityEventType } from "@/server/phase1/activity-events";
import { recordBusinessActivity } from "@/server/phase1/record-activity";
import {
  addCustomerContactSchema,
  createCustomerSchema,
  parseContactValue,
  updateCustomerContactSchema,
  updateCustomerSchema,
} from "@/server/phase1/validation";

export type ActionResult =
  | { ok: true; customerId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function fieldErr(path: string, message: string): ActionResult {
  return { ok: false, error: message, fieldErrors: { [path]: [message] } };
}

async function assertCustomerInOrg(organizationId: string, customerId: string) {
  const row = await prisma.customer.findFirst({
    where: { id: customerId, organizationId },
    select: { id: true },
  });
  return row;
}

export async function createCustomer(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to create customers." };
  }

  const parsed = createCustomerSchema.safeParse({
    displayName: formData.get("displayName"),
    kind: formData.get("kind") || CustomerKind.UNKNOWN,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Invalid input";
    return { ok: false, error: msg, fieldErrors: first as Record<string, string[]> };
  }

  const customer = await prisma.customer.create({
    data: {
      organizationId: ctx.organizationId,
      displayName: parsed.data.displayName,
      kind: parsed.data.kind ?? CustomerKind.UNKNOWN,
      notes: parsed.data.notes?.trim() ? parsed.data.notes : null,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    customerId: customer.id,
    opportunityId: null,
    eventType: ActivityEventType.CUSTOMER_CREATED,
    actorUserId: ctx.userId,
    summary: `Customer created: ${customer.displayName}`,
    payload: { customerId: customer.id },
  });

  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${customer.id}`);
  return { ok: true, customerId: customer.id };
}

export async function updateCustomer(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to update customers." };
  }

  const parsed = updateCustomerSchema.safeParse({
    customerId: formData.get("customerId"),
    displayName: formData.get("displayName"),
    kind: formData.get("kind"),
    status: formData.get("status"),
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Invalid input";
    return { ok: false, error: msg, fieldErrors: first as Record<string, string[]> };
  }

  const existing = await assertCustomerInOrg(ctx.organizationId, parsed.data.customerId);
  if (!existing) {
    return { ok: false, error: "Customer not found." };
  }

  await prisma.customer.update({
    where: { id: parsed.data.customerId },
    data: {
      displayName: parsed.data.displayName,
      kind: parsed.data.kind,
      status: parsed.data.status,
      notes: parsed.data.notes?.trim() ? parsed.data.notes : null,
    },
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    customerId: parsed.data.customerId,
    opportunityId: null,
    eventType: ActivityEventType.CUSTOMER_UPDATED,
    actorUserId: ctx.userId,
    summary: `Customer updated: ${parsed.data.displayName}`,
    payload: { customerId: parsed.data.customerId },
  });

  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${parsed.data.customerId}`);
  return { ok: true };
}

/**
 * At most one active primary per (customer, contact type). Other types may each have their own primary.
 */
async function clearPrimaryForCustomerType(
  tx: Prisma.TransactionClient,
  customerId: string,
  type: CustomerContactType,
  excludeContactId?: string,
) {
  await tx.customerContactMethod.updateMany({
    where: {
      customerId,
      type,
      archivedAt: null,
      isPrimary: true,
      ...(excludeContactId ? { id: { not: excludeContactId } } : {}),
    },
    data: { isPrimary: false },
  });
}

export async function addCustomerContactMethod(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to add contacts." };
  }

  const parsed = addCustomerContactSchema.safeParse({
    customerId: formData.get("customerId"),
    type: formData.get("type"),
    value: formData.get("value"),
    isPrimary: formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true",
    okToEmail: formData.get("okToEmail") === "on" || formData.get("okToEmail") === "true",
    okToSms: formData.get("okToSms") === "on" || formData.get("okToSms") === "true",
    label: formData.get("label") || null,
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Invalid input";
    return { ok: false, error: msg, fieldErrors: first as Record<string, string[]> };
  }

  const valueCheck = parseContactValue(parsed.data.type, parsed.data.value);
  if (!valueCheck.success) {
    return fieldErr("value", valueCheck.error.errors[0]?.message ?? "Invalid value");
  }

  const existing = await assertCustomerInOrg(ctx.organizationId, parsed.data.customerId);
  if (!existing) {
    return { ok: false, error: "Customer not found." };
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await clearPrimaryForCustomerType(tx, parsed.data.customerId, parsed.data.type);
    }
    await tx.customerContactMethod.create({
      data: {
        customerId: parsed.data.customerId,
        type: parsed.data.type,
        value: valueCheck.data,
        isPrimary: Boolean(parsed.data.isPrimary),
        okToEmail: Boolean(parsed.data.okToEmail),
        okToSms: Boolean(parsed.data.okToSms),
        label: parsed.data.label?.trim() ? parsed.data.label : null,
      },
    });
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    customerId: parsed.data.customerId,
    opportunityId: null,
    eventType: ActivityEventType.CUSTOMER_CONTACT_ADDED,
    actorUserId: ctx.userId,
    summary: `Contact added (${parsed.data.type})`,
    payload: { customerId: parsed.data.customerId, type: parsed.data.type },
  });

  revalidatePath(`/app/customers/${parsed.data.customerId}`);
  revalidatePath("/app/customers");
  return { ok: true };
}

export async function updateCustomerContactMethod(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireOrgSession();
  if (!canAccessPhase1CustomersAndSales(ctx.role)) {
    return { ok: false, error: "You do not have access to update contacts." };
  }

  const parsed = updateCustomerContactSchema.safeParse({
    contactId: formData.get("contactId"),
    customerId: formData.get("customerId"),
    type: formData.get("type"),
    value: formData.get("value"),
    isPrimary: formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true",
    okToEmail: formData.get("okToEmail") === "on" || formData.get("okToEmail") === "true",
    okToSms: formData.get("okToSms") === "on" || formData.get("okToSms") === "true",
    label: formData.get("label") || null,
    archived: formData.get("archived") === "on" || formData.get("archived") === "true",
  });
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? "Invalid input";
    return { ok: false, error: msg, fieldErrors: first as Record<string, string[]> };
  }

  const valueCheck = parseContactValue(parsed.data.type, parsed.data.value);
  if (!valueCheck.success) {
    return fieldErr("value", valueCheck.error.errors[0]?.message ?? "Invalid value");
  }

  const contact = await prisma.customerContactMethod.findFirst({
    where: {
      id: parsed.data.contactId,
      customerId: parsed.data.customerId,
      customer: { organizationId: ctx.organizationId },
    },
  });
  if (!contact) {
    return { ok: false, error: "Contact not found." };
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary && !parsed.data.archived) {
      await clearPrimaryForCustomerType(tx, parsed.data.customerId, parsed.data.type, contact.id);
    }
    await tx.customerContactMethod.update({
      where: { id: contact.id },
      data: {
        type: parsed.data.type,
        value: valueCheck.data,
        isPrimary: parsed.data.archived ? false : Boolean(parsed.data.isPrimary),
        okToEmail: Boolean(parsed.data.okToEmail),
        okToSms: Boolean(parsed.data.okToSms),
        label: parsed.data.label?.trim() ? parsed.data.label : null,
        archivedAt: parsed.data.archived ? new Date() : null,
      },
    });
  });

  await recordBusinessActivity(prisma, {
    organizationId: ctx.organizationId,
    customerId: parsed.data.customerId,
    opportunityId: null,
    eventType: ActivityEventType.CUSTOMER_CONTACT_UPDATED,
    actorUserId: ctx.userId,
    summary: "Contact method updated",
    payload: { customerId: parsed.data.customerId, contactId: contact.id },
  });

  revalidatePath(`/app/customers/${parsed.data.customerId}`);
  revalidatePath("/app/customers");
  return { ok: true };
}
