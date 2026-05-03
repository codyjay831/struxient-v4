import { JobEvidenceStatus } from "@prisma/client";

export type JobEvidenceRowDto = {
  id: string;
  status: JobEvidenceStatus;
  title: string;
  description: string | null;
  promotedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  jobTaskTitle: string | null;
  sourceAttachmentId: string | null;
  promotedByLabel: string | null;
  reviewedByLabel: string | null;
};

export function jobEvidenceStatusLabel(s: JobEvidenceStatus): string {
  switch (s) {
    case JobEvidenceStatus.CANDIDATE:
      return "Candidate";
    case JobEvidenceStatus.ACCEPTED:
      return "Accepted";
    case JobEvidenceStatus.REJECTED:
      return "Rejected";
    default:
      return s;
  }
}
