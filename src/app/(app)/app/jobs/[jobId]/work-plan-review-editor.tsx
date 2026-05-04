"use client";

import { JobTaskStatus } from "@prisma/client";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import type { WorkPlanMutationResult } from "@/app/(app)/app/jobs/[jobId]/action-types";
import {
  addWorkPlanTaskAction,
  archiveWorkPlanTaskAction,
  reorderWorkPlanTasksAction,
  updateWorkPlanStageAction,
  updateWorkPlanTaskAction,
} from "@/app/(app)/app/jobs/[jobId]/actions";
import { JobTaskCompletionRequirementsDialog } from "@/app/(app)/app/jobs/[jobId]/job-task-completion-requirements-dialog";
import type { JobTaskRowModel } from "@/app/(app)/app/jobs/[jobId]/job-task-status-form";
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
import { WorkPlanMutationFeedback, WorkPlanMutationFieldErrors } from "@/components/work-plan/work-plan-mutation-feedback";
import { WorkPlanPlannerShell } from "@/components/work-plan/work-plan-planner-shell";
import { WorkPlanStageShell } from "@/components/work-plan/work-plan-stage-shell";
import { WorkPlanTaskBadges } from "@/components/work-plan/work-plan-task-badges";
import { WorkPlanTaskCardShell } from "@/components/work-plan/work-plan-task-card-shell";
import { formatJobTaskStatus } from "@/lib/format-enums";

function clipText(s: string | null | undefined, max: number) {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export type WorkPlanReviewStageModel = {
  id: string;
  title: string;
  internalNotes: string | null;
  sortOrder: number;
  tasks: JobTaskRowModel[];
};

export type WorkPlanReviewLineModel = {
  id: string;
  title: string;
  stages: WorkPlanReviewStageModel[];
};

export function WorkPlanReviewEditor(props: { jobId: string; lines: WorkPlanReviewLineModel[] }) {
  const { jobId, lines } = props;

  return (
    <WorkPlanPlannerShell
      title="Edit work plan"
      description={
        <>
          <p>
            Review and adjust this work plan before activating execution. Changes here update the live job plan;
            activation saves that version as the baseline. You can still handle day-to-day execution changes after
            activation.
          </p>
        </>
      }
    >
      {lines.map((line) => (
        <div key={line.id} className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-500">
            {line.title}
          </p>
          <ul className="list-none space-y-4 p-0">
            {line.stages.map((stage) => (
              <WorkPlanStageBlock key={stage.id} jobId={jobId} stage={stage} />
            ))}
          </ul>
        </div>
      ))}
    </WorkPlanPlannerShell>
  );
}

function WorkPlanStageBlock(props: { jobId: string; stage: WorkPlanReviewStageModel }) {
  const { jobId, stage } = props;
  const [stageState, stageAction] = useActionState(updateWorkPlanStageAction, undefined);
  const [editOpen, setEditOpen] = useState(false);
  const taskIdsFromProps = useMemo(() => stage.tasks.map((t) => t.id), [stage.tasks]);
  const [order, setOrder] = useState<string[]>(taskIdsFromProps);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (stageState?.ok) setEditOpen(false);
  }, [stageState?.ok]);

  useEffect(() => {
    setOrder(taskIdsFromProps);
  }, [taskIdsFromProps]);

  const orderedTasks = useMemo(() => {
    const byId = new Map(stage.tasks.map((t) => [t.id, t]));
    return order.map((id) => byId.get(id)).filter(Boolean) as JobTaskRowModel[];
  }, [order, stage.tasks]);

  function applyReorder(nextOrder: string[]) {
    setOrder(nextOrder);
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("stageId", stage.id);
    fd.set("orderedTaskIds", JSON.stringify(nextOrder));
    startTransition(async () => {
      await reorderWorkPlanTasksAction(undefined, fd);
    });
  }

  function moveTask(taskId: string, dir: "up" | "down") {
    const idx = order.indexOf(taskId);
    if (idx < 0) return;
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    applyReorder(next);
  }

  const requiredCount = orderedTasks.filter((t) => t.isRequired).length;
  const visibleCount = orderedTasks.filter((t) => t.customerVisible).length;
  const notComplete = orderedTasks.filter((t) => t.status !== JobTaskStatus.COMPLETE).length;
  const notesPreview = clipText(stage.internalNotes, 72);

  return (
    <li className="min-w-0 list-none">
      <WorkPlanStageShell>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border/40 pb-3 dark:border-zinc-800/40">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400/95">
              Stage
            </p>
            <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{stage.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-zinc-500">
              {orderedTasks.length} active task{orderedTasks.length === 1 ? "" : "s"}
              {orderedTasks.length > 0 ? ` · ${requiredCount} required` : ""}
              {visibleCount ? ` · ${visibleCount} customer-visible` : ""}
              {orderedTasks.length > 0 ? ` · ${notComplete} not complete` : ""}
              {notesPreview ? ` · Notes: ${notesPreview}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-[5px] px-2 text-[11px] text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-200"
              onClick={() => setEditOpen((v) => !v)}
            >
              {editOpen ? "Close" : "Edit stage"}
            </Button>
          </div>
        </div>

        {editOpen ? (
          <div className="mt-3 space-y-3 border-b border-border/50 pb-4 dark:border-zinc-800/50">
            <form action={stageAction} className="space-y-2">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="stageId" value={stage.id} />
              <div className="space-y-1">
                <Label className="text-[11px]">Stage title</Label>
                <Input name="title" defaultValue={stage.title} className={workspaceInputClass()} required maxLength={240} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Stage notes (internal)</Label>
                <Textarea
                  name="internalNotes"
                  defaultValue={stage.internalNotes ?? ""}
                  className={workspaceTextareaClass()}
                  rows={2}
                />
              </div>
              <WorkPlanMutationFeedback state={stageState} />
              <WorkPlanMutationFieldErrors state={stageState} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" variant="secondary" className="rounded-[5px]">
                  Save stage
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-[5px]" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
          Tasks in this stage
        </p>
        <ul className="mt-2 list-none space-y-3 p-0">
          {orderedTasks.length === 0 ? (
            <li className="list-none">
              <p className="rounded-[5px] border border-dashed border-border/80 bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground dark:border-zinc-800/60 dark:bg-zinc-950/30 dark:text-zinc-500">
                No active tasks in this stage. Add a task below, or restore tasks from archive if this should not be
                empty.
              </p>
            </li>
          ) : (
            orderedTasks.map((task) => (
              <WorkPlanTaskEditRow
                key={task.id}
                jobId={jobId}
                task={task}
                onMoveUp={() => moveTask(task.id, "up")}
                onMoveDown={() => moveTask(task.id, "down")}
                disableUp={order.indexOf(task.id) === 0}
                disableDown={order.indexOf(task.id) === order.length - 1}
                busy={isPending}
              />
            ))
          )}
        </ul>

        <AddWorkPlanTaskForm jobId={jobId} stageId={stage.id} />
      </WorkPlanStageShell>
    </li>
  );
}

function WorkPlanTaskEditRow(props: {
  jobId: string;
  task: JobTaskRowModel;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  busy: boolean;
}) {
  const { jobId, task, onMoveUp, onMoveDown, disableUp, disableDown, busy } = props;
  const [updateState, updateAction] = useActionState(updateWorkPlanTaskAction, undefined);
  const [archiveState, archiveAction] = useActionState(archiveWorkPlanTaskAction, undefined);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (updateState?.ok) setDetailOpen(false);
  }, [updateState?.ok]);

  const descPreview = clipText(task.description, 96);
  const notesPreview = clipText(task.internalNotes, 72);
  const statusLabel = formatJobTaskStatus(task.status);

  return (
    <li className="min-w-0 list-none">
      <WorkPlanTaskCardShell>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:text-zinc-500">Task</p>
            <p className="text-sm font-medium text-foreground dark:text-zinc-100">{task.title}</p>
            <WorkPlanTaskBadges
              isRequired={task.isRequired}
              customerVisible={task.customerVisible}
              completionRequirement={task.completionRequirement}
              showAddedDuringReview={task.sourceQuoteTaskId === null}
            />
            <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
              <span className="font-medium text-foreground/80 dark:text-zinc-400">Status: </span>
              {statusLabel}
              {task.blockedReason ? (
                <span className="block pt-0.5 text-[10px] leading-snug text-amber-800 dark:text-amber-400/90">
                  {task.blockedReason}
                </span>
              ) : null}
            </p>
            {descPreview ? (
              <p className="text-[11px] leading-snug text-muted-foreground dark:text-zinc-500">
                <span className="font-medium text-foreground/80 dark:text-zinc-400">Instructions: </span>
                {descPreview}
              </p>
            ) : null}
            {notesPreview ? (
              <p className="text-[11px] leading-snug text-muted-foreground dark:text-zinc-500">
                <span className="font-medium text-foreground/80 dark:text-zinc-400">Internal notes: </span>
                {notesPreview}
              </p>
            ) : null}
            {task.assignedRole ? (
              <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                <span className="font-medium text-foreground/80 dark:text-zinc-400">Role: </span>
                {task.assignedRole}
              </p>
            ) : null}
            {task.estimatedDurationMinutes != null ? (
              <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                <span className="font-medium text-foreground/80 dark:text-zinc-400">Est. duration: </span>
                {task.estimatedDurationMinutes} min
              </p>
            ) : null}
            {task.customerVisible && task.customerLabel ? (
              <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                <span className="font-medium text-foreground/80 dark:text-zinc-400">Portal label: </span>
                {task.customerLabel}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-[5px] px-2 text-[11px] text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
              onClick={() => setDetailOpen((o) => !o)}
            >
              {detailOpen ? "Close" : "Edit"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-2 dark:border-zinc-800/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[5px] text-xs"
            disabled={disableUp || busy}
            onClick={onMoveUp}
            title="Move earlier in this stage"
          >
            ↑ Earlier
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[5px] text-xs"
            disabled={disableDown || busy}
            onClick={onMoveDown}
            title="Move later in this stage"
          >
            ↓ Later
          </Button>
          {task.canManageCompletionRequirements ? (
            <JobTaskCompletionRequirementsDialog
              jobId={jobId}
              taskId={task.id}
              taskTitle={task.title}
              requirement={task.completionRequirement}
            />
          ) : null}
          <ArchiveTaskDialog jobId={jobId} taskId={task.id} taskTitle={task.title} state={archiveState} action={archiveAction} />
        </div>

        {detailOpen ? (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3 dark:border-zinc-800/40">
            <form action={updateAction} className="space-y-2">
              <input type="hidden" name="jobId" value={jobId} />
              <input type="hidden" name="taskId" value={task.id} />
              <div className="space-y-1">
                <Label className="text-[11px]">Task title</Label>
                <Input name="title" defaultValue={task.title} required maxLength={240} className={workspaceInputClass()} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Instructions / description</Label>
                <Textarea
                  name="description"
                  defaultValue={task.description ?? ""}
                  rows={3}
                  className={workspaceTextareaClass()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Internal notes</Label>
                <Textarea
                  name="internalNotes"
                  defaultValue={task.internalNotes ?? ""}
                  rows={2}
                  className={workspaceTextareaClass()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Assigned role (optional)</Label>
                <Input
                  name="assignedRole"
                  defaultValue={task.assignedRole ?? ""}
                  maxLength={120}
                  className={workspaceInputClass()}
                  placeholder="e.g. CREW_LEAD"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground dark:text-zinc-200">
                <input type="checkbox" name="isRequired" value="true" defaultChecked={task.isRequired} className="rounded border-input" />
                Required task
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground dark:text-zinc-200">
                <input
                  type="checkbox"
                  name="customerVisible"
                  value="true"
                  defaultChecked={task.customerVisible}
                  className="rounded border-input"
                />
                Customer-visible milestone
              </label>
              <p className="text-[10px] text-muted-foreground dark:text-zinc-500">
                When customer-visible is on, set a short label for the portal.
              </p>
              <div className="space-y-1">
                <Label className="text-[11px]">Customer label</Label>
                <Input
                  name="customerLabel"
                  defaultValue={task.customerLabel ?? ""}
                  maxLength={240}
                  className={workspaceInputClass()}
                  placeholder="Shown on portal when visible"
                />
              </div>
              <WorkPlanMutationFeedback state={updateState} />
              <WorkPlanMutationFieldErrors state={updateState} />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" variant="secondary" className="rounded-[5px]">
                  Save task
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-[5px]" onClick={() => setDetailOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        ) : null}
        <WorkPlanMutationFeedback state={archiveState} />
      </WorkPlanTaskCardShell>
    </li>
  );
}

function ArchiveTaskDialog(props: {
  jobId: string;
  taskId: string;
  taskTitle: string;
  state: WorkPlanMutationResult | undefined;
  /** Bound form action from `useActionState` (not the raw server function signature). */
  action: (formData: FormData) => void;
}) {
  const { jobId, taskId, taskTitle, state, action } = props;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-[5px] border-destructive/30 text-xs text-destructive"
        >
          Archive…
        </Button>
      </DialogTrigger>
      <DialogContent className={workspaceDialogContentClass()}>
        <DialogHeader>
          <DialogTitle>Archive this task?</DialogTitle>
          <DialogDescription>
            &quot;{taskTitle}&quot; will be hidden from the active work plan and excluded from the activation baseline.
            You cannot archive the last active task, or a task that already has scheduled work or evidence linked.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="taskId" value={taskId} />
          <WorkPlanMutationFeedback state={state} />
          <DialogFooter>
            <Button type="submit" variant="destructive" className="rounded-[5px]">
              Confirm archive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkPlanTaskForm(props: { jobId: string; stageId: string }) {
  const { jobId, stageId } = props;
  const [addState, addAction] = useActionState(addWorkPlanTaskAction, undefined);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (addState?.ok) setFormOpen(false);
  }, [addState?.ok]);

  return (
    <div className="space-y-2 pt-1">
      {!formOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setFormOpen(true)}
          className="h-9 rounded-[5px] border-border/80 bg-transparent text-xs text-foreground/90 hover:bg-muted/60 dark:border-zinc-700/80 dark:text-zinc-200 dark:hover:bg-zinc-900/70"
        >
          Add task to this stage
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">New task</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-[5px] text-[11px] text-muted-foreground hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-300"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
          </div>
          <form action={addAction} className="space-y-2">
            <input type="hidden" name="jobId" value={jobId} />
            <input type="hidden" name="stageId" value={stageId} />
            <div className="flex flex-wrap gap-2">
              <Input
                name="title"
                placeholder="New task title"
                required
                maxLength={240}
                className={`${workspaceInputClass()} min-w-[12rem] flex-1`}
              />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="isRequired" value="true" className="rounded border-input" />
                Required
              </label>
              <Button type="submit" size="sm" variant="secondary" className="rounded-[5px] font-semibold">
                + Add task
              </Button>
            </div>
            <Textarea name="description" placeholder="Optional description" rows={2} className={workspaceTextareaClass()} />
            <Input name="assignedRole" placeholder="Optional assigned role" maxLength={120} className={workspaceInputClass()} />
            <WorkPlanMutationFeedback state={addState} />
            <WorkPlanMutationFieldErrors state={addState} />
          </form>
        </div>
      )}
    </div>
  );
}
