"use client";

import { JobStatus } from "@prisma/client";
import { useActionState, useEffect, useState } from "react";
import { cancelJob, completeJob, pauseJob, resumeJob, type JobLifecycleActionResult } from "@/app/(app)/app/jobs/[jobId]/actions";
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

function LifecycleFormFeedback({ state }: { state: JobLifecycleActionResult | undefined }) {
  if (!state || state.ok) {
    return null;
  }
  return (
    <p className="text-sm text-destructive" role="alert">
      {state.error}
    </p>
  );
}

function FieldErrors({ state }: { state: JobLifecycleActionResult | undefined }) {
  if (!state || state.ok || !state.fieldErrors) {
    return null;
  }
  return (
    <ul className="list-inside list-disc text-sm text-destructive">
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
    <div className="flex flex-wrap gap-2">
      {status === JobStatus.ACTIVE ? (
        <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="rounded-sm">
              Pause job
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader>
              <DialogTitle>Pause job</DialogTitle>
              <DialogDescription>
                Field roles cannot update tasks while the job is paused. Office staff can still update tasks if needed.
              </DialogDescription>
            </DialogHeader>
            <form action={pauseAction} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <div className="space-y-2">
                <Label htmlFor="pause-reason" className="text-muted-foreground">
                  Note (optional)
                </Label>
                <Textarea
                  id="pause-reason"
                  name="statusReason"
                  rows={3}
                  placeholder="Visible internally on the job record."
                  className="rounded-sm resize-y"
                />
              </div>
              <LifecycleFormFeedback state={pauseState} />
              <FieldErrors state={pauseState} />
              <DialogFooter>
                <Button type="submit" className="rounded-sm">
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
            <Button type="button" variant="secondary" size="sm" className="rounded-sm">
              Resume job
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-sm">
            <DialogHeader>
              <DialogTitle>Resume job</DialogTitle>
              <DialogDescription>
                The job returns to active. Field roles can update tasks again. Any pause note on the job is cleared.
              </DialogDescription>
            </DialogHeader>
            <form action={resumeAction} className="space-y-4">
              <input type="hidden" name="jobId" value={jobId} />
              <LifecycleFormFeedback state={resumeState} />
              <DialogFooter>
                <Button type="submit" className="rounded-sm">
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
              <Button type="button" variant="default" size="sm" className="rounded-sm">
                Complete job
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader>
                <DialogTitle>Complete job</DialogTitle>
                <DialogDescription>
                  The job closes after completion. All required tasks must already be marked complete. Task updates are
                  then disabled.
                </DialogDescription>
              </DialogHeader>
              <form action={completeAction} className="space-y-4">
                <input type="hidden" name="jobId" value={jobId} />
                <LifecycleFormFeedback state={completeState} />
                <DialogFooter>
                  <Button type="submit" className="rounded-sm">
                    Mark job complete
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-sm border-destructive/50 text-destructive hover:bg-destructive/10">
                Cancel job
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader>
                <DialogTitle>Cancel job</DialogTitle>
                <DialogDescription>
                  Cancels operational work for this job. This does not change the archived quote. A reason is required
                  for the audit trail.
                </DialogDescription>
              </DialogHeader>
              <form action={cancelAction} className="space-y-4">
                <input type="hidden" name="jobId" value={jobId} />
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">Reason</Label>
                  <Textarea
                    id="cancel-reason"
                    name="reason"
                    required
                    rows={4}
                    placeholder="Why is this job being canceled?"
                    className="rounded-sm resize-y"
                  />
                </div>
                <LifecycleFormFeedback state={cancelState} />
                <FieldErrors state={cancelState} />
                <DialogFooter>
                  <Button type="submit" variant="destructive" className="rounded-sm">
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
