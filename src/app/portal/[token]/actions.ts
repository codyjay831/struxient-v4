"use server";

import { revalidatePath } from "next/cache";
import { createPortalSubmissionFromToken } from "@/server/phase9/portal-submission-actions";
import { portalCustomerSubmissionInputSchema } from "@/server/phase9/validation";
import { PORTAL_SUBMISSION_GENERIC_ERROR } from "@/server/phase9/customer-portal-submission-types";
import { confirmScheduledWorkFromPortal } from "@/server/phase10/portal-appointment-confirmation";

export type PortalNoteSubmitState = { ok: true } | { ok: false; error: string };

export type PortalAppointmentAckState = { ok: true } | { ok: false; error: string };

/**
 * Token-based public portal submission. Scope is never taken from spoofed FormData keys
 * beyond type/subject/message; org/quote/job come only from server-side token resolution.
 *
 * CSRF: bearer token acts as capability; DB-backed rate limits reduce brute-force and spam.
 */
export async function submitPortalCustomerNote(
  _prev: PortalNoteSubmitState | undefined,
  formData: FormData,
): Promise<PortalNoteSubmitState> {
  const rawToken = String(formData.get("portalToken") ?? "").trim();
  if (!rawToken) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const input = {
    type: formData.get("type"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  };

  const parsed = portalCustomerSubmissionInputSchema.safeParse(input);
  if (!parsed.success) {
    const err =
      parsed.error.flatten().fieldErrors.message?.[0] ??
      parsed.error.flatten().fieldErrors.type?.[0] ??
      PORTAL_SUBMISSION_GENERIC_ERROR;
    return { ok: false, error: err };
  }

  const result = await createPortalSubmissionFromToken({ rawToken, input: parsed.data });
  if (result.ok) {
    revalidatePath("/app/work-station");
    revalidatePath(`/app/sales/quotes/${result.quoteId}`);
    if (result.jobId) {
      revalidatePath(`/app/jobs/${result.jobId}`);
    }
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

/**
 * Acknowledges a scheduled visit visible on this portal link. Creates a reviewable submission only.
 */
export async function submitPortalAppointmentAck(
  _prev: PortalAppointmentAckState | undefined,
  formData: FormData,
): Promise<PortalAppointmentAckState> {
  const rawToken = String(formData.get("portalToken") ?? "").trim();
  const scheduleActionRef = String(formData.get("scheduleActionRef") ?? "").trim();
  const optionalNote = String(formData.get("optionalNote") ?? "").trim();
  if (!rawToken || !scheduleActionRef) {
    return { ok: false, error: PORTAL_SUBMISSION_GENERIC_ERROR };
  }

  const result = await confirmScheduledWorkFromPortal({
    rawToken,
    scheduleActionRef,
    optionalNote: optionalNote.length > 0 ? optionalNote : undefined,
  });
  if (result.ok) {
    revalidatePath(`/portal/${encodeURIComponent(rawToken)}`);
    revalidatePath("/app/work-station");
    revalidatePath(`/app/sales/quotes/${result.quoteId}`);
    if (result.jobId) {
      revalidatePath(`/app/jobs/${result.jobId}`);
    }
    return { ok: true };
  }
  return { ok: false, error: result.error };
}
