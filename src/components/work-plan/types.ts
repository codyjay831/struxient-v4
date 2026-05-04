import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";

/**
 * Where the shared planner UI is mounted. Drives capability flags and copy slots.
 */
export type WorkPlanPlannerMode = "quote_proposed" | "job_work_plan_review" | "job_active_execution";

export type WorkPlanTaskCapabilityFlags = {
  canReorderWithinStage: boolean;
  canArchive: boolean;
  canManageCompletionRequirements: boolean;
};

export type WorkPlanTaskViewModel = {
  id: string;
  lineId: string;
  stageId: string;
  title: string;
  description: string | null;
  internalNotes: string | null;
  isRequired: boolean;
  customerVisible: boolean;
  customerLabel: string | null;
  assignedRole: string | null;
  sortOrder: number;
  completionRequirement: CompletionRequirementDto;
  capabilities: WorkPlanTaskCapabilityFlags;
  /** Job: seeded from quote snapshot vs added in WPR. Quote: always null. */
  sourceQuoteTaskId: string | null;
  mode: WorkPlanPlannerMode;
};

export type WorkPlanStageViewModel = {
  id: string;
  lineId: string;
  title: string;
  internalNotes: string | null;
  sortOrder: number;
  tasks: WorkPlanTaskViewModel[];
};

export type WorkPlanLineViewModel = {
  id: string;
  title: string;
  stages: WorkPlanStageViewModel[];
};
