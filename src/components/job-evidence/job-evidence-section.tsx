"use client";

import { useActionState, useState } from "react";
import { JobEvidenceStatus } from "@prisma/client";

import { staffAcceptJobEvidence, staffRejectJobEvidence } from "@/app/(app)/app/job-evidence/actions";
import type { JobEvidenceMutationResult } from "@/server/phase12/job-evidence-mutations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { jobEvidenceStatusLabel, type JobEvidenceRowDto } from "@/components/job-evidence/job-evidence-types-ui";

function statusBadgeClass(s: JobEvidenceStatus): string {
  switch (s) {
    case JobEvidenceStatus.CANDIDATE:
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case JobEvidenceStatus.ACCEPTED:
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-100";
    case JobEvidenceStatus.REJECTED:
      return "border-destructive/35 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}

function MutationErr({ r }: { r: JobEvidenceMutationResult | undefined }) {
  if (!r || r.ok) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {r.error}
    </p>
  );
}

export function JobEvidenceSection(props: {
  canManage: boolean;
  canView: boolean;
  rows: JobEvidenceRowDto[];
}) {
  const { canManage, canView, rows } = props;
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [acceptState, acceptAction, acceptPending] = useActionState(staffAcceptJobEvidence, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState(staffRejectJobEvidence, undefined);

  return (
    <section id="job-evidence" className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Evidence</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Accepting evidence here records proof only; it does not complete execution tasks. Mark tasks complete from the
          plan below when work is done and any evidence rules are satisfied.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Promoted files from customer uploads. Intake submissions stay separate until your team promotes and accepts
          items here.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No evidence has been promoted for this job yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-sm border border-border bg-background/30">
          {rows.map((row) => (
            <li key={row.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(row.status)}`}
                    >
                      {jobEvidenceStatusLabel(row.status)}
                    </span>
                    <span className="rounded-sm border border-border bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">
                      Customer upload
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  {row.description ? (
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{row.description}</p>
                  ) : null}
                  {row.jobTaskTitle ? (
                    <p className="text-xs text-muted-foreground">
                      Linked task: <span className="font-medium text-foreground">{row.jobTaskTitle}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Scope: job-level</p>
                  )}
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    Promoted {new Date(row.promotedAt).toLocaleString()}
                    {row.promotedByLabel ? ` · ${row.promotedByLabel}` : ""}
                  </p>
                  {row.reviewedAt ? (
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      Reviewed {new Date(row.reviewedAt).toLocaleString()}
                      {row.reviewedByLabel ? ` · ${row.reviewedByLabel}` : ""}
                    </p>
                  ) : null}
                  {row.status === JobEvidenceStatus.REJECTED && row.rejectionReason ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Rejection reason: </span>
                      {row.rejectionReason}
                    </p>
                  ) : null}
                </div>
                {canView && row.sourceAttachmentId ? (
                  <a
                    href={`/app/customer-portal-submissions/attachments/${encodeURIComponent(row.sourceAttachmentId)}`}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    Download file
                  </a>
                ) : null}
              </div>

              {row.status === JobEvidenceStatus.CANDIDATE && canManage ? (
                <div className="space-y-3 border-t border-border/60 pt-3">
                  <div className="flex flex-wrap gap-2">
                    <form action={acceptAction}>
                      <input type="hidden" name="evidenceId" value={row.id} />
                      <Button type="submit" size="sm" variant="secondary" disabled={acceptPending}>
                        {acceptPending ? "…" : "Accept"}
                      </Button>
                    </form>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectingId((v) => (v === row.id ? null : row.id))}
                    >
                      {rejectingId === row.id ? "Cancel reject" : "Reject"}
                    </Button>
                  </div>
                  <MutationErr r={acceptState} />
                  {rejectingId === row.id ? (
                    <form action={rejectAction} className="max-w-md space-y-2">
                      <input type="hidden" name="evidenceId" value={row.id} />
                      <Label htmlFor={`reject-${row.id}`} className="text-xs text-muted-foreground">
                        Rejection reason
                      </Label>
                      <Textarea
                        id={`reject-${row.id}`}
                        name="rejectionReason"
                        required
                        rows={3}
                        placeholder="Explain why this evidence is not accepted."
                        className="rounded-sm text-sm"
                      />
                      <Button type="submit" size="sm" variant="destructive" disabled={rejectPending}>
                        {rejectPending ? "…" : "Confirm reject"}
                      </Button>
                      <MutationErr r={rejectState} />
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
