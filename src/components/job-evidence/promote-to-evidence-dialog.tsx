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
import {
  workspaceDialogContentClass,
  workspaceInputClass,
  workspaceSelectClass,
  workspaceTextareaClass,
} from "@/components/workspace/workspace-form-controls";
import { cn } from "@/lib/utils";

function Err({ r }: { r: JobEvidenceMutationResult | undefined }) {
  if (!r || r.ok) return null;
  return (
    <p className="text-xs font-medium text-destructive dark:text-red-400" role="alert">
      {r.error}
    </p>
  );
}

const labelSm = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600";

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
        <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-[5px] font-semibold" disabled={!canOpen}>
          Promote to evidence
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(workspaceDialogContentClass(), "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground dark:text-zinc-100">Promote to job evidence</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
            Creates a candidate evidence record for internal review. This does not change the customer upload status or
            complete any task.
          </DialogDescription>
        </DialogHeader>
        {disabledReason ? (
          <p className="text-sm text-muted-foreground dark:text-zinc-500">{disabledReason}</p>
        ) : (
          <form action={action} className="min-w-0 space-y-4">
            <input type="hidden" name="sourceAttachmentId" value={sourceAttachmentId} />
            <input type="hidden" name="jobId" value={jobId} />
            {quoteIdForRevalidate ? <input type="hidden" name="quoteId" value={quoteIdForRevalidate} /> : null}
            <input type="hidden" name="jobTaskId" value={target === "task" && taskId ? taskId : ""} />

            <div className="space-y-1.5">
              <Label htmlFor={titleId} className={labelSm}>
                Evidence title
              </Label>
              <Input
                id={titleId}
                name="title"
                required
                maxLength={200}
                className={cn(workspaceInputClass(), "min-w-0")}
                placeholder="Short label for staff"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={descId} className={labelSm}>
                Description <span className="font-normal normal-case tracking-normal text-muted-foreground/90">(optional)</span>
              </Label>
              <Textarea
                id={descId}
                name="description"
                rows={3}
                maxLength={4000}
                className={cn(workspaceTextareaClass(), "min-h-[4.5rem] min-w-0 resize-y")}
                placeholder="Context for reviewers"
              />
            </div>

            <fieldset className="min-w-0 space-y-2 rounded-[6px] border border-border/80 bg-card/20 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/25">
              <legend className={cn(labelSm, "px-0.5")}>Link to</legend>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground dark:text-zinc-200">
                <input
                  type="radio"
                  checked={target === "job"}
                  onChange={() => setTarget("job")}
                  className="size-3.5 shrink-0 rounded-full border-border text-primary dark:border-zinc-600"
                />
                Job-level evidence
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 text-xs text-foreground dark:text-zinc-200",
                  taskOptions.length === 0 ? "opacity-60" : null,
                )}
              >
                <input
                  type="radio"
                  checked={target === "task"}
                  onChange={() => setTarget("task")}
                  disabled={taskOptions.length === 0}
                  className="size-3.5 shrink-0 rounded-full border-border text-primary dark:border-zinc-600"
                />
                Specific task
              </label>
              {target === "task" ? (
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className={cn(workspaceSelectClass(), "mt-1 h-9 w-full min-w-0")}
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
              <p className="text-xs text-muted-foreground dark:text-zinc-500">A job-level promotion already exists for this file.</p>
            ) : null}
            {target === "task" && selectedTaskPromoted ? (
              <p className="text-xs text-muted-foreground dark:text-zinc-500">This file was already promoted for the selected task.</p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" className="rounded-[5px]" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || submitBlocked} className="rounded-[5px] font-semibold">
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
