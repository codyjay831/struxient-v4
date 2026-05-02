import { Prisma, PricingMode, QuoteLineMode } from "@prisma/client";

export async function recalculateQuoteTotals(
  tx: Prisma.TransactionClient,
  organizationId: string,
  quoteId: string,
) {
  const lines = await tx.quoteLineItem.findMany({
    where: { organizationId, quoteId },
  });
  let sub = 0;
  for (const l of lines) {
    if (l.lineMode === QuoteLineMode.REMOVED) continue;
    if (l.pricingMode === PricingMode.FIXED_PRICE && l.unitPriceCents != null) {
      sub += Math.round(Number(l.quantity) * l.unitPriceCents);
    }
  }
  await tx.quote.update({
    where: { id: quoteId, organizationId },
    data: { pricingSubtotalCents: sub, totalCents: sub },
  });
}
