import { z } from "zod";

const nonEmptyId = z.string().trim().min(1, "Required");

function parseIsoDate(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .superRefine((val, ctx) => {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is not a valid date.` });
      }
    })
    .transform((val) => new Date(val));
}

export const scheduleJobTaskSchema = z
  .object({
    jobId: nonEmptyId,
    jobTaskId: nonEmptyId,
    scheduledStartAt: parseIsoDate("Start time"),
    scheduledEndAt: parseIsoDate("End time"),
    title: z.string().trim().max(500).optional(),
    notes: z.string().max(8000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scheduledEndAt.getTime() <= val.scheduledStartAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time.",
        path: ["scheduledEndAt"],
      });
    }
  });

export const rescheduleScheduledWorkSchema = z
  .object({
    scheduledWorkId: nonEmptyId,
    scheduledStartAt: parseIsoDate("Start time"),
    scheduledEndAt: parseIsoDate("End time"),
    notes: z.string().max(8000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scheduledEndAt.getTime() <= val.scheduledStartAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must be after start time.",
        path: ["scheduledEndAt"],
      });
    }
  });

export const cancelScheduledWorkSchema = z.object({
  scheduledWorkId: nonEmptyId,
  cancelReason: z.string().trim().min(1, "A cancel reason is required.").max(8000),
});
