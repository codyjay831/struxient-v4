import { JobTaskStatus, MembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isAllowedJobTaskStatusTransition } from "@/server/phase5/job-task-transitions";

describe("isAllowedJobTaskStatusTransition", () => {
  it("allows matrix transitions for field role", () => {
    const role = MembershipRole.FIELD_WORKER;
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.NOT_STARTED, JobTaskStatus.READY, role)).toBe(true);
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.READY, JobTaskStatus.IN_PROGRESS, role)).toBe(true);
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.IN_PROGRESS, JobTaskStatus.COMPLETE, role)).toBe(true);
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.BLOCKED, JobTaskStatus.READY, role)).toBe(true);
  });

  it("denies arbitrary jumps", () => {
    const role = MembershipRole.OFFICE;
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.NOT_STARTED, JobTaskStatus.COMPLETE, role)).toBe(false);
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.READY, JobTaskStatus.COMPLETE, role)).toBe(false);
  });

  it("denies COMPLETE → IN_PROGRESS for field/crew", () => {
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.COMPLETE, JobTaskStatus.IN_PROGRESS, MembershipRole.FIELD_WORKER)).toBe(
      false,
    );
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.COMPLETE, JobTaskStatus.IN_PROGRESS, MembershipRole.CREW_LEAD)).toBe(
      false,
    );
  });

  it("allows COMPLETE → IN_PROGRESS for office band", () => {
    for (const role of [
      MembershipRole.OWNER,
      MembershipRole.ADMIN,
      MembershipRole.MANAGER,
      MembershipRole.OFFICE,
    ] as const) {
      expect(isAllowedJobTaskStatusTransition(JobTaskStatus.COMPLETE, JobTaskStatus.IN_PROGRESS, role)).toBe(true);
    }
  });

  it("allows same status as no-op target", () => {
    expect(isAllowedJobTaskStatusTransition(JobTaskStatus.IN_PROGRESS, JobTaskStatus.IN_PROGRESS, MembershipRole.FIELD_WORKER)).toBe(
      true,
    );
  });
});
