"use client";

import type { ReactNode } from "react";
import { JobTaskStatus } from "@prisma/client";
import { useActionState, useState } from "react";
import { updateJobTaskStatus } from "@/app/(app)/app/jobs/[jobId]/actions";
import { JobTaskCompletionRequirementsDialog } from "@/app/(app)/app/jobs/[jobId]/job-task-completion-requirements-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  workspaceSelectClass,
  workspaceTextareaClass,
} from "@/components/workspace/workspace-form-controls";
import { formatJobTaskStatus } from "@/lib/format-enums";
import { cn } from "@/lib/utils";
import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";

const ORDERED_STATUSES: JobTaskStatus[] = [
  JobTaskStatus.NOT_STARTED,
  JobTaskStatus.READY,
  JobTaskStatus.IN_PROGRESS,
  JobTaskStatus.BLOCKED,
  JobTaskStatus.COMPLETE,
];

export type JobTaskRowModel = {
  id: string;
  title: string;
  description: string | null;
  internalNotes: string | null;
  isRequired: boolean;
  assignedRole: string | null;
  /** Present when loaded from job workspace (work plan review badges). */
  sourceQuoteTaskId?: string | null;
  /** Stage ordering for planner adapters / reorder UI. */
  sortOrder: number;
  estimatedDurationMinutes: number | null;
  customerVisible: boolean;
  customerLabel: string | null;
  status: JobTaskStatus;
  blockedReason: string | null;
  linkedEvidenceCount?: number;
  completionRequirement: CompletionRequirementDto;
  acceptedEvidenceForRequirement: number;
  canManageCompletionRequirements: boolean;
  canOverrideEvidenceCompletion: boolean;
};

const taskShell = cn(
  "min-w-0 rounded-[6px] border border-border/80 bg-card/25 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/30 sm:p-3.5",
);

const badgeBase = "rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export function JobTaskStatusForm(props: {
  jobId: string;
  task: JobTaskRowModel;
  canUpdate: boolean;
  readOnlyHint: string | null;
  scheduleAction?: ReactNode;
}) {
  const { jobId, task, canUpdate, readOnlyHint, scheduleAction } = props;
  const [state, action] = useActionState(updateJobTaskStatus, undefined);
  const [selectedStatus, setSelectedStatus] = useState<JobTaskStatus>(task.status);

  const req = task.completionRequirement;
  const reqActive = req.state === "active";
  const reqInvalid = req.state === "invalid";
  const minReq = reqActive ? req.minAcceptedCount : 0;
  const accepted = task.acceptedEvidenceForRequirement;
  const shortfall = reqActive && accepted < minReq;
  const showOverrideControls =
    canUpdate &&
    props.task.canOverrideEvidenceCompletion &&
    reqActive &&
    shortfall &&
    selectedStatus === JobTaskStatus.COMPLETE;

  const requirementBadges = (
    <div className="flex flex-wrap items-center gap-2">
      {reqActive ? (
        <span
          className={cn(
            badgeBase,
            "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300",
          )}
        >
          Evidence required
        </span>
      ) : null}
      {reqActive ? (
        <span
          className={cn(
            badgeBase,
            "border-border bg-muted/30 font-medium tabular-nums text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500",
          )}
        >
          Accepted {accepted} / {minReq}
        </span>
      ) : null}
      {reqActive && req.allowJobLevelEvidence ? (
        <span className={cn(badgeBase, "border-border text-muted-foreground dark:border-zinc-800 dark:text-zinc-500")}>
          Job-level evidence allowed
        </span>
      ) : null}
      {task.linkedEvidenceCount != null && task.linkedEvidenceCount > 0 ? (
        <span
          className={cn(
            badgeBase,
            "border-border bg-muted/30 font-medium tabular-nums text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500",
          )}
        >
          Evidence records (all statuses) {task.linkedEvidenceCount}
        </span>
      ) : null}
    </div>
  );

  const requirementNotes = (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
      {reqInvalid ? (
        <p className="text-amber-900/90 dark:text-amber-200/90">
          Completion requirement configuration is invalid. Completion is blocked until office staff corrects this
          setting.
        </p>
      ) : null}
      {reqInvalid && task.canManageCompletionRequirements ? (
        <p>Use “Evidence requirement” to clear or replace this configuration.</p>
      ) : null}
      {reqActive && shortfall ? (
        <p>
          Promote and accept evidence in the Evidence section before completing this task, or ask management for an
          override if policy allows.
        </p>
      ) : null}
    </div>
  );

  const headerExtras = (
    <div className="flex flex-wrap items-center gap-2">
      {requirementBadges}
      {task.canManageCompletionRequirements ? (
        <JobTaskCompletionRequirementsDialog
          jobId={jobId}
          taskId={task.id}
          taskTitle={task.title}
          requirement={req}
        />
      ) : null}
    </div>
  );

  if (!canUpdate) {
    return (
      <div className={cn(taskShell, "space-y-3")}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{task.title}</p>
                  {task.isRequired ? (
                    <span
                      className={cn(
                        badgeBase,
                        "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200/90",
                      )}
                    >
                      Required
                    </span>
                  ) : null}
                </div>
                {headerExtras}
                {requirementNotes}
              </div>
              {scheduleAction ? <div className="shrink-0">{scheduleAction}</div> : null}
            </div>
            <p className="text-[11px] font-medium text-muted-foreground dark:text-zinc-500">
              {formatJobTaskStatus(task.status)}
            </p>
            {task.description ? (
              <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">{task.description}</p>
            ) : null}
            {task.internalNotes ? (
              <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-200/85">
                <span className="font-medium text-foreground/90 dark:text-zinc-200">Internal: </span>
                {task.internalNotes}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground dark:text-zinc-500">
              {task.assignedRole ? <span>Role: {task.assignedRole}</span> : null}
              {task.estimatedDurationMinutes != null ? (
                <span>Est. {task.estimatedDurationMinutes} min</span>
              ) : null}
            </div>
            {task.status === JobTaskStatus.BLOCKED && task.blockedReason ? (
              <p className="text-xs text-destructive dark:text-red-400">
                <span className="font-medium">Blocked: </span>
                {task.blockedReason}
              </p>
            ) : null}
          </div>
          {readOnlyHint ? (
            <p className="max-w-xs shrink-0 text-xs text-muted-foreground dark:text-zinc-500">{readOnlyHint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const showBlockedField = selectedStatus === JobTaskStatus.BLOCKED;

  return (
    <form action={action} className={cn(taskShell, "space-y-3")}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="taskId" value={task.id} />

      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{task.title}</p>
                {task.isRequired ? (
                  <span
                    className={cn(
                      badgeBase,
                      "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200/90",
                    )}
                  >
                    Required
                  </span>
                ) : null}
              </div>
              {headerExtras}
              {requirementNotes}
            </div>
            {scheduleAction ? <div className="shrink-0">{scheduleAction}</div> : null}
          </div>

          {task.description ? (
            <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">{task.description}</p>
          ) : null}
          {task.internalNotes ? (
            <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-200/85">
              <span className="font-medium text-foreground/90 dark:text-zinc-200">Internal: </span>
              {task.internalNotes}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground dark:text-zinc-500">
            {task.assignedRole ? <span>Role: {task.assignedRole}</span> : null}
            {task.estimatedDurationMinutes != null ? (
              <span>Est. {task.estimatedDurationMinutes} min</span>
            ) : null}
          </div>
          {task.blockedReason && task.status === JobTaskStatus.BLOCKED ? (
            <p className="text-xs text-destructive dark:text-red-400">
              <span className="font-medium">Current block: </span>
              {task.blockedReason}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 border-t border-border/60 pt-3 dark:border-zinc-800/60 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
            Status
          </span>
          <select
            name="status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as JobTaskStatus)}
            className={cn(workspaceSelectClass(), "w-full min-w-0 sm:w-auto sm:min-w-[10rem]")}
          >
            {ORDERED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatJobTaskStatus(s)}
              </option>
            ))}
          </select>
        </label>

        {showBlockedField ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[12rem]">
            <Label htmlFor={`blocked-${task.id}`} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
              Blocked reason
            </Label>
            <Textarea
              id={`blocked-${task.id}`}
              name="blockedReason"
              rows={2}
              required
              defaultValue={task.status === JobTaskStatus.BLOCKED ? task.blockedReason ?? "" : ""}
              placeholder="What is blocking this task?"
              className={cn(workspaceTextareaClass(), "min-h-[4rem] w-full resize-y")}
            />
          </div>
        ) : null}

        {showOverrideControls ? (
          <div className="w-full space-y-2 rounded-[6px] border border-amber-500/35 bg-amber-500/5 p-3 dark:border-amber-500/25 dark:bg-amber-500/10 sm:max-w-md">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">Management completion override</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-400">
              Use only when policy allows completing this task without the required accepted evidence on file. This is
              audited.
            </p>
            <div className="flex items-center gap-2">
              <input
                id={`ov-${task.id}`}
                type="checkbox"
                name="evidenceCompletionOverride"
                value="true"
                className="size-3.5 rounded-[4px] border border-input dark:border-zinc-700"
              />
              <Label htmlFor={`ov-${task.id}`} className="cursor-pointer text-xs font-normal text-foreground dark:text-zinc-200">
                Complete without required accepted evidence
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`ovr-${task.id}`} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                Override reason
              </Label>
              <Textarea
                id={`ovr-${task.id}`}
                name="overrideReason"
                rows={2}
                placeholder="Document why completion is authorized without accepted evidence."
                className={cn(workspaceTextareaClass(), "min-h-[3.5rem] resize-y")}
              />
            </div>
          </div>
        ) : null}

        <Button type="submit" size="sm" variant="secondary" className="h-8 w-fit shrink-0 rounded-[5px] px-3 text-xs font-semibold">
          Save status
        </Button>
      </div>

      {state && !state.ok ? (
        <p className="text-xs font-medium text-destructive dark:text-red-400" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && !state.ok && state.fieldErrors ? (
        <ul className="list-inside list-disc text-xs text-destructive dark:text-red-400">
          {Object.entries(state.fieldErrors).map(([k, msgs]) => (
            <li key={k}>
              {k}: {msgs.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
