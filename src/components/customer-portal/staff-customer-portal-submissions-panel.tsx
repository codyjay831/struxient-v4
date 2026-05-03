"use client";

import { useActionState } from "react";
import {
  CustomerPortalSubmissionAttachmentStatus,
  CustomerPortalSubmissionStatus,
  CustomerPortalSubmissionType,
} from "@prisma/client";

import {
  staffDismissPortalSubmission,
  staffMarkPortalSubmissionActioned,
  staffMarkPortalSubmissionReviewed,
} from "@/app/(app)/app/customer-portal-submissions/actions";
import type { StaffSubmissionMutationResult } from "@/server/phase9/customer-portal-submission-mutations";
import { PORTAL_FILE_UPLOAD_DEFAULT_MESSAGE_TEXT } from "@/server/phase11/portal-file-upload-messages";
import { Button } from "@/components/ui/button";
import { PromoteToEvidenceDialog } from "@/components/job-evidence/promote-to-evidence-dialog";

export type StaffPortalSubmissionAttachmentListItem = {
  id: string;
  originalFilename: string;
  sanitizedFilename: string | null;
  contentType: string;
  detectedContentType: string | null;
  sizeBytes: number;
  status: CustomerPortalSubmissionAttachmentStatus;
  createdAt: string;
};

export type StaffPortalSubmissionListItem = {
  id: string;
  type: CustomerPortalSubmissionType;
  status: CustomerPortalSubmissionStatus;
  subject: string | null;
  message: string;
  createdAt: string;
  customerDisplayName: string;
  quoteDisplayNumber: number | null;
  jobDisplayNumber: number | null;
  /** Present when submission is scoped to a job (portal token carried job). */
  jobId: string | null;
  /** ISO window for appointment confirmations; preformatted for display. */
  scheduleWindowDisplay?: string | null;
  /** Customer-visible task label when tied to scheduled work. */
  visitLabel?: string | null;
  attachments?: StaffPortalSubmissionAttachmentListItem[];
};

function typeLabel(t: CustomerPortalSubmissionType): string {
  switch (t) {
    case CustomerPortalSubmissionType.GENERAL_REQUEST:
      return "General question";
    case CustomerPortalSubmissionType.AVAILABILITY_NOTE:
      return "Availability note";
    case CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION:
      return "Appointment confirmation";
    case CustomerPortalSubmissionType.FILE_UPLOAD:
      return "File upload";
    default:
      return t;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentStatusLabel(s: CustomerPortalSubmissionAttachmentStatus): string {
  return s.replace(/_/g, " ");
}

function statusLabel(s: CustomerPortalSubmissionStatus): string {
  return s.replace(/_/g, " ");
}

function ActionErr({ s }: { s: StaffSubmissionMutationResult | undefined }) {
  if (!s || s.ok) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {s.error}
    </p>
  );
}

export type StaffEvidencePromotionContext = {
  taskOptionsByJobId: Record<string, { id: string; title: string }[]>;
  buckets: { attachmentId: string; jobId: string; jobTaskId: string | null }[];
  quoteIdForRevalidate?: string | null;
};

function SubmissionRow({
  row,
  canManage,
  canManageJobEvidence,
  evidencePromotion,
}: {
  row: StaffPortalSubmissionListItem;
  canManage: boolean;
  canManageJobEvidence: boolean;
  evidencePromotion?: StaffEvidencePromotionContext;
}) {
  const [revState, revAction, revPending] = useActionState(staffMarkPortalSubmissionReviewed, undefined);
  const [actState, actAction, actPending] = useActionState(staffMarkPortalSubmissionActioned, undefined);
  const [disState, disAction, disPending] = useActionState(staffDismissPortalSubmission, undefined);

  const showCustomerMessage =
    row.type !== CustomerPortalSubmissionType.FILE_UPLOAD ||
    row.message.trim() !== PORTAL_FILE_UPLOAD_DEFAULT_MESSAGE_TEXT.trim();

  return (
    <li className="border-b border-border px-4 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-sm border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {typeLabel(row.type)}
            </span>
            <span className="rounded-sm border border-border px-2 py-0.5 text-[11px] font-medium text-foreground">
              {statusLabel(row.status)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {row.customerDisplayName}
            {row.quoteDisplayNumber != null ? ` · Quote #${row.quoteDisplayNumber}` : ""}
            {row.jobDisplayNumber != null ? ` · Job #${row.jobDisplayNumber}` : ""}
          </p>
          <time className="text-xs tabular-nums text-muted-foreground">
            {new Date(row.createdAt).toLocaleString()}
          </time>
        </div>
      </div>
      {row.type === CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION ? (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {row.visitLabel ? <p className="font-medium text-foreground">{row.visitLabel}</p> : null}
          {row.scheduleWindowDisplay ? <p className="tabular-nums">{row.scheduleWindowDisplay}</p> : null}
        </div>
      ) : null}
      {row.subject ? <p className="mt-2 text-sm font-medium text-foreground">{row.subject}</p> : null}
      {showCustomerMessage ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{row.message}</p>
      ) : null}

      {row.type === CustomerPortalSubmissionType.FILE_UPLOAD ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Customer upload (intake). Files are not approved job evidence until your team reviews them.
          </p>
          {row.attachments && row.attachments.length > 0 ? (
            <ul className="space-y-2">
              {row.attachments.map((a) => {
                const bucketsForAtt =
                  row.jobId && evidencePromotion
                    ? evidencePromotion.buckets.filter((b) => b.attachmentId === a.id && b.jobId === row.jobId)
                    : [];
                const alreadyJobLevel = bucketsForAtt.some((b) => b.jobTaskId === null);
                const promotedTaskIds = bucketsForAtt
                  .map((b) => b.jobTaskId)
                  .filter((id): id is string => id != null);
                const taskOpts =
                  row.jobId && evidencePromotion?.taskOptionsByJobId
                    ? (evidencePromotion.taskOptionsByJobId[row.jobId] ?? [])
                    : [];
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">
                        {(a.detectedContentType ?? a.contentType).replace(/_/g, " ")} · {formatBytes(a.sizeBytes)} ·{" "}
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {attachmentStatusLabel(a.status)}
                      </p>
                      {bucketsForAtt.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Promoted to evidence
                          {alreadyJobLevel ? " (job-level)" : ""}
                          {promotedTaskIds.length > 0 ? ` (${promotedTaskIds.length} task link(s))` : ""}
                          {" · "}
                          <span className="text-foreground/80">Open the job to review or add another target.</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {a.status === CustomerPortalSubmissionAttachmentStatus.STORED ? (
                        <a
                          href={`/app/customer-portal-submissions/attachments/${encodeURIComponent(a.id)}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Download
                        </a>
                      ) : null}
                      {canManageJobEvidence &&
                      evidencePromotion &&
                      row.jobId &&
                      a.status === CustomerPortalSubmissionAttachmentStatus.STORED ? (
                        <PromoteToEvidenceDialog
                          jobId={row.jobId}
                          sourceAttachmentId={a.id}
                          attachmentStatus={a.status}
                          taskOptions={taskOpts}
                          quoteIdForRevalidate={evidencePromotion.quoteIdForRevalidate ?? null}
                          alreadyPromotedForJobLevel={alreadyJobLevel}
                          promotedTaskIds={promotedTaskIds}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No attachment metadata on record.</p>
          )}
          {!row.jobId ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Evidence promotion is available after this upload is tied to a job (customer portal link scoped to an
              active job).
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={revAction}>
            <input type="hidden" name="submissionId" value={row.id} />
            <Button type="submit" size="sm" variant="outline" disabled={revPending}>
              {revPending ? "…" : "Mark reviewed"}
            </Button>
          </form>
          <form action={actAction}>
            <input type="hidden" name="submissionId" value={row.id} />
            <Button type="submit" size="sm" variant="secondary" disabled={actPending}>
              {actPending ? "…" : "Mark actioned"}
            </Button>
          </form>
          <form action={disAction}>
            <input type="hidden" name="submissionId" value={row.id} />
            <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground" disabled={disPending}>
              {disPending ? "…" : "Dismiss"}
            </Button>
          </form>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Status changes are limited to office and management roles.</p>
      )}

      <div className="mt-2 space-y-1">
        <ActionErr s={revState} />
        <ActionErr s={actState} />
        <ActionErr s={disState} />
      </div>
    </li>
  );
}

export type StaffCustomerPortalSubmissionsPanelProps = {
  title?: string;
  newCount: number;
  submissions: StaffPortalSubmissionListItem[];
  canManage: boolean;
  canManageJobEvidence?: boolean;
  evidencePromotion?: StaffEvidencePromotionContext;
};

export function StaffCustomerPortalSubmissionsPanel({
  title = "Customer portal submissions",
  newCount,
  submissions,
  canManage,
  canManageJobEvidence = false,
  evidencePromotion,
}: StaffCustomerPortalSubmissionsPanelProps) {
  return (
    <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Notes and file uploads submitted from the customer portal link for this record. New items:{" "}
          <span className="font-medium tabular-nums text-foreground">{newCount}</span>
        </p>
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No customer portal activity for this record yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-sm border border-border bg-background/30">
          {submissions.map((row) => (
            <SubmissionRow
              key={row.id}
              row={row}
              canManage={canManage}
              canManageJobEvidence={canManageJobEvidence}
              evidencePromotion={evidencePromotion}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
