"use client";

import { JobStatus } from "@prisma/client";
import { useActionState, useEffect, useState } from "react";
import {
  cancelJob,
  completeJob,
  pauseJob,
  resumeJob,
  type JobLifecycleActionResult,
} from "@/app/(app)/app/jobs/[jobId]/actions";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workspaceDialogContentClass, workspaceTextareaClass } from "@/components/workspace/workspace-form-controls";
import { cn } from "@/lib/utils";

function LifecycleFormFeedback({ state }: { state: JobLifecycleActionResult | undefined }) {
  if (!state || state.ok) {
    return null;
  }
  return (
    <p className="text-sm font-medium text-destructive dark:text-red-400" role="alert">
      {state.error}
    </p>
  );
}

function FieldErrors({ state }: { state: JobLifecycleActionResult | undefined }) {
  if (!state || state.ok || !state.fieldErrors) {
    return null;
  }
  return (
    <ul className="list-inside list-disc text-sm text-destructive dark:text-red-400">
      {Object.entries(state.fieldErrors).map(([k, msgs]) => (
        <li key={k}>
          {k}: {msgs.join(", ")}
        </li>
      ))}
    </ul>
  );
}

export function JobLifecycleToolbar(props: { jobId: string; status: JobStatus }) {
  const { jobId, status } = props;
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [pauseState, pauseAction] = useActionState(pauseJob, undefined);
  const [resumeState, resumeAction] = useActionState(resumeJob, undefined);
  const [completeState, completeAction] = useActionState(completeJob, undefined);
  const [cancelState, cancelAction] = useActionState(cancelJob, undefined);

  useEffect(() => {
    if (pauseState?.ok) {
      setPauseOpen(false);
    }
  }, [pauseState]);
  useEffect(() => {
    if (resumeState?.ok) {
      setResumeOpen(false);
    }
  }, [resumeState]);
  useEffect(() => {
    if (completeState?.ok) {
      setCompleteOpen(false);
    }
  }, [completeState]);
  useEffect(() => {
    if (cancelState?.ok) {
      setCancelOpen(false);
    }
  }, [cancelState]);

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {status === JobStatus.ACTIVE ? (
        <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="rounded-[5px] font-semibold">
              Pause job
            </Button>
          </DialogTrigger>
          <DialogContent className={workspaceDialogContentClass()}>
            <DialogHeader>
              <DialogTitle>Pause job</DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-zinc-500">
                Field roles cannot update tasks while the job is paused. Office staff can still update tasks if needed.
              </DialogDescription>
            </DialogHeader>
            <form action={pauseAction} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <div className="space-y-2">
                <Label htmlFor="pause-reason" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                  Note (optional)
                </Label>
                <Textarea
                  id="pause-reason"
                  name="statusReason"
                  rows={3}
                  placeholder="Visible internally on the job record."
                  className={cn(workspaceTextareaClass(), "min-h-[4.5rem] resize-y")}
                />
              </div>
              <LifecycleFormFeedback state={pauseState} />
              <FieldErrors state={pauseState} />
              <DialogFooter>
                <Button type="submit" className="rounded-[5px] font-semibold">
                  Confirm pause
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {status === JobStatus.PAUSED ? (
        <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="rounded-[5px] font-semibold">
              Resume job
            </Button>
          </DialogTrigger>
          <DialogContent className={workspaceDialogContentClass()}>
            <DialogHeader>
              <DialogTitle>Resume job</DialogTitle>
              <DialogDescription className="text-muted-foreground dark:text-zinc-500">
                The job returns to active. Field roles can update tasks again. Any pause note on the job is cleared.
              </DialogDescription>
            </DialogHeader>
            <form action={resumeAction} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <LifecycleFormFeedback state={resumeState} />
              <DialogFooter>
                <Button type="submit" className="rounded-[5px] font-semibold">
                  Resume
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      {status === JobStatus.ACTIVE || status === JobStatus.PAUSED ? (
        <>
          <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="default" size="sm" className="rounded-[5px] font-semibold">
                Complete job
              </Button>
            </DialogTrigger>
            <DialogContent className={workspaceDialogContentClass()}>
              <DialogHeader>
                <DialogTitle>Complete job</DialogTitle>
                <DialogDescription className="text-muted-foreground dark:text-zinc-500">
                  The job closes after completion. All required tasks must already be marked complete. Task updates are then
                  disabled.
                </DialogDescription>
              </DialogHeader>
              <form action={completeAction} className="space-y-4">
                <input type="hidden" name="jobId" value={jobId} />
                <LifecycleFormFeedback state={completeState} />
                <DialogFooter>
                  <Button type="submit" className="rounded-[5px] font-semibold">
                    Mark job complete
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-[5px] border-destructive/45 font-semibold text-destructive hover:bg-destructive/10 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Cancel job
              </Button>
            </DialogTrigger>
            <DialogContent className={workspaceDialogContentClass()}>
              <DialogHeader>
                <DialogTitle>Cancel job</DialogTitle>
                <DialogDescription className="text-muted-foreground dark:text-zinc-500">
                  Cancels operational work for this job. This does not change the archived quote. A reason is required for
                  the audit trail.
                </DialogDescription>
              </DialogHeader>
              <form action={cancelAction} className="space-y-4">
                <input type="hidden" name="jobId" value={jobId} />
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                    Reason
                  </Label>
                  <Textarea
                    id="cancel-reason"
                    name="reason"
                    required
                    rows={4}
                    placeholder="Why is this job being canceled?"
                    className={cn(workspaceTextareaClass(), "min-h-[5rem] resize-y")}
                  />
                </div>
                <LifecycleFormFeedback state={cancelState} />
                <FieldErrors state={cancelState} />
                <DialogFooter>
                  <Button type="submit" variant="destructive" className="rounded-[5px] font-semibold">
                    Confirm cancel
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
