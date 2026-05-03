import { JobTaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { reduceTasksToProgress } from "@/server/phase5/job-progress";

describe("reduceTasksToProgress", () => {
  it("counts required completion and by status", () => {
    const tasks = [
      { status: JobTaskStatus.COMPLETE, isRequired: true },
      { status: JobTaskStatus.IN_PROGRESS, isRequired: true },
      { status: JobTaskStatus.NOT_STARTED, isRequired: false },
    ];
    const p = reduceTasksToProgress(tasks);
    expect(p.totalTasks).toBe(3);
    expect(p.requiredTotal).toBe(2);
    expect(p.requiredComplete).toBe(1);
    expect(p.byStatus[JobTaskStatus.COMPLETE]).toBe(1);
    expect(p.byStatus[JobTaskStatus.IN_PROGRESS]).toBe(1);
    expect(p.byStatus[JobTaskStatus.NOT_STARTED]).toBe(1);
  });
});
