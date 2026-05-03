"use client";



import type { ReactNode } from "react";

import { JobTaskStatus } from "@prisma/client";

import { useActionState, useState } from "react";

import { updateJobTaskStatus } from "@/app/(app)/app/jobs/[jobId]/actions";

import { JobTaskCompletionRequirementsDialog } from "@/app/(app)/app/jobs/[jobId]/job-task-completion-requirements-dialog";

import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import { formatJobTaskStatus } from "@/lib/format-enums";

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

  estimatedDurationMinutes: number | null;

  status: JobTaskStatus;

  blockedReason: string | null;

  /** Count of job evidence rows linked to this task (all statuses), staff-only. */

  linkedEvidenceCount?: number;

  /** Parsed completion requirement for display and gating hints. */

  completionRequirement: CompletionRequirementDto;

  /** ACCEPTED evidence count matching requirement semantics (task-linked ± job-level). */

  acceptedEvidenceForRequirement: number;

  canManageCompletionRequirements: boolean;

  canOverrideEvidenceCompletion: boolean;

};



export function JobTaskStatusForm(props: {

  jobId: string;

  task: JobTaskRowModel;

  canUpdate: boolean;

  readOnlyHint: string | null;

  /** Optional schedule control (office band); rendered beside task header when provided. */

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

        <span className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">

          Evidence required

        </span>

      ) : null}

      {reqActive ? (

        <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">

          Accepted {accepted} / {minReq}

        </span>

      ) : null}

      {reqActive && req.allowJobLevelEvidence ? (

        <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">

          Job-level evidence allowed

        </span>

      ) : null}

      {task.linkedEvidenceCount != null && task.linkedEvidenceCount > 0 ? (

        <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">

          Evidence records (all statuses) {task.linkedEvidenceCount}

        </span>

      ) : null}

    </div>

  );



  const requirementNotes = (

    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">

      {reqInvalid ? (

        <p className="text-amber-200/90">

          Completion requirement configuration is invalid. Completion is blocked until office staff corrects this

          setting.

        </p>

      ) : null}

      {reqInvalid && task.canManageCompletionRequirements ? (

        <p className="text-muted-foreground">

          Use “Evidence requirement” to clear or replace this configuration.

        </p>

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

      <div className="space-y-3 border-t border-border/60 py-4 first:border-t-0 first:pt-0">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <div className="min-w-0 flex-1 space-y-1">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div className="flex min-w-0 flex-1 flex-col gap-2">

                <div className="flex flex-wrap items-center gap-2">

                  <p className="text-sm font-medium text-foreground">{task.title}</p>

                  {task.isRequired ? (

                    <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">

                      Required

                    </span>

                  ) : null}

                </div>

                {headerExtras}

                {requirementNotes}

              </div>

              {scheduleAction ? <div className="shrink-0">{scheduleAction}</div> : null}

            </div>

            <p className="text-xs text-muted-foreground">{formatJobTaskStatus(task.status)}</p>

            {task.description ? (

              <p className="text-xs leading-relaxed text-muted-foreground">{task.description}</p>

            ) : null}

            {task.internalNotes ? (

              <p className="text-xs leading-relaxed text-amber-200/80">

                <span className="font-medium text-foreground/90">Internal: </span>

                {task.internalNotes}

              </p>

            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">

              {task.assignedRole ? <span>Role: {task.assignedRole}</span> : null}

              {task.estimatedDurationMinutes != null ? (

                <span>Est. {task.estimatedDurationMinutes} min</span>

              ) : null}

            </div>

            {task.status === JobTaskStatus.BLOCKED && task.blockedReason ? (

              <p className="text-xs text-destructive/90">

                <span className="font-medium">Blocked: </span>

                {task.blockedReason}

              </p>

            ) : null}

          </div>

          {readOnlyHint ? <p className="max-w-xs text-xs text-muted-foreground">{readOnlyHint}</p> : null}

        </div>

      </div>

    );

  }



  const showBlockedField = selectedStatus === JobTaskStatus.BLOCKED;



  return (

    <form action={action} className="space-y-3 border-t border-border/60 py-4 first:border-t-0 first:pt-0">

      <input type="hidden" name="jobId" value={jobId} />

      <input type="hidden" name="taskId" value={task.id} />

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div className="min-w-0 flex-1 space-y-2">

          <div className="flex flex-wrap items-start justify-between gap-3">

            <div className="flex min-w-0 flex-1 flex-col gap-2">

              <div className="flex flex-wrap items-center gap-2">

                <p className="text-sm font-medium text-foreground">{task.title}</p>

                {task.isRequired ? (

                  <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">

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

            <p className="text-xs leading-relaxed text-muted-foreground">{task.description}</p>

          ) : null}

          {task.internalNotes ? (

            <p className="text-xs leading-relaxed text-amber-200/80">

              <span className="font-medium text-foreground/90">Internal: </span>

              {task.internalNotes}

            </p>

          ) : null}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">

            {task.assignedRole ? <span>Role: {task.assignedRole}</span> : null}

            {task.estimatedDurationMinutes != null ? (

              <span>Est. {task.estimatedDurationMinutes} min</span>

            ) : null}

          </div>

          {task.blockedReason && task.status === JobTaskStatus.BLOCKED ? (

            <p className="text-xs text-destructive/90">

              <span className="font-medium">Current block: </span>

              {task.blockedReason}

            </p>

          ) : null}

        </div>

      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">

        <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">

          <span>Status</span>

          <select

            name="status"

            value={selectedStatus}

            onChange={(e) => setSelectedStatus(e.target.value as JobTaskStatus)}

            className="rounded-sm border border-border bg-background px-2 py-1.5 text-sm text-foreground"

          >

            {ORDERED_STATUSES.map((s) => (

              <option key={s} value={s}>

                {formatJobTaskStatus(s)}

              </option>

            ))}

          </select>

        </label>

        {showBlockedField ? (

          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">

            <Label htmlFor={`blocked-${task.id}`} className="text-xs text-muted-foreground">

              Blocked reason

            </Label>

            <Textarea

              id={`blocked-${task.id}`}

              name="blockedReason"

              rows={2}

              required

              defaultValue={task.status === JobTaskStatus.BLOCKED ? task.blockedReason ?? "" : ""}

              placeholder="What is blocking this task?"

              className="rounded-sm resize-y text-sm"

            />

          </div>

        ) : null}

        {showOverrideControls ? (

          <div className="w-full space-y-2 rounded-sm border border-amber-500/30 bg-amber-500/5 p-3">

            <p className="text-xs font-medium text-amber-100">Management completion override</p>

            <p className="text-[11px] leading-relaxed text-muted-foreground">

              Use only when policy allows completing this task without the required accepted evidence on file. This is

              audited.

            </p>

            <div className="flex items-center gap-2">

              <input

                id={`ov-${task.id}`}

                type="checkbox"

                name="evidenceCompletionOverride"

                value="true"

                className="h-3.5 w-3.5 rounded-sm border border-input"

              />

              <Label htmlFor={`ov-${task.id}`} className="text-xs font-normal text-foreground cursor-pointer">

                Complete without required accepted evidence

              </Label>

            </div>

            <div className="space-y-1.5">

              <Label htmlFor={`ovr-${task.id}`} className="text-xs text-muted-foreground">

                Override reason

              </Label>

              <Textarea

                id={`ovr-${task.id}`}

                name="overrideReason"

                rows={2}

                placeholder="Document why completion is authorized without accepted evidence."

                className="rounded-sm resize-y text-sm"

              />

            </div>

          </div>

        ) : null}

        <Button type="submit" size="sm" variant="secondary" className="rounded-sm w-fit shrink-0">

          Save status

        </Button>

      </div>

      {state && !state.ok ? (

        <p className="text-xs text-destructive" role="alert">

          {state.error}

        </p>

      ) : null}

      {state && !state.ok && state.fieldErrors ? (

        <ul className="list-inside list-disc text-xs text-destructive">

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

