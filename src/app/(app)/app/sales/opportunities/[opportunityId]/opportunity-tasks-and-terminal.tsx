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
import { formatTaskKind, formatTaskStatus } from "@/lib/format-enums";

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

export function OpportunityTasksPanel(props: {
  opportunityId: string;
  tasks: TaskRow[];
  members: { id: string; label: string }[];
  disabled: boolean;
}) {
  const [addState, addAction, addPending] = useActionState(addOpportunityTask, initial);

  if (props.disabled) {
    return (
      <div className="space-y-2">
        {props.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks.</p>
        ) : (
          <ul className="divide-y divide-border rounded-sm border border-border">
            {props.tasks.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{t.title}</span>
                <span className="ml-2 text-muted-foreground">{formatTaskStatus(t.status)}</span>
                {t.status === OpportunityTaskStatus.COMPLETE && t.outcome?.trim() ? (
                  <p className="mt-2 border-l-2 border-primary/35 pl-2 text-xs leading-relaxed text-muted-foreground">
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
    <div className="space-y-6">
      <form action={addAction} className="grid gap-3 rounded-sm border border-border bg-card/20 p-4 sm:grid-cols-2">
        <input type="hidden" name="opportunityId" value={props.opportunityId} />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nt-title">New task title</Label>
          <Input id="nt-title" name="title" required className="rounded-sm" placeholder="Describe the intake step" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nt-kind">Kind</Label>
          <select id="nt-kind" name="kind" defaultValue={OpportunityTaskKind.INTAKE} className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
            {Object.values(OpportunityTaskKind).map((k) => (
              <option key={k} value={k}>
                {formatTaskKind(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nt-dueAt">Due</Label>
          <Input id="nt-dueAt" name="dueAt" type="datetime-local" className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nt-assignee">Assignee</Label>
          <select id="nt-assignee" name="assigneeUserId" className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
            <option value="">Unassigned</option>
            {props.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" name="isRequired" id="nt-req" className="size-3.5 rounded-sm border border-input" />
          <Label htmlFor="nt-req" className="text-sm font-normal text-muted-foreground">
            Required for quote readiness
          </Label>
        </div>
        {addState && !addState.ok ? <p className="text-sm text-destructive sm:col-span-2">{addState.error}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={addPending} className="rounded-sm">
            {addPending ? "Adding…" : "Add task"}
          </Button>
        </div>
      </form>

      <ul className="space-y-3">
        {props.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklist items yet.</p>
        ) : (
          props.tasks.map((t) => <TaskRow key={t.id} task={t} opportunityId={props.opportunityId} />)
        )}
      </ul>
    </div>
  );
}

function TaskRow({ task, opportunityId }: { task: TaskRow; opportunityId: string }) {
  const [state, action, pending] = useActionState(updateOpportunityTaskStatus, initial);
  return (
    <li className="rounded-sm border border-border bg-card/10 p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{task.title}</span>
          {task.isRequired ? (
            <span className="rounded-sm border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">
              Required
            </span>
          ) : null}
        </div>
        {task.status === OpportunityTaskStatus.COMPLETE && task.outcome?.trim() ? (
          <p className="border-l-2 border-primary/35 pl-2 text-xs leading-relaxed text-muted-foreground">
            Last recorded outcome: {task.outcome}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <select name="status" defaultValue={task.status} className="flex h-9 w-full rounded-sm border border-input bg-background px-2 text-sm">
              {Object.values(OpportunityTaskStatus).map((s) => (
                <option key={s} value={s}>
                  {formatTaskStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Outcome / notes</Label>
            <Input
              name="outcome"
              key={`${task.id}-${task.outcome ?? ""}`}
              defaultValue={task.outcome ?? ""}
              placeholder="Optional when completing or changing status"
              className="rounded-sm"
            />
          </div>
        </div>
        {state && !state.ok ? <p className="text-xs text-destructive">{state.error}</p> : null}
        <Button type="submit" size="sm" variant="secondary" disabled={pending} className="rounded-sm">
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
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={lostAction} className="space-y-3 rounded-sm border border-border bg-card/20 p-4">
        <input type="hidden" name="opportunityId" value={props.opportunityId} />
        <h3 className="text-sm font-semibold text-foreground">Mark lost</h3>
        <p className="text-xs text-muted-foreground">Use when the opportunity will not proceed. Reason is required.</p>
        <Textarea name="reason" required rows={3} placeholder="Lost to competitor, budget, timing…" className="rounded-sm" />
        {lostState && !lostState.ok ? <p className="text-xs text-destructive">{lostState.error}</p> : null}
        <Button type="submit" variant="outline" size="sm" disabled={lostPending} className="rounded-sm border-destructive/40 text-destructive hover:bg-destructive/10">
          {lostPending ? "Saving…" : "Mark lost"}
        </Button>
      </form>
      <form action={nqAction} className="space-y-3 rounded-sm border border-border bg-card/20 p-4">
        <input type="hidden" name="opportunityId" value={props.opportunityId} />
        <h3 className="text-sm font-semibold text-foreground">Mark no quote</h3>
        <p className="text-xs text-muted-foreground">Use when you will not produce a proposal. Reason is required.</p>
        <Textarea name="reason" required rows={3} placeholder="Outside service area, not a fit, duplicate lead…" className="rounded-sm" />
        {nqState && !nqState.ok ? <p className="text-xs text-destructive">{nqState.error}</p> : null}
        <Button type="submit" variant="outline" size="sm" disabled={nqPending} className="rounded-sm">
          {nqPending ? "Saving…" : "Mark no quote"}
        </Button>
      </form>
    </div>
  );
}
