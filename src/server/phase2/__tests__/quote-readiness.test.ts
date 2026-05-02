import { describe, expect, it } from "vitest";
import {
  PricingMode,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskStatus,
} from "@prisma/client";
import { allQuoteSendBlockersPass, evaluateQuoteSendReadiness } from "../quote-readiness";

describe("evaluateQuoteSendReadiness", () => {
  const baseQuote = {
    id: "q1",
    customerId: "c1",
    opportunityId: "o1",
    status: QuoteStatus.DRAFT,
    customerFacingIntro: null,
  };

  it("flags empty quote with blockers", () => {
    const items = evaluateQuoteSendReadiness({
      quote: baseQuote,
      opportunity: { contactIntakeWaived: false },
      customerContacts: [],
      lineItems: [],
      quoteTasks: [],
      assumptions: [],
    });
    expect(allQuoteSendBlockersPass(items)).toBe(false);
    expect(items.find((i) => i.key === "sendable_contact")?.status).toBe("FAIL");
    expect(items.find((i) => i.key === "active_lines")?.status).toBe("FAIL");
  });

  it("passes blockers with valid required line and contact; warns on missing planned execution", () => {
    const items = evaluateQuoteSendReadiness({
      quote: { ...baseQuote, customerFacingIntro: "Hello" },
      opportunity: { contactIntakeWaived: false },
      customerContacts: [{ archivedAt: null }],
      lineItems: [
        {
          lineMode: QuoteLineMode.REQUIRED,
          title: "Install charger",
          quantity: { toString: () => "1" } as never,
          pricingMode: PricingMode.FIXED_PRICE,
          unitPriceCents: 10000,
          customerDescription: "Full install including permit coordination.",
        },
      ],
      quoteTasks: [],
      assumptions: [],
    });
    expect(allQuoteSendBlockersPass(items)).toBe(true);
    const planned = items.find((i) => i.key === "planned_execution");
    expect(planned?.severity).toBe("WARNING");
  });

  it("blocks when required quote-prep incomplete", () => {
    const items = evaluateQuoteSendReadiness({
      quote: baseQuote,
      opportunity: { contactIntakeWaived: true },
      customerContacts: [],
      lineItems: [
        {
          lineMode: QuoteLineMode.REQUIRED,
          title: "Line",
          quantity: { toString: () => "1" } as never,
          pricingMode: PricingMode.FIXED_PRICE,
          unitPriceCents: 100,
          customerDescription: "Desc",
        },
      ],
      quoteTasks: [
        {
          isRequired: true,
          status: QuoteTaskStatus.IN_PROGRESS,
        },
      ],
      assumptions: [],
    });
    expect(allQuoteSendBlockersPass(items)).toBe(false);
  });

  it("non-fixed pricing clarity warning when description short", () => {
    const items = evaluateQuoteSendReadiness({
      quote: baseQuote,
      opportunity: { contactIntakeWaived: true },
      customerContacts: [],
      lineItems: [
        {
          lineMode: QuoteLineMode.REQUIRED,
          title: "T",
          quantity: { toString: () => "1" } as never,
          pricingMode: PricingMode.PRICE_ON_REQUEST,
          unitPriceCents: null,
          customerDescription: "short",
        },
      ],
      quoteTasks: [],
      assumptions: [],
    });
    const nf = items.find((i) => i.key === "non_fixed_pricing_clarity");
    expect(nf?.severity).toBe("WARNING");
  });
});
