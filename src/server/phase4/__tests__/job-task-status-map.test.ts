import { JobTaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { initialJobTaskStatusFromSnapshot } from "@/server/phase4/job-task-status-map";

describe("initialJobTaskStatusFromSnapshot", () => {
  it("maps BLOCKED only; otherwise NOT_STARTED", () => {
    expect(initialJobTaskStatusFromSnapshot("BLOCKED")).toBe(JobTaskStatus.BLOCKED);
    expect(initialJobTaskStatusFromSnapshot("COMPLETE")).toBe(JobTaskStatus.NOT_STARTED);
    expect(initialJobTaskStatusFromSnapshot("NOT_READY")).toBe(JobTaskStatus.NOT_STARTED);
    expect(initialJobTaskStatusFromSnapshot("IN_PROGRESS")).toBe(JobTaskStatus.NOT_STARTED);
  });
});
