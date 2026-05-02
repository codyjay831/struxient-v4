import { describe, expect, it } from "vitest";

import {

  PricingMode,

  QuoteAssumptionVisibility,

  QuoteLineMode,

  QuoteStatus,

  QuoteTaskStatus,

} from "@prisma/client";

import {

  buildInternalExecutionPlanFromLineItems,

  buildQuoteCustomerPreviewDTO,

  getQuotePreviewForWorkspace,

  parseSentSnapshotInternalExecutionPlan,

  parseSentSnapshotPreviewDto,

  parseValidatedSentQuoteSnapshot,

  parseValidatedSentQuoteSnapshotV1,

} from "../customer-preview";



describe("buildQuoteCustomerPreviewDTO", () => {

  it("excludes internal-only assumptions from preview", () => {

    const dto = buildQuoteCustomerPreviewDTO({

      organizationName: "Acme Co",

      quote: {

        title: "Kitchen",

        displayNumber: 3,

        status: QuoteStatus.DRAFT,

        serviceAddressText: "123 Main",

        serviceAddressTbd: false,

        scopeSummary: null,

        scopeIntent: "Remodel",

        customerFacingIntro: "Thanks for the opportunity.",

        pricingSubtotalCents: 5000,

        totalCents: 5000,

      },

      customer: { displayName: "Jane" },

      lineItems: [

        {

          id: "l1",

          title: "Cabinets",

          customerDescription: "New cabinets",

          quantity: { toString: () => "1" } as never,

          pricingMode: PricingMode.FIXED_PRICE,

          unitPriceCents: 5000,

          lineTotalCents: 5000,

          lineMode: QuoteLineMode.REQUIRED,

          executionStages: [

            {

              tasks: [{ customerVisible: true, customerLabel: "Permitting" }],

            },

          ],

        },

      ],

      assumptions: [

        { quoteLineItemId: null, visibility: QuoteAssumptionVisibility.INTERNAL_ONLY, text: "Secret margin note" },

        { quoteLineItemId: null, visibility: QuoteAssumptionVisibility.CUSTOMER_VISIBLE, text: "Drywall patch excluded" },

      ],

    });

    const joined = [

      ...dto.customerVisibleQuoteAssumptions,

      ...dto.lineItems.flatMap((l) => l.customerVisibleAssumptions),

    ].join(" ");

    expect(joined).not.toMatch(/Secret/);

    expect(joined).toMatch(/Drywall/);

    expect(dto.lineItems[0]?.customerVisibleExecutionHighlights?.map((x) => x.label)).toContain("Permitting");

    expect(dto.plannedCustomerHighlights).toHaveLength(0);

  });



  it("getQuotePreviewForWorkspace: DRAFT uses live builder", () => {

    const liveParams = {

      organizationName: "Acme Co",

      quote: {

        title: "Kitchen",

        displayNumber: 3,

        status: QuoteStatus.DRAFT,

        serviceAddressText: "123 Main",

        serviceAddressTbd: false,

        scopeSummary: null,

        scopeIntent: "Remodel",

        customerFacingIntro: null,

        pricingSubtotalCents: 5000,

        totalCents: 5000,

      },

      customer: { displayName: "Jane" },

      lineItems: [

        {

          id: "l1",

          title: "Cabinets",

          customerDescription: "New cabinets",

          quantity: { toString: () => "1" } as never,

          pricingMode: PricingMode.FIXED_PRICE,

          unitPriceCents: 5000,

          lineTotalCents: 5000,

          lineMode: QuoteLineMode.REQUIRED,

        },

      ],

      assumptions: [],

    };

    const r = getQuotePreviewForWorkspace({

      quoteStatus: QuoteStatus.DRAFT,

      sentSnapshotJson: null,

      liveParams,

    });

    expect(r.kind).toBe("live");

    if (r.kind === "live") expect(r.preview.quoteTitle).toBe("Kitchen");

  });



  it("getQuotePreviewForWorkspace: SENT uses frozen snapshot only", () => {

    const preview = buildQuoteCustomerPreviewDTO({

      organizationName: "Acme Co",

      quote: {

        title: "Frozen title",

        displayNumber: 9,

        status: QuoteStatus.SENT,

        serviceAddressText: "1",

        serviceAddressTbd: false,

        scopeSummary: null,

        scopeIntent: "S",

        customerFacingIntro: null,

        pricingSubtotalCents: 100,

        totalCents: 100,

      },

      customer: { displayName: "Bob" },

      lineItems: [

        {

          id: "l1",

          title: "Frozen line",

          customerDescription: "D",

          quantity: { toString: () => "1" } as never,

          pricingMode: PricingMode.FIXED_PRICE,

          unitPriceCents: 100,

          lineTotalCents: 100,

          lineMode: QuoteLineMode.REQUIRED,

        },

      ],

      assumptions: [],

    });

    const snapshot = { version: 1 as const, preview };

    const liveParams = {

      organizationName: "WRONG_ORG",

      quote: {

        title: "Live title should not appear",

        displayNumber: 9,

        status: QuoteStatus.SENT,

        serviceAddressText: "1",

        serviceAddressTbd: false,

        scopeSummary: null,

        scopeIntent: "S",

        customerFacingIntro: null,

        pricingSubtotalCents: 999,

        totalCents: 999,

      },

      customer: { displayName: "Wrong" },

      lineItems: [

        {

          id: "l1",

          title: "Live line",

          customerDescription: "D",

          quantity: { toString: () => "1" } as never,

          pricingMode: PricingMode.FIXED_PRICE,

          unitPriceCents: 999,

          lineTotalCents: 999,

          lineMode: QuoteLineMode.REQUIRED,

        },

      ],

      assumptions: [],

    };

    const r = getQuotePreviewForWorkspace({

      quoteStatus: QuoteStatus.SENT,

      sentSnapshotJson: snapshot,

      liveParams,

    });

    expect(r.kind).toBe("frozen");

    if (r.kind === "frozen") {

      expect(r.preview.quoteTitle).toBe("Frozen title");

      expect(r.preview.organizationName).toBe("Acme Co");

    }

  });



  it("getQuotePreviewForWorkspace: SENT missing preview is integrity error, not live fallback", () => {

    const r = getQuotePreviewForWorkspace({

      quoteStatus: QuoteStatus.SENT,

      sentSnapshotJson: { version: 1 },

      liveParams: {

        organizationName: "Live",

        quote: {

          title: "Live",

          displayNumber: 1,

          status: QuoteStatus.SENT,

          serviceAddressText: null,

          serviceAddressTbd: true,

          scopeSummary: null,

          scopeIntent: "x",

          customerFacingIntro: null,

          pricingSubtotalCents: null,

          totalCents: null,

        },

        customer: { displayName: "c" },

        lineItems: [],

        assumptions: [],

      },

    });

    expect(r.kind).toBe("SENT_SNAPSHOT_MISSING");

  });



  it("parseSentSnapshotPreviewDto rejects malformed preview", () => {

    expect(parseSentSnapshotPreviewDto(null)).toBeNull();

    expect(parseSentSnapshotPreviewDto({ preview: { organizationName: "x" } })).toBeNull();

  });

  it("parseValidatedSentQuoteSnapshot accepts v2 with internalExecutionPlan", () => {
    const preview = buildQuoteCustomerPreviewDTO({
      organizationName: "O",
      quote: {
        title: "T",
        displayNumber: 1,
        status: QuoteStatus.DRAFT,
        serviceAddressText: "1",
        serviceAddressTbd: false,
        scopeSummary: null,
        scopeIntent: "x",
        customerFacingIntro: null,
        pricingSubtotalCents: null,
        totalCents: null,
      },
      customer: { displayName: "C" },
      lineItems: [
        {
          id: "l1",
          title: "Line",
          customerDescription: "d",
          quantity: { toString: () => "1" } as never,
          pricingMode: PricingMode.FIXED_PRICE,
          unitPriceCents: 1,
          lineTotalCents: 1,
          lineMode: QuoteLineMode.REQUIRED,
        },
      ],
      assumptions: [],
    });
    const internalExecutionPlan = buildInternalExecutionPlanFromLineItems([
      {
        id: "l1",
        title: "Line",
        sortOrder: 0,
        lineMode: QuoteLineMode.REQUIRED,
        executionStages: [
          {
            id: "s1",
            title: "Permit",
            sortOrder: 0,
            internalNotes: "secret stage",
            tasks: [
              {
                id: "t1",
                title: "Apply",
                description: "d",
                status: QuoteTaskStatus.NOT_READY,
                isRequired: true,
                sortOrder: 0,
                assignedRole: null,
                estimatedDurationMinutes: null,
                customerVisible: true,
                customerLabel: "Permitting",
                internalNotes: "secret task",
              },
            ],
          },
        ],
      },
    ]);
    const snapshot = {
      version: 2 as const,
      sentAt: "2026-01-01T00:00:00.000Z",
      quoteId: "q1",
      displayNumber: 1,
      preview,
      internalExecutionPlan,
    };
    const parsed = parseValidatedSentQuoteSnapshot(snapshot);
    expect(parsed?.version).toBe(2);
    if (!parsed || parsed.version !== 2) return;
    expect(parsed.internalExecutionPlan.lines[0]?.stages[0]?.tasks[0]?.status).toBe("NOT_READY");
    expect(parseSentSnapshotInternalExecutionPlan(snapshot)?.lines[0]?.stages[0]?.tasks[0]?.id).toBe("t1");
    expect(parseSentSnapshotPreviewDto(snapshot)?.quoteTitle).toBe("T");
  });

  it("parseValidatedSentQuoteSnapshotV1 still accepts legacy v1 snapshots", () => {
    const preview = buildQuoteCustomerPreviewDTO({
      organizationName: "O",
      quote: {
        title: "Legacy",
        displayNumber: 2,
        status: QuoteStatus.SENT,
        serviceAddressText: "1",
        serviceAddressTbd: false,
        scopeSummary: null,
        scopeIntent: "x",
        customerFacingIntro: null,
        pricingSubtotalCents: null,
        totalCents: null,
      },
      customer: { displayName: "C" },
      lineItems: [
        {
          id: "l1",
          title: "L",
          customerDescription: "d",
          quantity: { toString: () => "1" } as never,
          pricingMode: PricingMode.FIXED_PRICE,
          unitPriceCents: 1,
          lineTotalCents: 1,
          lineMode: QuoteLineMode.REQUIRED,
        },
      ],
      assumptions: [],
    });
    const v1 = {
      version: 1 as const,
      sentAt: "2025-01-01T00:00:00.000Z",
      quoteId: "q-old",
      displayNumber: 2,
      preview,
    };
    expect(parseValidatedSentQuoteSnapshotV1(v1)?.version).toBe(1);
    expect(parseValidatedSentQuoteSnapshot(v1)?.version).toBe(1);
    expect(parseSentSnapshotPreviewDto(v1)?.quoteTitle).toBe("Legacy");
  });

});


