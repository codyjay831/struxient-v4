"use client";

import { useActionState } from "react";
import { OpportunityTaskKind, OpportunityTaskStatus } from "@prisma/client";
import {
  addOpportunityTask,
  markOpportunityLost,
  markOpportunityNoQuote,
  updateOpportunityTaskStatus,
  type ActionResult,
} from "@/app/(app)/app/sales/opportunities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import {
  workspaceInputClass,
  workspaceSelectClass,
  workspaceTextareaClass,
} from "@/components/workspace/workspace-form-controls";
import { formatTaskKind, formatTaskStatus } from "@/lib/format-enums";
import { cn } from "@/lib/utils";

const initial: ActionResult | undefined = undefined;

type TaskRow = {
  id: string;
  title: string;
  status: OpportunityTaskStatus;
  kind: OpportunityTaskKind;
  isRequired: boolean;
  dueAt: string | null;
  assigneeUserId: string | null;
  outcome: string | null;
};

function taskMetaLine(t: TaskRow, members: { id: string; label: string }[]) {
  const parts: string[] = [formatTaskKind(t.kind)];
  if (t.dueAt) {
    parts.push(`Due ${new Date(t.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`);
  }
  if (t.assigneeUserId) {
    const label = members.find((m) => m.id === t.assigneeUserId)?.label ?? "Assignee";
    parts.push(label);
  }
  return parts.join(" · ");
}

export function OpportunityTasksPanel(props: {
  opportunityId: string;
  tasks: TaskRow[];
  members: { id: string; label: string }[];
  disabled: boolean;
}) {
  const [addState, addAction, addPending] = useActionState(addOpportunityTask, initial);

  if (props.disabled) {
    return (
      <div className="min-w-0 space-y-3">
        {props.tasks.length === 0 ? (
          <WorkspaceEmptyState title="No tasks" description="This opportunity is closed — the checklist is read-only." />
        ) : (
          <ul className="min-w-0 divide-y divide-border rounded-[6px] border border-border dark:divide-zinc-800/60 dark:border-zinc-800/60">
            {props.tasks.map((t) => (
              <li key={t.id} className="min-w-0 px-3.5 py-3 sm:px-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold text-foreground dark:text-zinc-100">{t.title}</p>
                  <span className="shrink-0 rounded-[4px] border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
                    {formatTaskStatus(t.status)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground dark:text-zinc-500">{taskMetaLine(t, props.members)}</p>
                {t.isRequired ? (
                  <span className="mt-2 inline-block rounded-[4px] border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                    Required for quote readiness
                  </span>
                ) : null}
                {t.status === OpportunityTaskStatus.COMPLETE && t.outcome?.trim() ? (
                  <p className="mt-2 border-l-2 border-primary/40 pl-2 text-xs leading-relaxed text-muted-foreground dark:border-blue-500/40 dark:text-zinc-400">
                    Outcome: {t.outcome}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <form
        action={addAction}
        className="grid min-w-0 gap-3 rounded-[6px] border border-border bg-card/30 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/30 sm:grid-cols-2"
      >
        <input type="hidden" name="opportunityId" value={props.opportunityId} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="nt-title" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
            New task title
          </Label>
          <Input
            id="nt-title"
            name="title"
            required
            className={workspaceInputClass()}
            placeholder="Describe the intake step"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nt-kind" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
            Kind
          </Label>
          <select id="nt-kind" name="kind" defaultValue={OpportunityTaskKind.INTAKE} className={cn(workspaceSelectClass(), "w-full")}>
            {Object.values(OpportunityTaskKind).map((k) => (
              <option key={k} value={k}>
                {formatTaskKind(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nt-dueAt" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
            Due
          </Label>
          <Input id="nt-dueAt" name="dueAt" type="datetime-local" className={cn(workspaceInputClass(), "w-full max-w-full sm:max-w-xs")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2 sm:max-w-md">
          <Label htmlFor="nt-assignee" className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
            Assignee
          </Label>
          <select id="nt-assignee" name="assigneeUserId" className={cn(workspaceSelectClass(), "w-full")}>
            <option value="">Unassigned</option>
            {props.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="isRequired" id="nt-req" className="size-3.5 rounded-[4px] border border-input dark:border-zinc-700" />
          <Label htmlFor="nt-req" className="text-xs font-normal text-muted-foreground dark:text-zinc-400">
            Required for quote readiness
          </Label>
        </div>
        {addState && !addState.ok ? (
          <p className="text-xs font-medium text-destructive sm:col-span-2" role="alert">
            {addState.error}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={addPending} className="rounded-[5px] font-semibold">
            {addPending ? "Adding…" : "Add task"}
          </Button>
        </div>
      </form>

      {props.tasks.length === 0 ? (
        <WorkspaceEmptyState
          title="No checklist items yet"
          description="Add intake steps above. Required tasks can gate quote draft readiness until completed."
        />
      ) : (
        <ul className="min-w-0 space-y-2">
          {props.tasks.map((t) => (
            <TaskRow key={t.id} task={t} opportunityId={props.opportunityId} members={props.members} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task,
  opportunityId,
  members,
}: {
  task: TaskRow;
  opportunityId: string;
  members: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(updateOpportunityTaskStatus, initial);
  return (
    <li className="min-w-0 rounded-[6px] border border-border bg-card/25 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950/35 sm:p-4">
      <form action={action} className="min-w-0 space-y-3">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{task.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground dark:text-zinc-500">{taskMetaLine(task, members)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {task.isRequired ? (
              <span className="rounded-[4px] border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                Required
              </span>
            ) : null}
            <span className="rounded-[4px] border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
              {formatTaskStatus(task.status)}
            </span>
          </div>
        </div>
        {task.status === OpportunityTaskStatus.COMPLETE && task.outcome?.trim() ? (
          <p className="border-l-2 border-primary/40 pl-2 text-xs leading-relaxed text-muted-foreground dark:border-blue-500/40 dark:text-zinc-400">
            Last recorded outcome: {task.outcome}
          </p>
        ) : null}
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Status</Label>
            <select name="status" defaultValue={task.status} className={cn(workspaceSelectClass(), "w-full")}>
              {Object.values(OpportunityTaskStatus).map((s) => (
                <option key={s} value={s}>
                  {formatTaskStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
              Outcome / notes
            </Label>
            <Input
              name="outcome"
              key={`${task.id}-${task.outcome ?? ""}`}
              defaultValue={task.outcome ?? ""}
              placeholder="Optional when completing or changing status"
              className={workspaceInputClass()}
            />
          </div>
        </div>
        {state && !state.ok ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="sm" variant="secondary" disabled={pending} className="rounded-[5px] font-semibold">
          {pending ? "Updating…" : "Update task"}
        </Button>
      </form>
    </li>
  );
}

export function OpportunityTerminalPanel(props: { opportunityId: string }) {
  const [lostState, lostAction, lostPending] = useActionState(markOpportunityLost, initial);
  const [nqState, nqAction, nqPending] = useActionState(markOpportunityNoQuote, initial);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:gap-5">
      <form
        action={lostAction}
        className="min-w-0 space-y-3 rounded-[6px] border border-destructive/25 bg-destructive/[0.04] p-4 dark:border-red-900/40 dark:bg-red-950/20"
      >
        <input type="hidden" name="opportunityId" value={props.opportunityId} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive dark:text-red-400/90">Terminal</p>
        <h3 className="text-sm font-semibold text-foreground dark:text-zinc-100">Mark lost</h3>
        <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
          Use when the opportunity will not proceed. Reason is required.
        </p>
        <Textarea
          name="reason"
          required
          rows={3}
          placeholder="Lost to competitor, budget, timing…"
          className={workspaceTextareaClass()}
        />
        {lostState && !lostState.ok ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {lostState.error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={lostPending}
          className="rounded-[5px] border-destructive/45 font-semibold text-destructive hover:bg-destructive/10 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          {lostPending ? "Saving…" : "Mark lost"}
        </Button>
      </form>

      <form
        action={nqAction}
        className="min-w-0 space-y-3 rounded-[6px] border border-border bg-muted/20 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/35"
      >
        <input type="hidden" name="opportunityId" value={props.opportunityId} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-zinc-600">Terminal</p>
        <h3 className="text-sm font-semibold text-foreground dark:text-zinc-100">Mark no quote</h3>
        <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
          Use when you will not produce a proposal. Reason is required.
        </p>
        <Textarea
          name="reason"
          required
          rows={3}
          placeholder="Outside service area, not a fit, duplicate lead…"
          className={workspaceTextareaClass()}
        />
        {nqState && !nqState.ok ? (
          <p className="text-xs font-medium text-destructive" role="alert">
            {nqState.error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" size="sm" disabled={nqPending} className="rounded-[5px] font-semibold">
          {nqPending ? "Saving…" : "Mark no quote"}
        </Button>
      </form>
    </div>
  );
}
