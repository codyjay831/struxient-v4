import { JobTaskStatus } from "@prisma/client";
import { z } from "zod";

const nonEmptyId = z.string().trim().min(1, "Required");

export const updateJobTaskStatusSchema = z
  .object({
    jobId: nonEmptyId,
    taskId: nonEmptyId,
    status: z.nativeEnum(JobTaskStatus),
    blockedReason: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.status === JobTaskStatus.BLOCKED) {
      const trimmed = (val.blockedReason ?? "").trim();
      if (!trimmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a reason when marking this task blocked.",
          path: ["blockedReason"],
        });
      }
    }
  });

export const jobIdActionSchema = z.object({
  jobId: nonEmptyId,
});

export const jobPauseActionSchema = z.object({
  jobId: nonEmptyId,
  statusReason: z.string().optional(),
});

export const jobCancelActionSchema = z.object({
  jobId: nonEmptyId,
  reason: z.string().trim().min(1, "A cancel reason is required."),
});
