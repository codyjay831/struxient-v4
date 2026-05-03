"use client";

import { useActionState, useEffect, useState } from "react";
import { updateJobTaskCompletionRequirementsAction } from "@/app/(app)/app/jobs/[jobId]/actions";
import type { CompletionRequirementMutationResult } from "@/server/phase13/completion-requirement-mutations";
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
import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";

function Err({ r }: { r: CompletionRequirementMutationResult | undefined }) {
  if (!r || r.ok) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {r.error}
    </p>
  );
}

export function JobTaskCompletionRequirementsDialog(props: {
  jobId: string;
  taskId: string;
  taskTitle: string;
  requirement: CompletionRequirementDto;
}) {
  const { jobId, taskId, taskTitle, requirement } = props;
  const [open, setOpen] = useState(false);
  const active = requirement.state === "active";
  const [required, setRequired] = useState(active);
  const [minCount, setMinCount] = useState(
    requirement.state === "active" ? requirement.minAcceptedCount : 1,
  );
  const [allowJobLevel, setAllowJobLevel] = useState(
    requirement.state === "active" ? requirement.allowJobLevelEvidence : false,
  );

  const [state, action, pending] = useActionState(updateJobTaskCompletionRequirementsAction, undefined);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state?.ok]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setRequired(requirement.state === "active");
          setMinCount(requirement.state === "active" ? requirement.minAcceptedCount : 1);
          setAllowJobLevel(requirement.state === "active" ? requirement.allowJobLevelEvidence : false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="rounded-sm text-xs">
          Evidence requirement
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-sm border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Completion evidence requirement</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Configure whether this task must have accepted job evidence before it can be marked complete. This does
            not change the quote or sent snapshot.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="jobTaskId" value={taskId} />
          <input type="hidden" name="required" value={required ? "true" : "false"} />
          <input type="hidden" name="allowJobLevelEvidence" value={allowJobLevel ? "true" : "false"} />
          <p className="text-xs text-muted-foreground">
            Task: <span className="font-medium text-foreground">{taskTitle}</span>
          </p>
          <div className="flex items-center gap-2">
            <input
              id={`req-${taskId}`}
              type="checkbox"
              className="h-3.5 w-3.5 rounded-sm border border-input"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <Label htmlFor={`req-${taskId}`} className="text-sm font-normal text-foreground cursor-pointer">
              Require accepted evidence before completion
            </Label>
          </div>
          {required ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`min-${taskId}`} className="text-xs text-muted-foreground">
                  Minimum accepted evidence count
                </Label>
                <select
                  id={`min-${taskId}`}
                  name="minAcceptedCount"
                  value={minCount}
                  onChange={(e) => setMinCount(Number(e.target.value))}
                  className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={`jl-${taskId}`}
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded-sm border border-input"
                  checked={allowJobLevel}
                  onChange={(e) => setAllowJobLevel(e.target.checked)}
                />
                <Label htmlFor={`jl-${taskId}`} className="text-sm font-normal text-foreground cursor-pointer">
                  Allow job-level accepted evidence to count (not only rows linked to this task)
                </Label>
              </div>
            </div>
          ) : (
            <input type="hidden" name="minAcceptedCount" value="1" />
          )}
          <Err r={state} />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" size="sm" className="rounded-sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="rounded-sm" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
