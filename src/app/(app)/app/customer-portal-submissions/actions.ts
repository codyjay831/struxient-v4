"use server";

import { revalidatePath } from "next/cache";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  dismissCustomerPortalSubmission,
  markCustomerPortalSubmissionActioned,
  markCustomerPortalSubmissionReviewed,
  type StaffSubmissionMutationResult,
} from "@/server/phase9/customer-portal-submission-mutations";
import { staffSubmissionIdFormSchema } from "@/server/phase9/validation";

async function revalidateAfterSubmissionChange(params: { quoteId: string | null; jobId: string | null }) {
  revalidatePath("/app/work-station");
  if (params.quoteId) {
    revalidatePath(`/app/sales/quotes/${params.quoteId}`);
  }
  if (params.jobId) {
    revalidatePath(`/app/jobs/${params.jobId}`);
  }
}

export async function staffMarkPortalSubmissionReviewed(
  _prev: StaffSubmissionMutationResult | undefined,
  formData: FormData,
): Promise<StaffSubmissionMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = staffSubmissionIdFormSchema.safeParse({ submissionId: formData.get("submissionId") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid submission." };
  }
  const r = await markCustomerPortalSubmissionReviewed(ctx, parsed.data.submissionId);
  if (r.ok) {
    await revalidateAfterSubmissionChange({ quoteId: r.quoteId, jobId: r.jobId });
  }
  return r;
}

export async function staffMarkPortalSubmissionActioned(
  _prev: StaffSubmissionMutationResult | undefined,
  formData: FormData,
): Promise<StaffSubmissionMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = staffSubmissionIdFormSchema.safeParse({ submissionId: formData.get("submissionId") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid submission." };
  }
  const r = await markCustomerPortalSubmissionActioned(ctx, parsed.data.submissionId);
  if (r.ok) {
    await revalidateAfterSubmissionChange({ quoteId: r.quoteId, jobId: r.jobId });
  }
  return r;
}

export async function staffDismissPortalSubmission(
  _prev: StaffSubmissionMutationResult | undefined,
  formData: FormData,
): Promise<StaffSubmissionMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = staffSubmissionIdFormSchema.safeParse({ submissionId: formData.get("submissionId") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid submission." };
  }
  const r = await dismissCustomerPortalSubmission(ctx, parsed.data.submissionId);
  if (r.ok) {
    await revalidateAfterSubmissionChange({ quoteId: r.quoteId, jobId: r.jobId });
  }
  return r;
}
