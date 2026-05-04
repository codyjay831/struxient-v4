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
import { workspaceDialogContentClass, workspaceSelectClass } from "@/components/workspace/workspace-form-controls";
import { cn } from "@/lib/utils";

function Err({ r }: { r: CompletionRequirementMutationResult | undefined }) {
  if (!r || r.ok) return null;
  return (
    <p className="text-xs font-medium text-destructive dark:text-red-400" role="alert">
      {r.error}
    </p>
  );
}

const labelSm = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600";

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
        <Button type="button" size="sm" variant="outline" className="rounded-[5px] text-xs font-semibold">
          Evidence requirement
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(workspaceDialogContentClass(), "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground dark:text-zinc-100">
            Completion evidence requirement
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
            Configure whether this task must have accepted job evidence before it can be marked complete. This does
            not change the quote or sent snapshot.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="min-w-0 space-y-4">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="jobTaskId" value={taskId} />
          <input type="hidden" name="required" value={required ? "true" : "false"} />
          <input type="hidden" name="allowJobLevelEvidence" value={allowJobLevel ? "true" : "false"} />

          {requirement.state === "invalid" ? (
            <div
              className="rounded-[6px] border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10"
              role="status"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                Invalid stored configuration
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-950/90 dark:text-amber-100/90">{requirement.message}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">
                Saving a valid requirement below replaces the invalid JSON for this task.
              </p>
            </div>
          ) : null}

          <div className="rounded-[6px] border border-border/80 bg-card/20 px-3 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-950/30">
            <p className={labelSm}>Task</p>
            <p className="mt-0.5 text-sm font-medium text-foreground dark:text-zinc-100">{taskTitle}</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`req-${taskId}`}
              type="checkbox"
              className="size-3.5 shrink-0 rounded-[4px] border border-input dark:border-zinc-600"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <Label htmlFor={`req-${taskId}`} className="cursor-pointer text-xs font-normal text-foreground dark:text-zinc-200">
              Require accepted evidence before completion
            </Label>
          </div>
          {required ? (
            <div className="space-y-3 rounded-[6px] border border-border/80 bg-card/15 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/20">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={`min-${taskId}`} className={labelSm}>
                  Minimum accepted evidence count
                </Label>
                <select
                  id={`min-${taskId}`}
                  name="minAcceptedCount"
                  value={minCount}
                  onChange={(e) => setMinCount(Number(e.target.value))}
                  className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
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
                  className="size-3.5 shrink-0 rounded-[4px] border border-input dark:border-zinc-600"
                  checked={allowJobLevel}
                  onChange={(e) => setAllowJobLevel(e.target.checked)}
                />
                <Label htmlFor={`jl-${taskId}`} className="cursor-pointer text-xs font-normal text-foreground dark:text-zinc-200">
                  Allow job-level accepted evidence to count (not only rows linked to this task)
                </Label>
              </div>
            </div>
          ) : (
            <input type="hidden" name="minAcceptedCount" value="1" />
          )}
          <Err r={state} />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" size="sm" className="rounded-[5px]" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="rounded-[5px] font-semibold" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
