import { Prisma, PricingMode, QuoteLineMode, QuoteTaskStatus, QuoteWorkTemplateKind } from "@prisma/client";
import type { LineItemWithPlanPayload, StageWithTasksPayload, TaskOnlyPayload } from "@/server/phase3/template-payloads";
import { recalculateQuoteTotals } from "@/server/phase2/recalculate-quote-totals";

export type LineTemplateMeta = {
  templateId: string;
  templateName: string;
  contentVersion: number;
};

function sortStagesPayload(stages: LineItemWithPlanPayload["stages"]) {
  return [...stages].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function sortTasksPayload<T extends { sortOrder?: number; title: string }>(tasks: T[]) {
  return [...tasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function materializeLineItemWithPlan(params: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  quoteId: string;
  payload: LineItemWithPlanPayload;
  templateMeta: LineTemplateMeta;
}): Promise<{ lineItemId: string }> {
  const { tx, organizationId, quoteId, payload, templateMeta } = params;

  const maxLine = await tx.quoteLineItem.aggregate({
    where: { quoteId, organizationId },
    _max: { sortOrder: true },
  });
  const lineSortOrder = (maxLine._max.sortOrder ?? -1) + 1;

  const qtyDec = new Prisma.Decimal(String(payload.line.quantity));
  const unit = payload.line.unitPriceCents ?? null;
  const lineTotalCents =
    payload.line.pricingMode === PricingMode.FIXED_PRICE && unit != null
      ? Math.round(Number(qtyDec) * unit)
      : null;

  const line = await tx.quoteLineItem.create({
    data: {
      organizationId,
      quoteId,
      title: payload.line.title,
      customerDescription: payload.line.customerDescription,
      quantity: qtyDec,
      unitPriceCents: unit,
      lineTotalCents,
      pricingMode: payload.line.pricingMode,
      lineMode: payload.line.lineMode ?? QuoteLineMode.REQUIRED,
      sortOrder: lineSortOrder,
      internalNotes: payload.line.internalNotes,
      sourceTemplateId: templateMeta.templateId,
      sourceTemplateKind: QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN,
      sourceTemplateVersion: templateMeta.contentVersion,
      sourceTemplateName: templateMeta.templateName,
    },
  });

  const stagesOrdered = sortStagesPayload(payload.stages);
  for (let si = 0; si < stagesOrdered.length; si++) {
    const sp = stagesOrdered[si];
    const maxSt = await tx.quoteLineExecutionStage.aggregate({
      where: { quoteLineItemId: line.id, organizationId },
      _max: { sortOrder: true },
    });
    const stageSort = (maxSt._max.sortOrder ?? -1) + 1;
    const stage = await tx.quoteLineExecutionStage.create({
      data: {
        organizationId,
        quoteLineItemId: line.id,
        title: sp.title,
        sortOrder: stageSort,
        internalNotes: sp.internalNotes,
      },
    });

    const tasksOrdered = sortTasksPayload(sp.tasks);
    for (let ti = 0; ti < tasksOrdered.length; ti++) {
      const tp = tasksOrdered[ti];
      const maxTk = await tx.quoteLineExecutionTask.aggregate({
        where: { stageId: stage.id, organizationId },
        _max: { sortOrder: true },
      });
      const taskSort = (maxTk._max.sortOrder ?? -1) + 1;
      await tx.quoteLineExecutionTask.create({
        data: {
          organizationId,
          stageId: stage.id,
          title: tp.title,
          description: tp.description,
          status: QuoteTaskStatus.NOT_READY,
          isRequired: Boolean(tp.isRequired),
          sortOrder: taskSort,
          assignedRole: tp.assignedRole,
          estimatedDurationMinutes: tp.estimatedDurationMinutes ?? null,
          customerVisible: Boolean(tp.customerVisible),
          customerLabel: tp.customerLabel,
          internalNotes: tp.internalNotes,
        },
      });
    }
  }

  await recalculateQuoteTotals(tx, organizationId, quoteId);
  return { lineItemId: line.id };
}

export async function materializeStageWithTasks(params: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  quoteId: string;
  lineItemId: string;
  payload: StageWithTasksPayload;
}): Promise<{ stageId: string }> {
  const { tx, organizationId, quoteId, lineItemId, payload } = params;

  const line = await tx.quoteLineItem.findFirst({
    where: { id: lineItemId, quoteId, organizationId },
  });
  if (!line) {
    throw new Error("Line item not found.");
  }

  const maxSt = await tx.quoteLineExecutionStage.aggregate({
    where: { quoteLineItemId: lineItemId, organizationId },
    _max: { sortOrder: true },
  });
  const stageSort = (maxSt._max.sortOrder ?? -1) + 1;

  const stage = await tx.quoteLineExecutionStage.create({
    data: {
      organizationId,
      quoteLineItemId: lineItemId,
      title: payload.stage.title,
      sortOrder: stageSort,
      internalNotes: payload.stage.internalNotes,
    },
  });

  const tasksOrdered = sortTasksPayload(payload.tasks);
  for (let ti = 0; ti < tasksOrdered.length; ti++) {
    const tp = tasksOrdered[ti];
    const maxTk = await tx.quoteLineExecutionTask.aggregate({
      where: { stageId: stage.id, organizationId },
      _max: { sortOrder: true },
    });
    const taskSort = (maxTk._max.sortOrder ?? -1) + 1;
    await tx.quoteLineExecutionTask.create({
      data: {
        organizationId,
        stageId: stage.id,
        title: tp.title,
        description: tp.description,
        status: QuoteTaskStatus.NOT_READY,
        isRequired: Boolean(tp.isRequired),
        sortOrder: taskSort,
        assignedRole: tp.assignedRole,
        estimatedDurationMinutes: tp.estimatedDurationMinutes ?? null,
        customerVisible: Boolean(tp.customerVisible),
        customerLabel: tp.customerLabel,
        internalNotes: tp.internalNotes,
      },
    });
  }

  return { stageId: stage.id };
}

export async function materializeTask(params: {
  tx: Prisma.TransactionClient;
  organizationId: string;
  quoteId: string;
  stageId: string;
  payload: TaskOnlyPayload;
}): Promise<{ taskId: string }> {
  const { tx, organizationId, quoteId, stageId, payload } = params;

  const stage = await tx.quoteLineExecutionStage.findFirst({
    where: { id: stageId, organizationId },
    include: { quoteLineItem: true },
  });
  if (!stage || stage.quoteLineItem.quoteId !== quoteId) {
    throw new Error("Stage not found.");
  }

  const maxTk = await tx.quoteLineExecutionTask.aggregate({
    where: { stageId, organizationId },
    _max: { sortOrder: true },
  });
  const taskSort = (maxTk._max.sortOrder ?? -1) + 1;
  const tp = payload.task;

  const task = await tx.quoteLineExecutionTask.create({
    data: {
      organizationId,
      stageId,
      title: tp.title,
      description: tp.description,
      status: QuoteTaskStatus.NOT_READY,
      isRequired: Boolean(tp.isRequired),
      sortOrder: taskSort,
      assignedRole: tp.assignedRole,
      estimatedDurationMinutes: tp.estimatedDurationMinutes ?? null,
      customerVisible: Boolean(tp.customerVisible),
      customerLabel: tp.customerLabel,
      internalNotes: tp.internalNotes,
    },
  });

  return { taskId: task.id };
}
