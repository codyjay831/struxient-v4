"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { CustomerPortalSubmissionAttachmentStatus } from "@prisma/client";

import { staffPromoteUploadToJobEvidence } from "@/app/(app)/app/job-evidence/actions";
import type { JobEvidenceMutationResult } from "@/server/phase12/job-evidence-mutations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Err({ r }: { r: JobEvidenceMutationResult | undefined }) {
  if (!r || r.ok) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {r.error}
    </p>
  );
}

export function PromoteToEvidenceDialog(props: {
  jobId: string;
  sourceAttachmentId: string;
  attachmentStatus: CustomerPortalSubmissionAttachmentStatus;
  taskOptions: { id: string; title: string }[];
  /** When opened from quote workspace, revalidate quote path after promote. */
  quoteIdForRevalidate?: string | null;
  disabledReason?: string | null;
  alreadyPromotedForJobLevel: boolean;
  promotedTaskIds: string[];
}) {
  const {
    jobId,
    sourceAttachmentId,
    attachmentStatus,
    taskOptions,
    quoteIdForRevalidate,
    disabledReason,
    alreadyPromotedForJobLevel,
    promotedTaskIds,
  } = props;
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<"job" | "task">("job");
  const [taskId, setTaskId] = useState<string>(taskOptions[0]?.id ?? "");
  const titleId = useId();
  const descId = useId();
  const [state, action, pending] = useActionState(staffPromoteUploadToJobEvidence, undefined);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  const canOpen =
    attachmentStatus === CustomerPortalSubmissionAttachmentStatus.STORED && !disabledReason && !pending;

  const selectedTaskPromoted = target === "task" && taskId.length > 0 && promotedTaskIds.includes(taskId);
  const jobLevelBlocked = target === "job" && alreadyPromotedForJobLevel;
  const submitBlocked = jobLevelBlocked || selectedTaskPromoted || (target === "task" && taskOptions.length === 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="rounded-sm shrink-0" disabled={!canOpen}>
          Promote to evidence
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Promote to job evidence</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Creates a candidate evidence record for internal review. This does not change the customer upload status or
            complete any task.
          </DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <p className="text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="sourceAttachmentId" value={sourceAttachmentId} />
            <input type="hidden" name="jobId" value={jobId} />
            {quoteIdForRevalidate ? <input type="hidden" name="quoteId" value={quoteIdForRevalidate} /> : null}
            <input type="hidden" name="jobTaskId" value={target === "task" && taskId ? taskId : ""} />

            <div className="space-y-2">
              <Label htmlFor={titleId} className="text-xs text-muted-foreground">
                Evidence title
              </Label>
              <Input id={titleId} name="title" required maxLength={200} className="rounded-sm" placeholder="Short label for staff" />
            </div>

            <div className="space-y-2">
              <Label htmlFor={descId} className="text-xs text-muted-foreground">
                Description <span className="text-muted-foreground/80">(optional)</span>
              </Label>
              <Textarea
                id={descId}
                name="description"
                rows={3}
                maxLength={4000}
                className="rounded-sm text-sm"
                placeholder="Context for reviewers"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-foreground">Link to</legend>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  checked={target === "job"}
                  onChange={() => setTarget("job")}
                  className="rounded-full border-border"
                />
                Job-level evidence
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  checked={target === "task"}
                  onChange={() => setTarget("task")}
                  disabled={taskOptions.length === 0}
                  className="rounded-full border-border"
                />
                Specific task
              </label>
              {target === "task" ? (
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  aria-label="Job task"
                >
                  {taskOptions.length === 0 ? (
                    <option value="">No tasks on this job</option>
                  ) : (
                    taskOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))
                  )}
                </select>
              ) : null}
            </fieldset>

            {target === "job" && alreadyPromotedForJobLevel ? (
              <p className="text-xs text-muted-foreground">A job-level promotion already exists for this file.</p>
            ) : null}
            {target === "task" && selectedTaskPromoted ? (
              <p className="text-xs text-muted-foreground">This file was already promoted for the selected task.</p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" className="rounded-sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || submitBlocked} className="rounded-sm">
                {pending ? "…" : "Create candidate"}
              </Button>
            </DialogFooter>
            <Err r={state} />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
