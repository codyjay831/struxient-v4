import { JobStatus, JobTaskStatus } from "@prisma/client";

import { parseJobTaskCompletionRequirements, toCompletionRequirementDto } from "@/server/phase13/completion-requirements";

export type WorkPlanReviewSummaryTaskInput = {
  status: JobTaskStatus;
  isRequired: boolean;
  assignedRole: string | null;
  customerVisible: boolean;
  customerLabel: string | null;
  sourceQuoteTaskId: string | null;
  completionRequirementsJson: unknown;
};

export type WorkPlanReviewSummaryInput = {
  jobStatus: JobStatus;
  /** Active (non-archived) tasks grouped by stage */
  lines: Array<{
    stages: Array<{
      id: string;
      tasks: WorkPlanReviewSummaryTaskInput[];
    }>;
  }>;
  archivedTaskCount: number;
  jobUpdatedAt: Date;
};

export type WorkPlanReviewChecklistTier = "required" | "recommended" | "optional";

export type WorkPlanReviewChecklistItem = {
  id: string;
  tier: WorkPlanReviewChecklistTier;
  label: string;
  ok: boolean;
  hint?: string;
};

export type WorkPlanReviewSummary = {
  activeTaskCount: number;
  archivedTaskCount: number;
  requiredTaskCount: number;
  optionalTaskCount: number;
  customerVisibleTaskCount: number;
  stageCount: number;
  stagesWithNoActiveTasksCount: number;
  /** Required tasks with no evidence requirement configured, plus tasks with invalid requirement JSON */
  tasksMissingCompletionRequirementsCount: number;
  tasksWithInvalidCompletionRequirementsCount: number;
  tasksWithoutAssignedRoleCount: number;
  manuallyAddedTaskCount: number;
  hardBlockers: string[];
  recommendations: string[];
  checklist: WorkPlanReviewChecklistItem[];
  /** True when activation should be allowed from a data perspective (server remains final authority). */
  readyToActivate: boolean;
  /** Prefer disabling the Activate CTA only for empty active plan (client hint). */
  clientDisableActivate: boolean;
  clientDisableActivateReason: string | null;
  jobUpdatedAtIso: string;
};

function flattenTasks(input: WorkPlanReviewSummaryInput): WorkPlanReviewSummaryTaskInput[] {
  const out: WorkPlanReviewSummaryTaskInput[] = [];
  for (const line of input.lines) {
    for (const stage of line.stages) {
      for (const t of stage.tasks) {
        out.push(t);
      }
    }
  }
  return out;
}

/**
 * Server-derived counts and readiness hints for the Work Plan Review job page.
 * Aligns hard blockers with `jobMutationActivateExecution` where practical.
 */
export function computeWorkPlanReviewSummary(input: WorkPlanReviewSummaryInput): WorkPlanReviewSummary {
  const tasks = flattenTasks(input);
  const activeTaskCount = tasks.length;

  let requiredTaskCount = 0;
  let optionalTaskCount = 0;
  let customerVisibleTaskCount = 0;
  let manuallyAddedTaskCount = 0;
  let tasksWithoutAssignedRoleCount = 0;
  let tasksMissingCompletionRequirementsCount = 0;
  let tasksWithInvalidCompletionRequirementsCount = 0;
  let hasBadExecutionStatus = false;

  for (const t of tasks) {
    if (t.isRequired) {
      requiredTaskCount += 1;
    } else {
      optionalTaskCount += 1;
    }
    if (t.customerVisible) {
      customerVisibleTaskCount += 1;
    }
    if (t.sourceQuoteTaskId === null) {
      manuallyAddedTaskCount += 1;
    }
    if (!t.assignedRole?.trim()) {
      tasksWithoutAssignedRoleCount += 1;
    }
    if (t.status === JobTaskStatus.IN_PROGRESS || t.status === JobTaskStatus.COMPLETE) {
      hasBadExecutionStatus = true;
    }

    const dto = toCompletionRequirementDto(parseJobTaskCompletionRequirements(t.completionRequirementsJson));
    if (dto.state === "invalid") {
      tasksWithInvalidCompletionRequirementsCount += 1;
    }
    if (t.isRequired && dto.state === "none") {
      tasksMissingCompletionRequirementsCount += 1;
    }
  }

  let stageCount = 0;
  let stagesWithNoActiveTasksCount = 0;
  for (const line of input.lines) {
    for (const stage of line.stages) {
      stageCount += 1;
      if (stage.tasks.length === 0) {
        stagesWithNoActiveTasksCount += 1;
      }
    }
  }

  const hardBlockers: string[] = [];
  if (input.jobStatus !== JobStatus.WORK_PLAN_REVIEW) {
    hardBlockers.push("Only a job in Work Plan Review can be activated from this flow.");
  }
  if (activeTaskCount === 0) {
    hardBlockers.push("Add at least one active task before activating. Restore a task from archive if needed.");
  }
  if (hasBadExecutionStatus) {
    hardBlockers.push(
      "One or more tasks are already in progress or complete. Reset them to “Not started” before activating.",
    );
  }

  const recommendations: string[] = [];
  if (requiredTaskCount === 0 && activeTaskCount > 0) {
    recommendations.push("No tasks are marked required. That is fine; mark critical path items as required if it helps your crew.");
  }
  if (tasksWithoutAssignedRoleCount > 0) {
    recommendations.push(
      `${tasksWithoutAssignedRoleCount} task${tasksWithoutAssignedRoleCount === 1 ? "" : "s"} ha${tasksWithoutAssignedRoleCount === 1 ? "s" : "ve"} no assigned role. You can fill that in now or later.`,
    );
  }
  if (customerVisibleTaskCount === 0 && activeTaskCount > 0) {
    recommendations.push("No customer-visible milestones yet. Use that when you want labeled progress on the customer portal.");
  }
  let visibleWithoutLabel = 0;
  for (const t of tasks) {
    if (t.customerVisible && !t.customerLabel?.trim()) {
      visibleWithoutLabel += 1;
    }
  }
  if (visibleWithoutLabel > 0) {
    recommendations.push(
      `${visibleWithoutLabel} customer-visible task${visibleWithoutLabel === 1 ? "" : "s"} ${visibleWithoutLabel === 1 ? "needs" : "need"} a short customer label for the portal.`,
    );
  }
  if (stagesWithNoActiveTasksCount > 0) {
    recommendations.push(
      `${stagesWithNoActiveTasksCount} stage${stagesWithNoActiveTasksCount === 1 ? "" : "s"} ${stagesWithNoActiveTasksCount === 1 ? "has" : "have"} no active tasks. Add tasks or archive unused stages later if needed.`,
    );
  }
  const reqIssues = tasksMissingCompletionRequirementsCount + tasksWithInvalidCompletionRequirementsCount;
  if (reqIssues > 0) {
    recommendations.push(
      `${reqIssues} task${reqIssues === 1 ? "" : "s"} ${reqIssues === 1 ? "needs" : "need"} completion requirements fixed or added (required tasks should have evidence rules when you want proof of work).`,
    );
  }
  if (input.archivedTaskCount > 0) {
    recommendations.push(
      `${input.archivedTaskCount} archived task${input.archivedTaskCount === 1 ? "" : "s"} ${input.archivedTaskCount === 1 ? "is" : "are"} hidden from the active plan and excluded from activation baseline.`,
    );
  }

  const checklist: WorkPlanReviewChecklistItem[] = [];

  checklist.push({
    id: "has-active-tasks",
    tier: "required",
    label: "At least one active task on the job",
    ok: activeTaskCount > 0,
    hint: activeTaskCount === 0 ? "Activation is blocked until the plan has work to perform." : undefined,
  });

  checklist.push({
    id: "task-status-clean",
    tier: "required",
    label: "No tasks in progress or complete yet",
    ok: !hasBadExecutionStatus,
    hint: hasBadExecutionStatus
      ? "Activation is blocked while any task is in progress or already marked complete."
      : undefined,
  });

  const completionJsonOk = tasksWithInvalidCompletionRequirementsCount === 0;
  checklist.push({
    id: "completion-json-valid",
    tier: "required",
    label: "Completion requirement data is valid JSON",
    ok: completionJsonOk,
    hint: tasksWithInvalidCompletionRequirementsCount
      ? "Fix invalid completion requirement JSON on the marked tasks."
      : undefined,
  });

  checklist.push({
    id: "required-requirements",
    tier: "recommended",
    label: "Required tasks have evidence / completion rules when you expect proof",
    ok: tasksMissingCompletionRequirementsCount === 0,
    hint:
      tasksMissingCompletionRequirementsCount > 0
        ? "Recommended: add requirements so crews know what to document. Not required to click Activate."
        : undefined,
  });

  checklist.push({
    id: "reviewed-plan",
    tier: "recommended",
    label: "Walk the stages and confirm titles, instructions, and requirements",
    ok: true,
    hint: "Recommended, not required. Activation still saves whatever is on the plan today.",
  });

  checklist.push({
    id: "required-identified",
    tier: "recommended",
    label: "Critical work marked as required where it helps",
    ok: requiredTaskCount > 0 || activeTaskCount === 0,
    hint:
      requiredTaskCount === 0 && activeTaskCount > 0
        ? "Optional: mark must-do items as required so progress reporting stays honest."
        : undefined,
  });

  checklist.push({
    id: "customer-milestones",
    tier: "recommended",
    label: "Customer-visible milestones have labels when you use the portal",
    ok: visibleWithoutLabel === 0,
    hint:
      visibleWithoutLabel > 0
        ? "Add a short label for each visible milestone so customers see clear names."
        : undefined,
  });

  checklist.push({
    id: "assignments-flex",
    tier: "optional",
    label: "Assignments can be finished now or after activation",
    ok: true,
    hint: "Roles are helpful but not required to activate.",
  });

  const readyToActivate = hardBlockers.length === 0;
  const clientDisableActivate = activeTaskCount === 0 && input.jobStatus === JobStatus.WORK_PLAN_REVIEW;
  const clientDisableActivateReason =
    clientDisableActivate
      ? "Add at least one task to the work plan before activating execution."
      : null;

  return {
    activeTaskCount,
    archivedTaskCount: input.archivedTaskCount,
    requiredTaskCount,
    optionalTaskCount,
    customerVisibleTaskCount,
    stageCount,
    stagesWithNoActiveTasksCount,
    tasksMissingCompletionRequirementsCount,
    tasksWithInvalidCompletionRequirementsCount,
    tasksWithoutAssignedRoleCount,
    manuallyAddedTaskCount,
    hardBlockers,
    recommendations,
    checklist,
    readyToActivate,
    clientDisableActivate,
    clientDisableActivateReason,
    jobUpdatedAtIso: input.jobUpdatedAt.toISOString(),
  };
}
