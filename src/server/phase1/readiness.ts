import type { CustomerContactMethod, Opportunity, OpportunityTask } from "@prisma/client";
import { OpportunityTaskStatus } from "@prisma/client";

export type ReadinessCheckStatus = "PASS" | "FAIL" | "WAIVED" | "NOT_APPLICABLE";

export type ReadinessSeverity = "BLOCKER" | "WARNING" | "INFO";

export type QuoteDraftReadinessItem = {
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
): QuoteDraftReadinessItem {
  return { key, label, status, severity, fixLocation, explanation };
}

export function computeQuoteDraftReadiness(params: {
  opportunity: Pick<
    Opportunity,
    "customerId" | "serviceType" | "scopeIntent" | "serviceAddressText" | "serviceAddressTbd" | "contactIntakeWaived"
  >;
  activeContactCount: number;
  tasks: Pick<OpportunityTask, "isRequired" | "status">[];
}): QuoteDraftReadinessItem[] {
  const { opportunity, activeContactCount, tasks } = params;

  const customerLinked = Boolean(opportunity.customerId?.trim());
  const customerItem = item(
    "customer_linked",
    "Customer linked",
    customerLinked ? "PASS" : "FAIL",
    customerLinked ? "INFO" : "BLOCKER",
    "sales/opportunity",
    customerLinked
      ? "This opportunity is associated with a customer record."
      : "Link a customer before opening quote workspace.",
  );

  let contactItem: QuoteDraftReadinessItem;
  if (opportunity.contactIntakeWaived) {
    contactItem = item(
      "contact_or_waived",
      "Reachable contact",
      "WAIVED",
      "INFO",
      "sales/opportunity",
      "Contact intake was explicitly waived for this opportunity. Ensure your process allows proceeding without on-file contact methods.",
    );
  } else if (activeContactCount > 0) {
    contactItem = item(
      "contact_or_waived",
      "Reachable contact",
      "PASS",
      "INFO",
      "customers/detail",
      "At least one active contact method exists on the customer.",
    );
  } else {
    contactItem = item(
      "contact_or_waived",
      "Reachable contact",
      "FAIL",
      "BLOCKER",
      "customers/detail",
      "Add a contact method on the customer record, or document an explicit waiver on this opportunity.",
    );
  }

  const st = opportunity.serviceType?.trim() ?? "";
  const serviceTypeOk = st.length > 0;
  const serviceTypeItem = item(
    "service_type",
    "Service type",
    serviceTypeOk ? "PASS" : "FAIL",
    serviceTypeOk ? "INFO" : "BLOCKER",
    "sales/opportunity",
    serviceTypeOk ? "Service type is set." : "Enter the requested service type.",
  );

  const si = opportunity.scopeIntent?.trim() ?? "";
  const scopeOk = si.length > 0;
  const scopeItem = item(
    "scope_intent",
    "Scope intent",
    scopeOk ? "PASS" : "FAIL",
    scopeOk ? "INFO" : "BLOCKER",
    "sales/opportunity",
    scopeOk
      ? "Scope intent describes what the customer is asking for before line items exist."
      : "Capture scope intent so estimators know what to price.",
  );

  const addrOk =
    opportunity.serviceAddressTbd === true ||
    (opportunity.serviceAddressText?.trim().length ?? 0) > 0;
  const addrItem = item(
    "service_address_or_tbd",
    "Service location",
    addrOk ? "PASS" : "FAIL",
    addrOk ? "INFO" : "BLOCKER",
    "sales/opportunity",
    addrOk
      ? "Either a service address is recorded or the location is explicitly marked as not yet determined."
      : "Provide a service address or mark location as not yet determined.",
  );

  const required = tasks.filter((t) => t.isRequired);
  let tasksItem: QuoteDraftReadinessItem;
  if (required.length === 0) {
    tasksItem = item(
      "required_intake_tasks",
      "Required intake tasks",
      "NOT_APPLICABLE",
      "INFO",
      "sales/opportunity",
      "No checklist items are marked required for this opportunity.",
    );
  } else {
    const allDone = required.every((t) => t.status === OpportunityTaskStatus.COMPLETE);
    tasksItem = item(
      "required_intake_tasks",
      "Required intake tasks",
      allDone ? "PASS" : "FAIL",
      allDone ? "INFO" : "BLOCKER",
      "sales/opportunity",
      allDone
        ? "All required intake tasks are complete."
        : "Complete every required checklist item before quote workspace.",
    );
  }

  return [customerItem, contactItem, serviceTypeItem, scopeItem, addrItem, tasksItem];
}

export function allQuoteDraftBlockersPass(items: QuoteDraftReadinessItem[]): boolean {
  return items.every((i) => i.status === "PASS" || i.status === "WAIVED" || i.status === "NOT_APPLICABLE");
}

export function activeContactMethods(contacts: Pick<CustomerContactMethod, "archivedAt">[]): number {
  return contacts.filter((c) => c.archivedAt === null).length;
}
