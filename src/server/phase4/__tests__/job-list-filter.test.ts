import { JobStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { parseJobListStatusParam } from "@/server/phase4/job-queries";

describe("parseJobListStatusParam", () => {
  it("parses known statuses case-insensitively", () => {
    expect(parseJobListStatusParam(undefined)).toBe("ALL");
    expect(parseJobListStatusParam("all")).toBe("ALL");
    expect(parseJobListStatusParam("active")).toBe(JobStatus.ACTIVE);
    expect(parseJobListStatusParam("PAUSED")).toBe(JobStatus.PAUSED);
    expect(parseJobListStatusParam("completed")).toBe(JobStatus.COMPLETED);
    expect(parseJobListStatusParam("canceled")).toBe(JobStatus.CANCELED);
  });

  it("falls back to ALL for unknown", () => {
    expect(parseJobListStatusParam("bogus")).toBe("ALL");
  });
});
