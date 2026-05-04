import { JobStatus, JobTaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeWorkPlanReviewSummary } from "@/server/phase4/work-plan-review-summary";

const baseTask = {
  status: JobTaskStatus.NOT_STARTED,
  isRequired: true,
  assignedRole: "CREW_LEAD",
  customerVisible: false,
  customerLabel: null,
  sourceQuoteTaskId: "qt-1",
  completionRequirementsJson: {
    version: 1,
    evidence: { required: true, minAcceptedCount: 1, allowJobLevelEvidence: false },
  },
};

function oneStageOneTask(task: Record<string, unknown>) {
  return {
    jobStatus: JobStatus.WORK_PLAN_REVIEW,
    archivedTaskCount: 0,
    jobUpdatedAt: new Date("2026-05-01T12:00:00.000Z"),
    lines: [
      {
        stages: [
          {
            id: "s1",
            tasks: [{ ...baseTask, ...task }],
          },
        ],
      },
    ],
  };
}

describe("computeWorkPlanReviewSummary", () => {
  it("counts active, required, optional, customer-visible, manually added", () => {
    const s = computeWorkPlanReviewSummary({
      jobStatus: JobStatus.WORK_PLAN_REVIEW,
      archivedTaskCount: 2,
      jobUpdatedAt: new Date("2026-05-01T12:00:00.000Z"),
      lines: [
        {
          stages: [
            {
              id: "a",
              tasks: [
                {
                  ...baseTask,
                  isRequired: true,
                  customerVisible: true,
                  customerLabel: "M1",
                  sourceQuoteTaskId: "x",
                },
                {
                  ...baseTask,
                  isRequired: false,
                  customerVisible: false,
                  sourceQuoteTaskId: null,
                  assignedRole: null,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(s.activeTaskCount).toBe(2);
    expect(s.requiredTaskCount).toBe(1);
    expect(s.optionalTaskCount).toBe(1);
    expect(s.customerVisibleTaskCount).toBe(1);
    expect(s.manuallyAddedTaskCount).toBe(1);
    expect(s.archivedTaskCount).toBe(2);
    expect(s.tasksWithoutAssignedRoleCount).toBe(1);
    expect(s.readyToActivate).toBe(true);
    expect(s.clientDisableActivate).toBe(false);
  });

  it("excludes archived from active counts (caller passes active tasks only)", () => {
    const s = computeWorkPlanReviewSummary(oneStageOneTask({}));
    expect(s.activeTaskCount).toBe(1);
  });

  it("hard blocker when zero active tasks", () => {
    const s = computeWorkPlanReviewSummary({
      jobStatus: JobStatus.WORK_PLAN_REVIEW,
      archivedTaskCount: 3,
      jobUpdatedAt: new Date(),
      lines: [{ stages: [{ id: "empty", tasks: [] }] }],
    });
    expect(s.activeTaskCount).toBe(0);
    expect(s.hardBlockers.length).toBeGreaterThan(0);
    expect(s.readyToActivate).toBe(false);
    expect(s.clientDisableActivate).toBe(true);
    expect(s.clientDisableActivateReason).toBeTruthy();
  });

  it("hard blocker when task is in progress or complete", () => {
    const s1 = computeWorkPlanReviewSummary(oneStageOneTask({ status: JobTaskStatus.IN_PROGRESS }));
    expect(s1.hardBlockers.some((b) => /progress|complete/i.test(b))).toBe(true);
    expect(s1.readyToActivate).toBe(false);

    const s2 = computeWorkPlanReviewSummary(oneStageOneTask({ status: JobTaskStatus.COMPLETE }));
    expect(s2.readyToActivate).toBe(false);
  });

  it("counts missing completion requirements for required tasks with none", () => {
    const s = computeWorkPlanReviewSummary(
      oneStageOneTask({
        completionRequirementsJson: null,
        isRequired: true,
      }),
    );
    expect(s.tasksMissingCompletionRequirementsCount).toBe(1);
    expect(s.tasksWithInvalidCompletionRequirementsCount).toBe(0);
  });

  it("counts invalid completion requirements", () => {
    const s = computeWorkPlanReviewSummary(
      oneStageOneTask({
        isRequired: false,
        completionRequirementsJson: { version: 1, evidence: { required: true } },
      }),
    );
    expect(s.tasksWithInvalidCompletionRequirementsCount).toBe(1);
    expect(s.checklist.find((c) => c.id === "completion-json-valid")?.ok).toBe(false);
  });

  it("recommends when no required tasks but has active tasks", () => {
    const s = computeWorkPlanReviewSummary(
      oneStageOneTask({
        isRequired: false,
      }),
    );
    expect(s.recommendations.some((r) => /no tasks are marked required/i.test(r))).toBe(true);
  });

  it("counts stages with no active tasks", () => {
    const s = computeWorkPlanReviewSummary({
      jobStatus: JobStatus.WORK_PLAN_REVIEW,
      archivedTaskCount: 0,
      jobUpdatedAt: new Date(),
      lines: [
        {
          stages: [
            { id: "s1", tasks: [{ ...baseTask }] },
            { id: "s2", tasks: [] },
          ],
        },
      ],
    });
    expect(s.stageCount).toBe(2);
    expect(s.stagesWithNoActiveTasksCount).toBe(1);
  });

  it("activation still logically ready when only recommendations apply", () => {
    const s = computeWorkPlanReviewSummary(
      oneStageOneTask({
        isRequired: false,
        assignedRole: null,
        customerVisible: false,
      }),
    );
    expect(s.hardBlockers).toEqual([]);
    expect(s.readyToActivate).toBe(true);
    expect(s.recommendations.length).toBeGreaterThan(0);
  });
});
