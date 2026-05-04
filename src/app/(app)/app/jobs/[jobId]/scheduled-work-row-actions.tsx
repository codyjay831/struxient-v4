"use client";

import { useActionState, useEffect, useState } from "react";
import { ScheduledWorkStatus } from "@prisma/client";
import {
  cancelScheduledWorkAction,
  rescheduleScheduledWorkAction,
  type ScheduledWorkActionResult,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  workspaceDialogContentClass,
  workspaceInputClass,
  workspaceTextareaClass,
} from "@/components/workspace/workspace-form-controls";
import { cn } from "@/lib/utils";

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

export function ScheduledWorkRowActions(props: {
  scheduledWorkId: string;
  status: ScheduledWorkStatus;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
}) {
  const { scheduledWorkId, status, scheduledStartAt, scheduledEndAt } = props;
  const [resOpen, setResOpen] = useState(false);
  const [startLocal, setStartLocal] = useState(() => localInputValueFromDate(scheduledStartAt));
  const [endLocal, setEndLocal] = useState(() => localInputValueFromDate(scheduledEndAt));
  const [resState, resAction, resPending] = useActionState(
    rescheduleScheduledWorkAction,
    undefined as ScheduledWorkActionResult | undefined,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelScheduledWorkAction,
    undefined as ScheduledWorkActionResult | undefined,
  );

  useEffect(() => {
    if (resState?.ok) {
      setResOpen(false);
    }
  }, [resState?.ok]);

  useEffect(() => {
    if (resOpen) {
      setStartLocal(localInputValueFromDate(scheduledStartAt));
      setEndLocal(localInputValueFromDate(scheduledEndAt));
    }
  }, [resOpen, scheduledStartAt, scheduledEndAt]);

  if (status !== ScheduledWorkStatus.SCHEDULED) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Dialog open={resOpen} onOpenChange={setResOpen}>
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="outline" className="rounded-[5px] font-semibold">
            Reschedule
          </Button>
        </DialogTrigger>
        <DialogContent className={cn(workspaceDialogContentClass(), "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-base">Reschedule</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update the start and end for this booked window. History is retained on the job timeline.
            </DialogDescription>
          </DialogHeader>
          <form action={resAction} className="space-y-4">
            <input type="hidden" name="scheduledWorkId" value={scheduledWorkId} />
            <input type="hidden" name="scheduledStartAt" value={toIsoFromLocalInput(startLocal) ?? ""} />
            <input type="hidden" name="scheduledEndAt" value={toIsoFromLocalInput(endLocal) ?? ""} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  className={cn(workspaceInputClass(), "h-9 min-w-0")}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input
                  type="datetime-local"
                  value={endLocal}
                  onChange={(e) => setEndLocal(e.target.value)}
                  className={cn(workspaceInputClass(), "h-9 min-w-0")}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`res-notes-${scheduledWorkId}`} className="text-xs text-muted-foreground">
                Notes (optional)
              </Label>
              <Textarea
                id={`res-notes-${scheduledWorkId}`}
                name="notes"
                rows={2}
                className={cn(workspaceTextareaClass(), "min-h-[3.25rem] resize-y")}
              />
            </div>
            {resState && !resState.ok ? (
              <p className="text-xs text-destructive" role="alert">
                {resState.error}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" className="rounded-[5px]" onClick={() => setResOpen(false)}>
                Close
              </Button>
              <Button type="submit" className="rounded-[5px] font-semibold" disabled={resPending}>
                {resPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <form action={cancelAction} className="flex flex-col gap-2">
        <input type="hidden" name="scheduledWorkId" value={scheduledWorkId} />
        <div className="space-y-1.5">
          <Label htmlFor={`cancel-reason-${scheduledWorkId}`} className="text-xs text-muted-foreground">
            Cancel reason
          </Label>
          <Textarea
            id={`cancel-reason-${scheduledWorkId}`}
            name="cancelReason"
            rows={2}
            required
            className={cn(workspaceTextareaClass(), "max-w-md min-h-[3.25rem] resize-y")}
            placeholder="Why is this window being removed?"
          />
        </div>
        {cancelState && !cancelState.ok ? (
          <p className="text-xs text-destructive" role="alert">
            {cancelState.error}
          </p>
        ) : null}
        <Button type="submit" size="sm" variant="destructive" className="w-fit rounded-[5px] font-semibold" disabled={cancelPending}>
          {cancelPending ? "Canceling…" : "Cancel scheduled work"}
        </Button>
      </form>
    </div>
  );
}
