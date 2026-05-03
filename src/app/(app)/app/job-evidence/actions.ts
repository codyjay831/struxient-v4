"use server";

import { revalidatePath } from "next/cache";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  acceptJobEvidence,
  promoteCustomerUploadAttachmentToJobEvidence,
  rejectJobEvidence,
  type JobEvidenceMutationResult,
} from "@/server/phase12/job-evidence-mutations";
import {
  acceptJobEvidenceFormSchema,
  promoteJobEvidenceFormSchema,
  rejectJobEvidenceFormSchema,
} from "@/server/phase12/validation";

function revalidateJobEvidenceSurfaces(jobId: string) {
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app/work-station");
}

export async function staffPromoteUploadToJobEvidence(
  _prev: JobEvidenceMutationResult | undefined,
  formData: FormData,
): Promise<JobEvidenceMutationResult> {
  const ctx = await requireOrgSession();
  const rawTask = formData.get("jobTaskId");
  const jobTaskIdRaw = typeof rawTask === "string" && rawTask.trim().length > 0 ? rawTask.trim() : "";
  const parsed = promoteJobEvidenceFormSchema.safeParse({
    sourceAttachmentId: formData.get("sourceAttachmentId"),
    jobId: formData.get("jobId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.title?.[0] ?? "Invalid input.";
    return { ok: false, error: msg };
  }
  const jobTaskId = jobTaskIdRaw.length > 0 ? jobTaskIdRaw : null;
  const r = await promoteCustomerUploadAttachmentToJobEvidence(ctx, {
    sourceAttachmentId: parsed.data.sourceAttachmentId,
    jobId: parsed.data.jobId,
    jobTaskId,
    title: parsed.data.title,
    description: parsed.data.description,
  });
  if (r.ok) {
    revalidateJobEvidenceSurfaces(r.jobId);
    const quoteId = formData.get("quoteId");
    if (typeof quoteId === "string" && quoteId.trim().length > 0) {
      revalidatePath(`/app/sales/quotes/${quoteId.trim()}`);
    }
  }
  return r;
}

export async function staffAcceptJobEvidence(
  _prev: JobEvidenceMutationResult | undefined,
  formData: FormData,
): Promise<JobEvidenceMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = acceptJobEvidenceFormSchema.safeParse({ evidenceId: formData.get("evidenceId") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid evidence." };
  }
  const r = await acceptJobEvidence(ctx, parsed.data.evidenceId);
  if (r.ok) {
    revalidateJobEvidenceSurfaces(r.jobId);
  }
  return r;
}

export async function staffRejectJobEvidence(
  _prev: JobEvidenceMutationResult | undefined,
  formData: FormData,
): Promise<JobEvidenceMutationResult> {
  const ctx = await requireOrgSession();
  const parsed = rejectJobEvidenceFormSchema.safeParse({
    evidenceId: formData.get("evidenceId"),
    rejectionReason: formData.get("rejectionReason"),
  });
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().fieldErrors.rejectionReason?.[0] ??
      parsed.error.flatten().fieldErrors.evidenceId?.[0] ??
      "Invalid input.";
    return { ok: false, error: msg };
  }
  const r = await rejectJobEvidence(ctx, parsed.data.evidenceId, parsed.data.rejectionReason);
  if (r.ok) {
    revalidateJobEvidenceSurfaces(r.jobId);
  }
  return r;
}
