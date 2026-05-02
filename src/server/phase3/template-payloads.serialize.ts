import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNs, QuoteWorkTemplateKind } from "@prisma/client";
import type {
  LineItemWithPlanPayload,
  StageWithTasksPayload,
  TaskOnlyPayload,
} from "@/server/phase3/template-payloads";
import { normalizePayloadJson } from "@/server/phase3/template-payloads";

type LineWithStages = Prisma.QuoteLineItemGetPayload<{
  include: {
    executionStages: {
      include: { tasks: true };
    };
  };
}>;

type StageWithTasks = Prisma.QuoteLineExecutionStageGetPayload<{
  include: { tasks: true };
}>;

type ExecTask = Prisma.QuoteLineExecutionTaskGetPayload<object>;

function sortedStages(line: LineWithStages) {
  return [...line.executionStages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function sortedTasks(stage: StageWithTasks) {
  return [...stage.tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function taskToPayload(t: ExecTask) {
  return {
    title: t.title.trim(),
    description: t.description?.trim() ? t.description.trim() : null,
    isRequired: t.isRequired,
    sortOrder: t.sortOrder,
    assignedRole: t.assignedRole?.trim() ? t.assignedRole.trim() : null,
    estimatedDurationMinutes: t.estimatedDurationMinutes,
    customerVisible: t.customerVisible,
    customerLabel: t.customerLabel?.trim() ? t.customerLabel.trim() : null,
    internalNotes: t.internalNotes?.trim() ? t.internalNotes.trim() : null,
  };
}

export function buildLineItemWithPlanPayloadFromLine(line: LineWithStages): LineItemWithPlanPayload {
  const qty = Number(line.quantity);
  const payload: LineItemWithPlanPayload = {
    line: {
      title: line.title.trim(),
      customerDescription: line.customerDescription.trim(),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      pricingMode: line.pricingMode,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      lineMode: line.lineMode,
      internalNotes: line.internalNotes?.trim() ? line.internalNotes.trim() : null,
    },
    stages: sortedStages(line).map((s) => ({
      title: s.title.trim(),
      internalNotes: s.internalNotes?.trim() ? s.internalNotes.trim() : null,
      sortOrder: s.sortOrder,
      tasks: sortedTasks(s).map(taskToPayload),
    })),
  };
  normalizePayloadJson(QuoteWorkTemplateKind.LINE_ITEM_WITH_PLAN, payload);
  return payload;
}

export function buildStageWithTasksPayloadFromStage(stage: StageWithTasks): StageWithTasksPayload {
  const payload: StageWithTasksPayload = {
    stage: {
      title: stage.title.trim(),
      internalNotes: stage.internalNotes?.trim() ? stage.internalNotes.trim() : null,
    },
    tasks: sortedTasks(stage).map(taskToPayload),
  };
  normalizePayloadJson(QuoteWorkTemplateKind.STAGE_WITH_TASKS, payload);
  return payload;
}

export function buildTaskPayloadFromTask(task: ExecTask): TaskOnlyPayload {
  const payload: TaskOnlyPayload = { task: taskToPayload(task) };
  normalizePayloadJson(QuoteWorkTemplateKind.TASK, payload);
  return payload;
}

/** Ensures JSON is safe for Prisma Json column (no Decimal, Date, etc.). */
export function payloadToJsonValue(payload: unknown): PrismaNs.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as PrismaNs.InputJsonValue;
}
