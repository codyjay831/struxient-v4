import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";
import type { WorkPlanLineViewModel, WorkPlanPlannerMode, WorkPlanStageViewModel, WorkPlanTaskViewModel } from "./types";

const MODE: WorkPlanPlannerMode = "quote_proposed";

export type QuotePlanAdapterTask = {
  id: string;
  title: string;
  description: string | null;
  internalNotes: string | null;
  isRequired: boolean;
  customerVisible: boolean;
  customerLabel: string | null;
  assignedRole: string | null;
  sortOrder: number;
  completionRequirement: CompletionRequirementDto;
};

export type QuotePlanAdapterStage = {
  id: string;
  title: string;
  sortOrder: number;
  internalNotes: string | null;
  tasks: QuotePlanAdapterTask[];
};

export type QuotePlanAdapterLine = {
  id: string;
  title: string;
  executionStages: QuotePlanAdapterStage[];
};

function sortStages(stages: QuotePlanAdapterStage[]): QuotePlanAdapterStage[] {
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function sortTasks(tasks: QuotePlanAdapterTask[]): QuotePlanAdapterTask[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function toTaskView(lineId: string, stageId: string, t: QuotePlanAdapterTask): WorkPlanTaskViewModel {
  return {
    id: t.id,
    lineId,
    stageId,
    title: t.title,
    description: t.description,
    internalNotes: t.internalNotes,
    isRequired: t.isRequired,
    customerVisible: t.customerVisible,
    customerLabel: t.customerLabel,
    assignedRole: t.assignedRole,
    sortOrder: t.sortOrder,
    completionRequirement: t.completionRequirement,
    capabilities: {
      canReorderWithinStage: false,
      canArchive: false,
      canManageCompletionRequirements: true,
    },
    sourceQuoteTaskId: null,
    mode: MODE,
  };
}

function toStageView(lineId: string, s: QuotePlanAdapterStage): WorkPlanStageViewModel {
  return {
    id: s.id,
    lineId,
    title: s.title,
    internalNotes: s.internalNotes,
    sortOrder: s.sortOrder,
    tasks: sortTasks(s.tasks).map((t) => toTaskView(lineId, s.id, t)),
  };
}

/**
 * Normalizes quote line execution stages/tasks into the shared planner view model.
 */
export function adaptQuoteProposedPlanToViewModel(lines: QuotePlanAdapterLine[]): WorkPlanLineViewModel[] {
  return lines.map((line) => ({
    id: line.id,
    title: line.title,
    stages: sortStages(line.executionStages).map((s) => toStageView(line.id, s)),
  }));
}
