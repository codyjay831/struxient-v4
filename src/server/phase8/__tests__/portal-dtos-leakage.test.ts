import { JobStatus, JobTaskStatus, ScheduledWorkStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  mapJobStatusForCustomer,
  mapJobTaskStatusForCustomer,
  mapScheduledWorkStatusForCustomer,
} from "../portal-customer-copy";
import { portalViewDTOSchema } from "../portal-dtos";

describe("portal DTOs and customer-facing labels", () => {
  it("serialized portal view rejects forbidden substrings", () => {
    const view = portalViewDTOSchema.parse({
      context: {
        organizationDisplayName: "Acme Electric",
        customerDisplayName: "Jane Homeowner",
        projectTitle: "Panel upgrade",
        serviceAddressSummary: "123 Main St",
        contactLines: ["Phone: 555-0100"],
      },
      quote: {
        organizationName: "Acme Electric",
        quoteTitle: "Panel upgrade",
        displayNumber: 12,
        customerDisplayName: "Jane Homeowner",
        serviceAddressSummary: "123 Main St",
        scopeSummary: null,
        scopeIntent: "Upgrade service",
        customerFacingIntro: "Thank you for the opportunity.",
        lineItems: [
          {
            title: "Panel",
            customerDescription: "Replace panel",
            quantityDisplay: "1",
            pricingPresentation: "$100 total ($100.00 × 1)",
            customerVisibleAssumptions: [],
            customerVisibleExecutionHighlights: [],
          },
        ],
        customerVisibleQuoteAssumptions: [],
        plannedCustomerHighlights: [],
        subtotalCents: 10000,
        totalCents: 10000,
        statusLabel: "Proposal sent",
        asOf: new Date().toISOString(),
      },
      project: {
        jobDisplayNumber: 3,
        title: "Panel upgrade",
        statusLabel: "In progress",
        milestoneItems: [
          { label: "Permitting", stateLabel: "In progress", sortKey: 1 },
        ],
        progress: { completed: 0, total: 1 },
      },
      schedule: [
        {
          label: "Permitting",
          scheduledStartAt: new Date("2026-06-01T14:00:00.000Z").toISOString(),
          scheduledEndAt: new Date("2026-06-01T16:00:00.000Z").toISOString(),
          statusLabel: "Scheduled",
          isCanceled: false,
        },
      ],
      whatHappensNext: "We will update this page as work progresses.",
    });

    const serialized = JSON.stringify(view);
    const forbidden = [
      "internalExecutionPlan",
      "sourceSnapshotJson",
      "sentSnapshotJson",
      "internalNotes",
      "assignedRole",
      "blockedReason",
      "JobActivityEvent",
      "QuoteActivityEvent",
      "completionRequirementsJson",
      "tokenHash",
      "cancelReason",
      "CustomerPortalSubmission",
      "customerPortalSubmission",
      "JobEvidence",
      "jobEvidence",
      "sourceAttachmentId",
      "storageKey",
    ];
    for (const f of forbidden) {
      expect(serialized.toLowerCase()).not.toContain(f.toLowerCase());
    }
  });

  it("maps job and task statuses to customer copy", () => {
    expect(mapJobStatusForCustomer(JobStatus.ACTIVE)).toBe("In progress");
    expect(mapJobTaskStatusForCustomer(JobTaskStatus.BLOCKED)).toBe("Waiting");
    expect(mapScheduledWorkStatusForCustomer(ScheduledWorkStatus.CANCELED)).toBe("Canceled");
  });
});
