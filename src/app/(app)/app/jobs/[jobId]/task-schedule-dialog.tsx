"use client";

import { useActionState, useEffect, useState } from "react";
import { JobStatus, JobTaskStatus } from "@prisma/client";
import { scheduleJobTaskAction, type ScheduledWorkActionResult } from "@/app/(app)/app/jobs/[jobId]/actions";
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

function localInputValueFromDate(d: Date): string {
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoFromLocalInput(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString();
}

export function TaskScheduleDialog(props: {
  jobId: string;
  taskId: string;
  taskTitle: string;
  taskStatus: JobTaskStatus;
  jobStatus: JobStatus;
  disabled: boolean;
  disabledReason?: string;
}) {
  const { jobId, taskId, taskTitle, taskStatus, jobStatus, disabled, disabledReason } = props;
  const [open, setOpen] = useState(false);
  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const [startLocal, setStartLocal] = useState(() => localInputValueFromDate(now));
  const [endLocal, setEndLocal] = useState(() => localInputValueFromDate(defaultEnd));
  const [state, action, pending] = useActionState(scheduleJobTaskAction, undefined as ScheduledWorkActionResult | undefined);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state?.ok]);

  const blockedOrPaused =
    taskStatus === JobTaskStatus.BLOCKED ||
    jobStatus === JobStatus.PAUSED ||
    jobStatus === JobStatus.COMPLETED ||
    jobStatus === JobStatus.CANCELED;

  if (disabled) {
    return (
      <div className="mt-2 shrink-0">
        <Button type="button" size="sm" variant="outline" className="rounded-sm" disabled>
          Schedule
        </Button>
        {disabledReason ? <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">{disabledReason}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 shrink-0">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) {
            const n = new Date();
            setStartLocal(localInputValueFromDate(n));
            setEndLocal(localInputValueFromDate(new Date(n.getTime() + 2 * 60 * 60 * 1000)));
          }
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="rounded-sm">
            Schedule
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Schedule task</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {taskTitle}. Times are saved using your browser&apos;s local timezone and stored in UTC.
            </DialogDescription>
          </DialogHeader>
          {blockedOrPaused ? (
            <div
              className="rounded-sm border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground"
              role="status"
            >
              {taskStatus === JobTaskStatus.BLOCKED ? (
                <p>
                  This can be placed on the calendar as a planned window, but the task is <span className="font-medium">blocked</span>{" "}
                  until blockers are resolved.
                </p>
              ) : null}
              {jobStatus === JobStatus.PAUSED ? (
                <p className={taskStatus === JobTaskStatus.BLOCKED ? "mt-2" : ""}>
                  The job is <span className="font-medium">paused</span>. Scheduled work may need to move when the job resumes.
                </p>
              ) : null}
            </div>
          ) : null}
          <form action={action} className="space-y-4">
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="jobTaskId" value={taskId} />
            <input type="hidden" name="scheduledStartAt" value={toIsoFromLocalInput(startLocal) ?? ""} />
            <input type="hidden" name="scheduledEndAt" value={toIsoFromLocalInput(endLocal) ?? ""} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`sw-start-${taskId}`} className="text-xs text-muted-foreground">
                  Start
                </Label>
                <Input
                  id={`sw-start-${taskId}`}
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className="rounded-sm text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sw-end-${taskId}`} className="text-xs text-muted-foreground">
                  End
                </Label>
                <Input
                  id={`sw-end-${taskId}`}
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className="rounded-sm text-sm"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sw-notes-${taskId}`} className="text-xs text-muted-foreground">
                Notes (optional)
              </Label>
              <Textarea
                id={`sw-notes-${taskId}`}
                name="notes"
                rows={2}
                className="rounded-sm text-sm"
                placeholder="Crew notes, access details, or constraints"
              />
            </div>
            {state && !state.ok ? (
              <p className="text-xs text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                className="rounded-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
              <Button type="submit" className="rounded-sm" disabled={pending}>
                {pending ? "Saving…" : "Save schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
