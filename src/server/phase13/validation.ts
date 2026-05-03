import { z } from "zod";

const nonEmptyId = z.string().trim().min(1, "Required");

export const updateJobTaskCompletionRequirementsSchema = z
  .object({
    jobId: nonEmptyId,
    jobTaskId: nonEmptyId,
    required: z.boolean(),
    minAcceptedCount: z.coerce.number().int().min(1).max(10).default(1),
    allowJobLevelEvidence: z.coerce.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.required && (val.minAcceptedCount < 1 || val.minAcceptedCount > 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum accepted count must be between 1 and 10.",
        path: ["minAcceptedCount"],
      });
    }
  });

export const completeJobTaskEvidenceOverrideReasonMax = 2000;
