import { z } from "zod";
import { CustomerPortalSubmissionType } from "@prisma/client";

import { PORTAL_SUBMISSION_MESSAGE_MAX, PORTAL_SUBMISSION_SUBJECT_MAX } from "@/server/phase9/customer-portal-submission-types";

export const portalCustomerSubmissionInputSchema = z
  .object({
    type: z.nativeEnum(CustomerPortalSubmissionType),
    subject: z
      .string()
      .max(PORTAL_SUBMISSION_SUBJECT_MAX)
      .optional()
      .transform((s) => {
        const t = s?.trim();
        return t && t.length > 0 ? t : undefined;
      }),
    message: z
      .string()
      .trim()
      .min(1, "Message is required.")
      .max(PORTAL_SUBMISSION_MESSAGE_MAX, `Message must be at most ${PORTAL_SUBMISSION_MESSAGE_MAX} characters.`),
  })
  .strict();

export type PortalCustomerSubmissionInput = z.infer<typeof portalCustomerSubmissionInputSchema>;

export const staffSubmissionIdFormSchema = z.object({
  submissionId: z.string().min(1),
});
