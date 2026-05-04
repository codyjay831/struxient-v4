import { describe, expect, it } from "vitest";
import { adaptJobWorkPlanReviewToViewModel, type JobPlanAdapterLine } from "../job-plan-adapter";
import { adaptQuoteProposedPlanToViewModel, type QuotePlanAdapterLine } from "../quote-plan-adapter";

const reqNone = { state: "none" as const };
const reqActive = { state: "active" as const, minAcceptedCount: 2, allowJobLevelEvidence: false };

describe("adaptQuoteProposedPlanToViewModel", () => {
  it("sorts stages and tasks deterministically", () => {
    const lines: QuotePlanAdapterLine[] = [
      {
        id: "L1",
        title: "Line A",
        executionStages: [
          {
            id: "S2",
            title: "Stage B",
            sortOrder: 2,
            internalNotes: null,
            tasks: [
              { id: "T2", title: "b", description: null, internalNotes: null, isRequired: false, customerVisible: false, customerLabel: null, assignedRole: null, sortOrder: 2, completionRequirement: reqNone },
              { id: "T1", title: "a", description: null, internalNotes: null, isRequired: true, customerVisible: true, customerLabel: "x", assignedRole: "CREW", sortOrder: 1, completionRequirement: reqActive },
            ],
          },
          {
            id: "S1",
            title: "Stage A",
            sortOrder: 1,
            internalNotes: "n",
            tasks: [],
          },
        ],
      },
    ];
    const vm = adaptQuoteProposedPlanToViewModel(lines);
    expect(vm).toHaveLength(1);
    expect(vm[0]!.stages.map((s) => s.id)).toEqual(["S1", "S2"]);
    expect(vm[0]!.stages[1]!.tasks.map((t) => t.id)).toEqual(["T1", "T2"]);
    expect(vm[0]!.stages[1]!.tasks[0]!.capabilities.canArchive).toBe(false);
    expect(vm[0]!.stages[1]!.tasks[0]!.capabilities.canReorderWithinStage).toBe(false);
    expect(vm[0]!.stages[1]!.tasks[0]!.mode).toBe("quote_proposed");
    expect(vm[0]!.stages[1]!.tasks[0]!.sourceQuoteTaskId).toBeNull();
  });
});

describe("adaptJobWorkPlanReviewToViewModel", () => {
  it("sorts and maps job capabilities", () => {
    const lines: JobPlanAdapterLine[] = [
      {
        id: "JL",
        title: "Job line",
        stages: [
          {
            id: "JS",
            title: "Stage",
            internalNotes: null,
            sortOrder: 0,
            tasks: [
              {
                id: "JT",
                title: "Task",
                description: null,
                internalNotes: null,
                isRequired: true,
                assignedRole: null,
                sourceQuoteTaskId: null,
                customerVisible: false,
                customerLabel: null,
                sortOrder: 0,
                completionRequirement: reqNone,
                canManageCompletionRequirements: true,
              },
            ],
          },
        ],
      },
    ];
    const vm = adaptJobWorkPlanReviewToViewModel(lines);
    expect(vm[0]!.stages[0]!.tasks[0]!.capabilities.canArchive).toBe(true);
    expect(vm[0]!.stages[0]!.tasks[0]!.capabilities.canReorderWithinStage).toBe(true);
    expect(vm[0]!.stages[0]!.tasks[0]!.sourceQuoteTaskId).toBeNull();
    expect(vm[0]!.stages[0]!.tasks[0]!.mode).toBe("job_work_plan_review");
  });

  it("preserves quote seed id when present", () => {
    const lines: JobPlanAdapterLine[] = [
      {
        id: "JL",
        title: "L",
        stages: [
          {
            id: "JS",
            title: "S",
            internalNotes: null,
            sortOrder: 0,
            tasks: [
              {
                id: "JT",
                title: "T",
                description: null,
                internalNotes: null,
                isRequired: false,
                assignedRole: null,
                sourceQuoteTaskId: "qt-1",
                customerVisible: false,
                customerLabel: null,
                sortOrder: 0,
                completionRequirement: reqNone,
                canManageCompletionRequirements: false,
              },
            ],
          },
        ],
      },
    ];
    const vm = adaptJobWorkPlanReviewToViewModel(lines);
    expect(vm[0]!.stages[0]!.tasks[0]!.sourceQuoteTaskId).toBe("qt-1");
    expect(vm[0]!.stages[0]!.tasks[0]!.capabilities.canManageCompletionRequirements).toBe(false);
  });
});
