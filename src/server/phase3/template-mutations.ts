/**
 * Phase 3A quote work templates — org-scoped, copy-only. Do not import from client components.
 */
import { Prisma, QuoteStatus, QuoteWorkTemplateKind } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { canAuthorQuotes } from "@/lib/phase2-permissions";
import { canManageQuoteWorkTemplates } from "@/lib/phase3-permissions";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import { getQuoteWorkspace } from "@/server/phase2/quote-queries";
import { recordQuoteActivity } from "@/server/phase2/record-quote-activity";
type MutationResult =
  | { ok: true; quoteId?: string; opportunityId?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
import {
  materializeLineItemWithPlan,
  materializeStageWithTasks,
  materializeTask,
} from "@/server/phase3/template-materialize";
import {
  buildLineItemWithPlanPayloadFromLine,
  buildStageWithTasksPayloadFromStage,
  buildTaskPayloadFromTask,
  payloadToJsonValue,
} from "@/server/phase3/template-payloads.serialize";
import {
  TEMPLATE_PAYLOAD_VERSION,
  parseLineItemWithPlanPayload,
  parseStageWithTasksPayload,
  parseTaskOnlyPayload,
} from "@/server/phase3/template-payloads";
import { getQuoteWorkTemplateForOrg } from "@/server/phase3/template-queries";
import {
  archiveQuoteWorkTemplateSchema,
  insertLineItemTemplateSchema,
  insertStageTemplateSchema,
  insertTaskTemplateSchema,
  parseTagsFromRaw,
  restoreQuoteWorkTemplateSchema,
  saveExecutionTaskAsTemplateSchema,
  saveLineItemAsTemplateSchema,
  saveStageAsTemplateSchema,
  updateQuoteWorkTemplateMetadataSchema,
} from "@/server/phase3/validation";

function zodActionFailure(error: ZodError): { error: string; fieldErrors: Record<string, string[]> } {
  return {
    error: error.issues[0]?.message ?? "Invalid input",
    fieldErrors: error.flatten().fieldErrors as unknown as Record<string, string[]>,
  };
}

function zFail(error: ZodError): MutationResult {
  return { ok: false, ...zodActionFailure(error) };
}

export async function quoteMutationSaveLineItemAsTemplate(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = saveLineItemAsTemplateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    tagsRaw: formData.get("tags") || null,
  });
  if (!parsed.success) return zFail(parsed.error);

  const quote = await getQuoteWorkspace(ctx.organizationId, parsed.data.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Save as template is not available for sent quotes." };
  }

  const line = quote.lineItems.find((l) => l.id === parsed.data.lineItemId);
  if (!line) return { ok: false, error: "Line item not found." };

  const payload = buildLineItemWithPlanPayloadFromLine(line);
  const tags = parseTagsFromRaw(parsed.data.tagsRaw);

  const tmpl = await prisma.quoteWorkTemplate.create({
    data: {
      organizationId: ctx.organizationId,
      kind: QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN,
      name: parsed.data.name,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      tagsJson: tags.length ? (tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      payloadVersion: TEMPLATE_PAYLOAD_VERSION,
      contentVersion: 1,
      payloadJson: payloadToJsonValue(payload),
      createdById: ctx.userId,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_WORK_TEMPLATE_LINE_SAVED,
    summary: `Work template created from line: ${tmpl.name}`,
    payload: { templateId: tmpl.id, lineItemId: line.id },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationSaveStageAsTemplate(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = saveStageAsTemplateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
    stageId: formData.get("stageId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    tagsRaw: formData.get("tags") || null,
  });
  if (!parsed.success) return zFail(parsed.error);

  const quote = await getQuoteWorkspace(ctx.organizationId, parsed.data.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Save as template is not available for sent quotes." };
  }

  const line = quote.lineItems.find((l) => l.id === parsed.data.lineItemId);
  if (!line) return { ok: false, error: "Line item not found." };
  const stage = line.executionStages.find((s) => s.id === parsed.data.stageId);
  if (!stage) return { ok: false, error: "Stage not found." };

  const payload = buildStageWithTasksPayloadFromStage(stage);
  const tags = parseTagsFromRaw(parsed.data.tagsRaw);

  const tmpl = await prisma.quoteWorkTemplate.create({
    data: {
      organizationId: ctx.organizationId,
      kind: QuoteWorkTemplateKind.STAGE_WITH_TASKS,
      name: parsed.data.name,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      tagsJson: tags.length ? (tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      payloadVersion: TEMPLATE_PAYLOAD_VERSION,
      contentVersion: 1,
      payloadJson: payloadToJsonValue(payload),
      createdById: ctx.userId,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_WORK_TEMPLATE_STAGE_SAVED,
    summary: `Work template created from stage: ${tmpl.name}`,
    payload: { templateId: tmpl.id, stageId: stage.id, lineItemId: line.id },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationSaveExecutionTaskAsTemplate(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = saveExecutionTaskAsTemplateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    stageId: formData.get("stageId"),
    taskId: formData.get("taskId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    tagsRaw: formData.get("tags") || null,
  });
  if (!parsed.success) return zFail(parsed.error);

  const quote = await getQuoteWorkspace(ctx.organizationId, parsed.data.quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Save as template is not available for sent quotes." };
  }

  let foundTask: (typeof quote.lineItems)[number]["executionStages"][number]["tasks"][number] | undefined;
  for (const line of quote.lineItems) {
    for (const stage of line.executionStages) {
      if (stage.id !== parsed.data.stageId) continue;
      foundTask = stage.tasks.find((t) => t.id === parsed.data.taskId);
      if (foundTask) break;
    }
    if (foundTask) break;
  }
  if (!foundTask) return { ok: false, error: "Task not found." };

  const payload = buildTaskPayloadFromTask(foundTask);
  const tags = parseTagsFromRaw(parsed.data.tagsRaw);

  const tmpl = await prisma.quoteWorkTemplate.create({
    data: {
      organizationId: ctx.organizationId,
      kind: QuoteWorkTemplateKind.TASK,
      name: parsed.data.name,
      description: parsed.data.description?.trim() ? parsed.data.description.trim() : null,
      tagsJson: tags.length ? (tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      payloadVersion: TEMPLATE_PAYLOAD_VERSION,
      contentVersion: 1,
      payloadJson: payloadToJsonValue(payload),
      createdById: ctx.userId,
    },
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_WORK_TEMPLATE_TASK_SAVED,
    summary: `Work template created from task: ${tmpl.name}`,
    payload: { templateId: tmpl.id, taskId: foundTask.id },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationArchiveQuoteWorkTemplate(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canManageQuoteWorkTemplates(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = archiveQuoteWorkTemplateSchema.safeParse({ templateId: formData.get("templateId") });
  if (!parsed.success) return zFail(parsed.error);

  const tmpl = await getQuoteWorkTemplateForOrg(ctx.organizationId, parsed.data.templateId);
  if (!tmpl) return { ok: false, error: "Template not found." };
  if (tmpl.archivedAt) return { ok: false, error: "Template is already archived." };

  await prisma.quoteWorkTemplate.update({
    where: { id: tmpl.id },
    data: { archivedAt: new Date() },
  });

  return { ok: true };
}

export async function quoteMutationRestoreQuoteWorkTemplate(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canManageQuoteWorkTemplates(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = restoreQuoteWorkTemplateSchema.safeParse({ templateId: formData.get("templateId") });
  if (!parsed.success) return zFail(parsed.error);

  const tmpl = await getQuoteWorkTemplateForOrg(ctx.organizationId, parsed.data.templateId);
  if (!tmpl) return { ok: false, error: "Template not found." };
  if (!tmpl.archivedAt) return { ok: false, error: "Template is not archived." };

  await prisma.quoteWorkTemplate.update({
    where: { id: tmpl.id },
    data: { archivedAt: null },
  });

  return { ok: true };
}

export async function quoteMutationUpdateQuoteWorkTemplateMetadata(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canManageQuoteWorkTemplates(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = updateQuoteWorkTemplateMetadataSchema.safeParse({
    templateId: formData.get("templateId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    tagsRaw: formData.get("tags") || null,
  });
  if (!parsed.success) return zFail(parsed.error);

  const tmpl = await getQuoteWorkTemplateForOrg(ctx.organizationId, parsed.data.templateId);
  if (!tmpl) return { ok: false, error: "Template not found." };

  const tags = parseTagsFromRaw(parsed.data.tagsRaw);
  const description =
    parsed.data.description && parsed.data.description.trim().length > 0
      ? parsed.data.description.trim()
      : null;

  await prisma.quoteWorkTemplate.update({
    where: { id: tmpl.id },
    data: {
      name: parsed.data.name.trim(),
      description,
      tagsJson: tags.length ? (tags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return { ok: true };
}

export async function quoteMutationInsertLineItemTemplateIntoQuote(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = insertLineItemTemplateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return zFail(parsed.error);

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot receive template inserts." };
  }

  const tmpl = await getQuoteWorkTemplateForOrg(ctx.organizationId, parsed.data.templateId);
  if (!tmpl) return { ok: false, error: "Template not found." };
  if (tmpl.archivedAt) return { ok: false, error: "Archived templates cannot be inserted." };
  if (tmpl.kind !== QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN) {
    return { ok: false, error: "Template kind does not match line insert." };
  }

  let linePayload: ReturnType<typeof parseLineItemWithPlanPayload>;
  try {
    linePayload = parseLineItemWithPlanPayload(tmpl.payloadJson);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid template payload." };
  }

  await prisma.$transaction(async (tx) => {
    await materializeLineItemWithPlan({
      tx,
      organizationId: ctx.organizationId,
      quoteId: quote.id,
      payload: linePayload,
      templateMeta: {
        templateId: tmpl.id,
        templateName: tmpl.name,
        contentVersion: tmpl.contentVersion,
      },
    });
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_WORK_TEMPLATE_LINE_INSERTED,
    summary: `Line inserted from template: ${tmpl.name}`,
    payload: { templateId: tmpl.id },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationInsertStageTemplateIntoLine(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = insertStageTemplateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    lineItemId: formData.get("lineItemId"),
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return zFail(parsed.error);

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot receive template inserts." };
  }

  const lineRow = await prisma.quoteLineItem.findFirst({
    where: { id: parsed.data.lineItemId, quoteId: quote.id, organizationId: ctx.organizationId },
  });
  if (!lineRow) return { ok: false, error: "Line item not found." };

  const tmpl = await getQuoteWorkTemplateForOrg(ctx.organizationId, parsed.data.templateId);
  if (!tmpl) return { ok: false, error: "Template not found." };
  if (tmpl.archivedAt) return { ok: false, error: "Archived templates cannot be inserted." };
  if (tmpl.kind !== QuoteWorkTemplateKind.STAGE_WITH_TASKS) {
    return { ok: false, error: "Template kind does not match stage insert." };
  }

  let stagePayload: ReturnType<typeof parseStageWithTasksPayload>;
  try {
    stagePayload = parseStageWithTasksPayload(tmpl.payloadJson);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid template payload." };
  }

  await prisma.$transaction(async (tx) => {
    await materializeStageWithTasks({
      tx,
      organizationId: ctx.organizationId,
      quoteId: quote.id,
      lineItemId: parsed.data.lineItemId,
      payload: stagePayload,
    });
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_WORK_TEMPLATE_STAGE_INSERTED,
    summary: `Stage inserted from template: ${tmpl.name}`,
    payload: { templateId: tmpl.id, lineItemId: parsed.data.lineItemId },
  });

  return { ok: true, quoteId: quote.id };
}

export async function quoteMutationInsertTaskTemplateIntoStage(
  ctx: OrgSessionContext,
  formData: FormData,
): Promise<MutationResult> {
  if (!canAuthorQuotes(ctx.role)) {
    return { ok: false, error: "You do not have permission." };
  }
  const parsed = insertTaskTemplateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    stageId: formData.get("stageId"),
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return zFail(parsed.error);

  const quote = await prisma.quote.findFirst({
    where: { id: parsed.data.quoteId, organizationId: ctx.organizationId },
  });
  if (!quote) return { ok: false, error: "Quote not found." };
  if (quote.status === QuoteStatus.SENT) {
    return { ok: false, error: "Sent quotes cannot receive template inserts." };
  }

  const stageRow = await prisma.quoteLineExecutionStage.findFirst({
    where: { id: parsed.data.stageId, organizationId: ctx.organizationId },
    include: { quoteLineItem: true },
  });
  if (!stageRow || stageRow.quoteLineItem.quoteId !== quote.id) {
    return { ok: false, error: "Stage not found." };
  }

  const tmpl = await getQuoteWorkTemplateForOrg(ctx.organizationId, parsed.data.templateId);
  if (!tmpl) return { ok: false, error: "Template not found." };
  if (tmpl.archivedAt) return { ok: false, error: "Archived templates cannot be inserted." };
  if (tmpl.kind !== QuoteWorkTemplateKind.TASK) {
    return { ok: false, error: "Template kind does not match task insert." };
  }

  let taskPayload: ReturnType<typeof parseTaskOnlyPayload>;
  try {
    taskPayload = parseTaskOnlyPayload(tmpl.payloadJson);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid template payload." };
  }

  await prisma.$transaction(async (tx) => {
    await materializeTask({
      tx,
      organizationId: ctx.organizationId,
      quoteId: quote.id,
      stageId: parsed.data.stageId,
      payload: taskPayload,
    });
  });

  await recordQuoteActivity(prisma, {
    organizationId: ctx.organizationId,
    quoteId: quote.id,
    opportunityId: quote.opportunityId,
    customerId: quote.customerId,
    actorUserId: ctx.userId,
    eventType: QuoteActivityEventType.QUOTE_WORK_TEMPLATE_TASK_INSERTED,
    summary: `Task inserted from template: ${tmpl.name}`,
    payload: { templateId: tmpl.id, stageId: parsed.data.stageId },
  });

  return { ok: true, quoteId: quote.id };
}
