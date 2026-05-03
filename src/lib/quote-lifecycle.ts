import { QuoteStatus } from "@prisma/client";

/** Quote rows whose commercial / structural definition must not change via workspace mutations. */
export function isQuoteStructurallyLocked(status: QuoteStatus): boolean {
  return status === QuoteStatus.SENT || status === QuoteStatus.ACCEPTED || status === QuoteStatus.ACTIVATED;
}

/** Customer preview is frozen from sent snapshot (not rebuilt from live quote rows). */
export function isQuoteCustomerPreviewFrozen(status: QuoteStatus): boolean {
  return isQuoteStructurallyLocked(status);
}
