import { JobStatus, JobTaskStatus, QuoteStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildPortalWhatHappensNext,
  customerPortalQuoteStatusLabel,
  isJobPendingActivationPortal,
  mapJobStatusForCustomer,
  mapJobTaskStatusForCustomer,
  PORTAL_JOB_PENDING_ACTIVATION_STATUS_VALUE,
} from "../portal-customer-copy";

describe("portal-customer-copy (Decision 1 — customer-safe status)", () => {
  it("ACCEPTED without a linked job stays 'Proposal accepted'", () => {
    expect(
      customerPortalQuoteStatusLabel(QuoteStatus.ACCEPTED, { hasLinkedJob: false, jobStatus: null }),
    ).toBe("Proposal accepted");
  });

  it("ACCEPTED with linked job but execution not live uses preparing copy (future JobStatus.PENDING_ACTIVATION)", () => {
    // Cast until Prisma exposes JobStatus.PENDING_ACTIVATION; runtime string stays aligned with enum value.
    const pending = PORTAL_JOB_PENDING_ACTIVATION_STATUS_VALUE as JobStatus;
    expect(isJobPendingActivationPortal(pending)).toBe(true);
    expect(mapJobStatusForCustomer(pending)).toBe("We're preparing your project.");
    expect(
      customerPortalQuoteStatusLabel(QuoteStatus.ACCEPTED, { hasLinkedJob: true, jobStatus: pending }),
    ).toBe("We're preparing your project.");
  });

  it("ACCEPTED + live execution shows project active (does not say preparing)", () => {
    expect(
      customerPortalQuoteStatusLabel(QuoteStatus.ACCEPTED, {
        hasLinkedJob: true,
        jobStatus: JobStatus.ACTIVE,
      }),
    ).toBe("Project active");
    expect(mapJobStatusForCustomer(JobStatus.ACTIVE)).toBe("In progress");
  });

  it("ACTIVATED quote headline stays work underway", () => {
    expect(
      customerPortalQuoteStatusLabel(QuoteStatus.ACTIVATED, { hasLinkedJob: true, jobStatus: JobStatus.ACTIVE }),
    ).toBe("Work underway");
  });

  it("whatHappensNext does not imply visits are scheduled when schedule list is empty", () => {
    const activeNoSchedule = buildPortalWhatHappensNext({
      quoteStatus: QuoteStatus.ACTIVATED,
      jobStatus: JobStatus.ACTIVE,
      scheduleCount: 0,
    });
    expect(activeNoSchedule.toLowerCase()).not.toContain("scheduled");
    expect(activeNoSchedule).toContain("visit");

    const preparing = buildPortalWhatHappensNext({
      quoteStatus: QuoteStatus.ACCEPTED,
      jobStatus: PORTAL_JOB_PENDING_ACTIVATION_STATUS_VALUE as JobStatus,
      scheduleCount: 0,
    });
    expect(preparing.toLowerCase()).not.toContain("in progress");
    expect(preparing.toLowerCase()).not.toContain("active");
    expect(preparing).toContain("preparing");
  });

  it("mapJobTaskStatusForCustomer default avoids implying in progress", () => {
    const unknown = "FUTURE_STATUS" as JobTaskStatus;
    expect(mapJobTaskStatusForCustomer(unknown)).toBe("Not started");
  });
});
