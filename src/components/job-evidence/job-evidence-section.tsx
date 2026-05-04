"use client";

import { useActionState, useState } from "react";
import { JobEvidenceStatus } from "@prisma/client";

import { staffAcceptJobEvidence, staffRejectJobEvidence } from "@/app/(app)/app/job-evidence/actions";
import type { JobEvidenceMutationResult } from "@/server/phase12/job-evidence-mutations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workspaceTextareaClass } from "@/components/workspace/workspace-form-controls";
import { jobEvidenceStatusLabel, type JobEvidenceRowDto } from "@/components/job-evidence/job-evidence-types-ui";
import { cn } from "@/lib/utils";

const evidenceBadgeBase = "rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

function statusBadgeClass(s: JobEvidenceStatus): string {
  switch (s) {
    case JobEvidenceStatus.CANDIDATE:
      return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100";
    case JobEvidenceStatus.ACCEPTED:
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
    case JobEvidenceStatus.REJECTED:
      return "border-destructive/35 bg-destructive/10 text-destructive dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
    default:
      return "border-border bg-muted/30 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500";
  }
}

function MutationErr({ r }: { r: JobEvidenceMutationResult | undefined }) {
  if (!r || r.ok) return null;
  return (
    <p className="text-xs font-medium text-destructive dark:text-red-400" role="alert">
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
    <section
      id="job-evidence"
      className="min-w-0 space-y-4 rounded-[6px] border border-border/80 bg-card/25 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/30 sm:p-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground dark:text-zinc-100">Evidence</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
          Accepting evidence here records proof only; it does not complete execution tasks. Mark tasks complete from the
          plan below when work is done and any evidence rules are satisfied.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
          Promoted files from customer uploads. Intake submissions stay separate until your team promotes and accepts
          items here.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground dark:text-zinc-500">No evidence has been promoted for this job yet.</p>
      ) : (
        <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-background/25 dark:divide-zinc-800/60 dark:border-zinc-800/60 dark:bg-zinc-950/20">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0 space-y-3 px-3.5 py-3.5 sm:px-4 sm:py-4">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(evidenceBadgeBase, statusBadgeClass(row.status))}>
                      {jobEvidenceStatusLabel(row.status)}
                    </span>
                    <span
                      className={cn(
                        evidenceBadgeBase,
                        "border-border bg-muted/25 font-medium normal-case tracking-normal text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500",
                      )}
                    >
                      Customer upload
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground dark:text-zinc-100">{row.title}</p>
                  {row.description ? (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
                      {row.description}
                    </p>
                  ) : null}
                  {row.jobTaskTitle ? (
                    <p className="text-xs text-muted-foreground dark:text-zinc-500">
                      Linked task: <span className="font-medium text-foreground dark:text-zinc-200">{row.jobTaskTitle}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground dark:text-zinc-500">Scope: job-level</p>
                  )}
                  <p className="text-[11px] tabular-nums text-muted-foreground dark:text-zinc-500">
                    Promoted {new Date(row.promotedAt).toLocaleString()}
                    {row.promotedByLabel ? ` · ${row.promotedByLabel}` : ""}
                  </p>
                  {row.reviewedAt ? (
                    <p className="text-[11px] tabular-nums text-muted-foreground dark:text-zinc-500">
                      Reviewed {new Date(row.reviewedAt).toLocaleString()}
                      {row.reviewedByLabel ? ` · ${row.reviewedByLabel}` : ""}
                    </p>
                  ) : null}
                  {row.status === JobEvidenceStatus.REJECTED && row.rejectionReason ? (
                    <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
                      <span className="font-medium text-foreground dark:text-zinc-200">Rejection reason: </span>
                      {row.rejectionReason}
                    </p>
                  ) : null}
                </div>
                {canView && row.sourceAttachmentId ? (
                  <a
                    href={`/app/customer-portal-submissions/attachments/${encodeURIComponent(row.sourceAttachmentId)}`}
                    className="shrink-0 text-sm font-medium text-primary hover:underline dark:text-blue-400"
                  >
                    Download file
                  </a>
                ) : null}
              </div>

              {row.status === JobEvidenceStatus.CANDIDATE && canManage ? (
                <div className="space-y-3 border-t border-border/70 pt-3 dark:border-zinc-800/60">
                  <div className="flex flex-wrap gap-2">
                    <form action={acceptAction}>
                      <input type="hidden" name="evidenceId" value={row.id} />
                      <Button type="submit" size="sm" variant="secondary" className="rounded-[5px] font-semibold" disabled={acceptPending}>
                        {acceptPending ? "…" : "Accept"}
                      </Button>
                    </form>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-[5px] font-semibold"
                      onClick={() => setRejectingId((v) => (v === row.id ? null : row.id))}
                    >
                      {rejectingId === row.id ? "Cancel reject" : "Reject"}
                    </Button>
                  </div>
                  <MutationErr r={acceptState} />
                  {rejectingId === row.id ? (
                    <form action={rejectAction} className="max-w-md min-w-0 space-y-2">
                      <input type="hidden" name="evidenceId" value={row.id} />
                      <Label
                        htmlFor={`reject-${row.id}`}
                        className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600"
                      >
                        Rejection reason
                      </Label>
                      <Textarea
                        id={`reject-${row.id}`}
                        name="rejectionReason"
                        required
                        rows={3}
                        placeholder="Explain why this evidence is not accepted."
                        className={cn(workspaceTextareaClass(), "min-h-[4.5rem] resize-y")}
                      />
                      <Button type="submit" size="sm" variant="destructive" className="rounded-[5px] font-semibold" disabled={rejectPending}>
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
