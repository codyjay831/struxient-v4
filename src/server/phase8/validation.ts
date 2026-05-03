import { z } from "zod";

export const portalQuoteIdFormSchema = z.object({
  quoteId: z.string().min(1, "Quote is required."),
});
