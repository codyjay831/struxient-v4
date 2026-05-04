import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";
import type { WorkPlanLineViewModel, WorkPlanPlannerMode, WorkPlanStageViewModel, WorkPlanTaskViewModel } from "./types";

const MODE: WorkPlanPlannerMode = "job_work_plan_review";

export type JobPlanAdapterTask = {
  id: string;
  title: string;
  description: string | null;
  internalNotes: string | null;
  isRequired: boolean;
  assignedRole: string | null;
  sourceQuoteTaskId?: string | null;
  customerVisible: boolean;
  customerLabel: string | null;
  sortOrder: number;
  completionRequirement: CompletionRequirementDto;
  canManageCompletionRequirements: boolean;
};

export type JobPlanAdapterStage = {
  id: string;
  title: string;
  internalNotes: string | null;
  sortOrder: number;
  tasks: JobPlanAdapterTask[];
};

export type JobPlanAdapterLine = {
  id: string;
  title: string;
  stages: JobPlanAdapterStage[];
};

function sortStages(stages: JobPlanAdapterStage[]): JobPlanAdapterStage[] {
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function sortTasks(tasks: JobPlanAdapterTask[]): JobPlanAdapterTask[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function toTaskView(lineId: string, stageId: string, t: JobPlanAdapterTask): WorkPlanTaskViewModel {
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
      canReorderWithinStage: true,
      canArchive: true,
      canManageCompletionRequirements: t.canManageCompletionRequirements,
    },
    sourceQuoteTaskId: t.sourceQuoteTaskId ?? null,
    mode: MODE,
  };
}

function toStageView(lineId: string, s: JobPlanAdapterStage): WorkPlanStageViewModel {
  return {
    id: s.id,
    lineId,
    title: s.title,
    internalNotes: s.internalNotes,
    sortOrder: s.sortOrder,
    tasks: sortTasks(s.tasks).map((task) => toTaskView(lineId, s.id, task)),
  };
}

/**
 * Normalizes job work-plan review lines (JobLine → stages → tasks) into the shared planner view model.
 */
export function adaptJobWorkPlanReviewToViewModel(lines: JobPlanAdapterLine[]): WorkPlanLineViewModel[] {
  return lines.map((line) => ({
    id: line.id,
    title: line.title,
    stages: sortStages(line.stages).map((s) => toStageView(line.id, s)),
  }));
}
