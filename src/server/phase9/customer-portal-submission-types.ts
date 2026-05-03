import type { CustomerPortalSubmissionStatus, CustomerPortalSubmissionType } from "@prisma/client";

export type { CustomerPortalSubmissionStatus, CustomerPortalSubmissionType };

/** Max length for customer portal note body (server-enforced). */
export const PORTAL_SUBMISSION_MESSAGE_MAX = 4000;

/** Max length for optional subject line. */
export const PORTAL_SUBMISSION_SUBJECT_MAX = 120;

export const PORTAL_SUBMISSION_GENERIC_ERROR =
  "We couldn’t send your note. Check your link or try again, or contact the office directly.";
