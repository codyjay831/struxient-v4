import type {
  CustomerContactType,
  CustomerKind,
  CustomerStatus,
  JobStatus,
  JobTaskStatus,
  OpportunityPriority,
  OpportunityStatus,
  OpportunityTaskKind,
  OpportunityTaskStatus,
  QuoteStatus,
} from "@prisma/client";

function titleCaseFromSnake(s: string) {
  return s
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatCustomerKind(k: CustomerKind) {
  return titleCaseFromSnake(k);
}

export function formatCustomerStatus(s: CustomerStatus) {
  return titleCaseFromSnake(s);
}

export function formatContactType(t: CustomerContactType) {
  return titleCaseFromSnake(t);
}

export function formatOpportunityStatus(s: OpportunityStatus) {
  return titleCaseFromSnake(s);
}

export function formatOpportunityPriority(p: OpportunityPriority) {
  return titleCaseFromSnake(p);
}

export function formatTaskKind(k: OpportunityTaskKind) {
  return titleCaseFromSnake(k);
}

export function formatTaskStatus(s: OpportunityTaskStatus) {
  return titleCaseFromSnake(s);
}

export function formatQuoteStatus(s: QuoteStatus) {
  return titleCaseFromSnake(s);
}

export function formatJobStatus(s: JobStatus) {
  return titleCaseFromSnake(s);
}

export function formatJobTaskStatus(s: JobTaskStatus) {
  return titleCaseFromSnake(s);
}
