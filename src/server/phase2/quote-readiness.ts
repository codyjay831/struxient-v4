import type { CustomerContactMethod, Opportunity, Quote, QuoteAssumption, QuoteLineItem, QuoteTask } from "@prisma/client";
import {
  PricingMode,
  QuoteAssumptionVisibility,
  QuoteLineMode,
  QuoteStatus,
  QuoteTaskStatus,
} from "@prisma/client";

export type ReadinessCheckStatus = "PASS" | "FAIL" | "WAIVED" | "NOT_APPLICABLE";
export type ReadinessSeverity = "BLOCKER" | "WARNING" | "INFO";

export type QuoteSendReadinessItem = {
  key: string;
  label: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  fixLocation: string;
  explanation: string;
};

function item(
  key: string,
  label: string,
  status: ReadinessCheckStatus,
  severity: ReadinessSeverity,
  fixLocation: string,
  explanation: string,
): QuoteSendReadinessItem {
  return { key, label, status, severity, fixLocation, explanation };
}

type LineReadinessInput = Pick<
  QuoteLineItem,
  "lineMode" | "title" | "quantity" | "pricingMode" | "unitPriceCents" | "customerDescription"
> & {
  executionStages?: { tasks: unknown[] }[];
};

function activeLines(lines: LineReadinessInput[]) {
  return lines.filter((l) => l.lineMode !== QuoteLineMode.REMOVED);
}

function activeContactCount(contacts: Pick<CustomerContactMethod, "archivedAt">[]) {
  return contacts.filter((c) => c.archivedAt === null).length;
}

export function evaluateQuoteSendReadiness(params: {
  quote: Pick<Quote, "id" | "customerId" | "opportunityId" | "status" | "customerFacingIntro">;
  opportunity: Pick<Opportunity, "contactIntakeWaived"> | null;
  customerContacts: Pick<CustomerContactMethod, "archivedAt">[];
  lineItems: LineReadinessInput[];
  /** Quote-prep tasks only (internal). */
  quoteTasks: Pick<QuoteTask, "isRequired" | "status">[];
  assumptions: Pick<QuoteAssumption, "visibility" | "quoteLineItemId">[];
}): QuoteSendReadinessItem[] {
  const { quote, opportunity, customerContacts, lineItems, quoteTasks, assumptions } = params;
  const waived = Boolean(opportunity?.contactIntakeWaived);
  const contactsOk = waived || activeContactCount(customerContacts) > 0;
  const sendableContact = contactsOk
    ? item(
        "sendable_contact",
        "Sendable contact",
        waived ? "WAIVED" : "PASS",
        "INFO",
        "quote/context",
        waived
          ? "Contact intake is waived on the opportunity. Confirm this matches your process before sending."
          : "Customer has at least one active contact method.",
      )
    : item(
        "sendable_contact",
        "Sendable contact",
        "FAIL",
        "BLOCKER",
        "customers/detail",
        "Add a contact method on the customer record, or waive contact intake on the opportunity with an auditable reason.",
      );

  const quoteCustomer = Boolean(quote.customerId?.trim());
  const quoteOpp = Boolean(quote.opportunityId?.trim());

  const items: QuoteSendReadinessItem[] = [
    item(
      "quote_customer",
      "Customer linked",
      quoteCustomer ? "PASS" : "FAIL",
      quoteCustomer ? "INFO" : "BLOCKER",
      "quote/context",
      quoteCustomer ? "Quote is linked to a customer." : "Quote is missing a customer association.",
    ),
    item(
      "quote_opportunity",
      "Opportunity linked",
      quoteOpp ? "PASS" : "FAIL",
      quoteOpp ? "INFO" : "BLOCKER",
      "quote/context",
      quoteOpp ? "Quote is linked to an opportunity." : "Quote is missing an opportunity association.",
    ),
    sendableContact,
  ];

  const lines = activeLines(lineItems);
  const hasActiveLines = lines.length > 0;
  items.push(
    hasActiveLines
      ? item("active_lines", "Line items", "PASS", "INFO", "quote/lines", "At least one active line item is on the quote.")
      : item(
          "active_lines",
          "Line items",
          "FAIL",
          "BLOCKER",
          "quote/lines",
          "Add at least one line item (not marked removed) before sending.",
        ),
  );

  let lineTitleFail = false;
  let qtyFail = false;
  let priceFail = false;
  let descFail = false;
  for (const l of lines) {
    if (!l.title.trim()) lineTitleFail = true;
    const q = Number(l.quantity);
    if (!Number.isFinite(q) || q <= 0) qtyFail = true;
    if (l.lineMode === QuoteLineMode.REQUIRED && l.pricingMode === PricingMode.FIXED_PRICE) {
      if (l.unitPriceCents == null || l.unitPriceCents <= 0) priceFail = true;
    }
    if (l.lineMode === QuoteLineMode.REQUIRED && !l.customerDescription.trim()) {
      descFail = true;
    }
  }

  items.push(
    lineTitleFail
      ? item(
          "line_title",
          "Line titles",
          "FAIL",
          "BLOCKER",
          "quote/lines",
          "Every active line item needs a clear title.",
        )
      : item("line_title", "Line titles", "PASS", "INFO", "quote/lines", "Active line items have titles."),
  );

  items.push(
    qtyFail
      ? item(
          "line_quantity",
          "Quantities",
          "FAIL",
          "BLOCKER",
          "quote/lines",
          "Each active line needs a positive quantity.",
        )
      : item("line_quantity", "Quantities", "PASS", "INFO", "quote/lines", "Quantities are valid."),
  );

  items.push(
    priceFail
      ? item(
          "line_price_fixed",
          "Fixed pricing",
          "FAIL",
          "BLOCKER",
          "quote/lines",
          "Required lines on fixed price need a unit price greater than zero.",
        )
      : item("line_price_fixed", "Fixed pricing", "PASS", "INFO", "quote/lines", "Required fixed-price lines are priced."),
  );

  items.push(
    descFail
      ? item(
          "customer_description",
          "Customer-facing descriptions",
          "FAIL",
          "BLOCKER",
          "quote/lines",
          "Required line items need a customer-facing description before send.",
        )
      : item(
          "customer_description",
          "Customer-facing descriptions",
          "PASS",
          "INFO",
          "quote/lines",
          "Required lines include customer-facing descriptions.",
        ),
  );

  const intro = quote.customerFacingIntro?.trim() ?? "";
  items.push(
    intro.length > 0
      ? item(
          "customer_intro_terms",
          "Customer-facing intro",
          "PASS",
          "INFO",
          "quote/header",
          "A customer-facing intro or overview is present.",
        )
      : item(
          "customer_intro_terms",
          "Customer-facing intro",
          "PASS",
          "INFO",
          "quote/header",
          "Optional: add a short customer-facing intro in the quote header to frame the proposal.",
        ),
  );

  const prepRequired = quoteTasks.filter((t) => t.isRequired);
  const prepIncomplete = prepRequired.some((t) => t.status !== QuoteTaskStatus.COMPLETE);
  items.push(
    prepRequired.length === 0
      ? item(
          "quote_prep_required",
          "Required quote-prep tasks",
          "NOT_APPLICABLE",
          "INFO",
          "quote/prep-tasks",
          "No quote-prep tasks are marked required.",
        )
      : prepIncomplete
        ? item(
            "quote_prep_required",
            "Required quote-prep tasks",
            "FAIL",
            "BLOCKER",
            "quote/prep-tasks",
            "Complete every required quote-prep task before marking ready or sending.",
          )
        : item(
            "quote_prep_required",
            "Required quote-prep tasks",
            "PASS",
            "INFO",
            "quote/prep-tasks",
            "All required quote-prep tasks are complete.",
          ),
  );

  const internalReviewBlock =
    quote.status === QuoteStatus.NEEDS_REVIEW ||
    quoteTasks.some((t) => t.isRequired && t.status === QuoteTaskStatus.NEEDS_REVIEW);
  items.push(
    internalReviewBlock
      ? item(
          "internal_review",
          "Internal review",
          "FAIL",
          "BLOCKER",
          "quote/prep-tasks",
          "Resolve internal review (quote status or required prep tasks in “Needs review”) before send.",
        )
      : item("internal_review", "Internal review", "PASS", "INFO", "quote/prep-tasks", "No internal review blockers."),
  );

  let lineExecutionTaskCount = 0;
  for (const l of lineItems) {
    for (const st of l.executionStages ?? []) {
      lineExecutionTaskCount += st.tasks?.length ?? 0;
    }
  }
  items.push(
    lineExecutionTaskCount === 0
      ? item(
          "planned_execution",
          "Line execution plan",
          "PASS",
          "WARNING",
          "quote/lines",
          "No line-item execution tasks yet. Optional dormant plan under each line helps set delivery expectations after the job is sold.",
        )
      : item(
          "planned_execution",
          "Line execution plan",
          "PASS",
          "INFO",
          "quote/lines",
          "At least one line-item execution task is recorded.",
        ),
  );

  let unclear = false;
  for (const l of lines) {
    if (
      (l.pricingMode === PricingMode.PRICE_ON_REQUEST || l.pricingMode === PricingMode.ALLOWANCE) &&
      l.customerDescription.trim().length < 8
    ) {
      unclear = true;
    }
  }
  const hasCustomerAssumption = assumptions.some(
    (a) => a.visibility === QuoteAssumptionVisibility.CUSTOMER_VISIBLE && !a.quoteLineItemId,
  );
  if (!unclear && lines.some((l) => l.pricingMode === PricingMode.PRICE_ON_REQUEST)) {
    unclear = !hasCustomerAssumption && lines.some((l) => l.pricingMode === PricingMode.PRICE_ON_REQUEST);
  }
  items.push(
    unclear
      ? item(
          "non_fixed_pricing_clarity",
          "Variable pricing clarity",
          "PASS",
          "WARNING",
          "quote/lines",
          "Clarify customer-facing language for price-on-request or allowance lines, or add a customer-visible assumption.",
        )
      : item(
          "non_fixed_pricing_clarity",
          "Variable pricing clarity",
          "PASS",
          "INFO",
          "quote/lines",
          "Non-fixed lines have enough customer-facing context for review.",
        ),
  );

  return items;
}

export function allQuoteSendBlockersPass(items: QuoteSendReadinessItem[]): boolean {
  return !items.some((i) => i.severity === "BLOCKER" && i.status === "FAIL");
}
