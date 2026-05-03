import { z } from "zod";

import {
  JOB_EVIDENCE_DESCRIPTION_MAX,
  JOB_EVIDENCE_REJECTION_REASON_MAX,
  JOB_EVIDENCE_TITLE_MAX,
} from "@/server/phase12/job-evidence-types";

export const promoteJobEvidenceFormSchema = z.object({
  sourceAttachmentId: z.string().min(1),
  jobId: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(JOB_EVIDENCE_TITLE_MAX, `Title must be at most ${JOB_EVIDENCE_TITLE_MAX} characters.`),
  description: z
    .string()
    .max(JOB_EVIDENCE_DESCRIPTION_MAX)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t && t.length > 0 ? t : undefined;
    }),
});

export const acceptJobEvidenceFormSchema = z.object({
  evidenceId: z.string().min(1),
});

export const rejectJobEvidenceFormSchema = z.object({
  evidenceId: z.string().min(1),
  rejectionReason: z
    .string()
    .trim()
    .min(1, "A rejection reason is required.")
    .max(JOB_EVIDENCE_REJECTION_REASON_MAX, `Reason must be at most ${JOB_EVIDENCE_REJECTION_REASON_MAX} characters.`),
});
