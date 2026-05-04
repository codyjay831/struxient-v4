"use client";

import { useActionState } from "react";
import {
  OpportunityPriority,
  OpportunityStatus,
} from "@prisma/client";
import { updateOpportunity, type ActionResult } from "@/app/(app)/app/sales/opportunities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workspaceInputClass, workspaceSelectClass, workspaceTextareaClass } from "@/components/workspace/workspace-form-controls";
import { formatOpportunityPriority, formatOpportunityStatus } from "@/lib/format-enums";
import { cn } from "@/lib/utils";

const initial: ActionResult | undefined = undefined;

export type OpportunityIntakeFields = {
  id: string;
  customerId: string;
  title: string;
  serviceType: string;
  source: string;
  priority: OpportunityPriority;
  status: OpportunityStatus;
  serviceAddressText: string | null;
  serviceAddressTbd: boolean;
  contactIntakeWaived: boolean;
  scopeIntent: string;
  desiredTimeline: string | null;
  salesOwnerUserId: string | null;
  qualificationStatus: string | null;
  estimatedValue: string | null;
  followUpAtLocal: string;
};

/** Compact read-only intake summary for open (editable) opportunities — before entering edit mode. */
export function OpportunityIntakeOpenSummary({
  opportunity: o,
  members,
}: {
  opportunity: OpportunityIntakeFields;
  members: { id: string; label: string }[];
}) {
  const ownerLabel = o.salesOwnerUserId
    ? (members.find((m) => m.id === o.salesOwnerUserId)?.label ?? "Unknown assignee")
    : "Unassigned";
  const scopePreview = o.scopeIntent.trim();
  const scopeClipped = scopePreview.length > 280 ? `${scopePreview.slice(0, 277)}…` : scopePreview;
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Title</p>
        <p className="mt-0.5 font-medium text-foreground dark:text-zinc-100">{o.title}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Service type</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{o.serviceType}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Lead source</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{o.source}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Priority</p>
        <p className="mt-0.5 text-foreground dark:text-zinc-200">{formatOpportunityPriority(o.priority)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Pipeline status</p>
        <p className="mt-0.5 text-foreground dark:text-zinc-200">{formatOpportunityStatus(o.status)}</p>
      </div>
      <div className="min-w-0 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Sales owner</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{ownerLabel}</p>
      </div>
      <div className="min-w-0 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Scope intent</p>
        <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground dark:text-zinc-300">{scopeClipped || "—"}</p>
      </div>
      <div className="min-w-0 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Service location</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">
          {o.serviceAddressTbd ? (
            <span className="text-amber-800 dark:text-amber-400/90">Location TBD (explicit)</span>
          ) : o.serviceAddressText?.trim() ? (
            o.serviceAddressText
          ) : (
            "—"
          )}
        </p>
      </div>
      <div className="min-w-0 sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Contact intake</p>
        <p
          className={cn(
            "mt-0.5 text-xs font-medium",
            o.contactIntakeWaived ? "text-amber-800 dark:text-amber-400/90" : "text-muted-foreground dark:text-zinc-500",
          )}
        >
          {o.contactIntakeWaived ? "Waived (policy exception on file)" : "Standard intake applies"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Desired timeline</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{o.desiredTimeline?.trim() || "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Qualification</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{o.qualificationStatus?.trim() || "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Estimated value</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{o.estimatedValue?.trim() || "—"}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">Follow-up</p>
        <p className="mt-0.5 text-muted-foreground dark:text-zinc-400">{o.followUpAtLocal ? o.followUpAtLocal.replace("T", " ") : "—"}</p>
      </div>
    </div>
  );
}

const editableStatuses: OpportunityStatus[] = [
  OpportunityStatus.NEW,
  OpportunityStatus.QUALIFIED,
  OpportunityStatus.INFO_GATHERING,
  OpportunityStatus.SITE_VISIT_NEEDED,
  OpportunityStatus.QUOTE_DRAFT_READY,
  OpportunityStatus.QUOTE_DRAFT_CREATED,
];

export function OpportunityIntakeForm(props: {
  opportunity: OpportunityIntakeFields;
  members: { id: string; label: string }[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateOpportunity, initial);
  const o = props.opportunity;

  if (props.disabled) {
    return (
      <div className="grid gap-4 rounded-[6px] border border-border bg-card/20 p-4 text-sm sm:grid-cols-2 dark:border-zinc-800/60 dark:bg-zinc-950/25">
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Title</p>
          <p className="mt-1 text-foreground">{o.title}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Service type</p>
          <p className="mt-1 text-muted-foreground">{o.serviceType}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Source</p>
          <p className="mt-1 text-muted-foreground">{o.source}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Scope intent</p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{o.scopeIntent}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="min-w-0 space-y-6">
      <input type="hidden" name="opportunityId" value={o.id} />
      <input type="hidden" name="customerId" value={o.customerId} />

      <div className="grid min-w-0 gap-6 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-title">Title</Label>
          <Input id="o-title" name="title" required defaultValue={o.title} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-serviceType">Service type</Label>
          <Input id="o-serviceType" name="serviceType" required defaultValue={o.serviceType} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-source">Lead source</Label>
          <Input id="o-source" name="source" required defaultValue={o.source} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-priority">Priority</Label>
          <select
            id="o-priority"
            name="priority"
            defaultValue={o.priority}
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
          >
            {Object.values(OpportunityPriority).map((p) => (
              <option key={p} value={p}>
                {formatOpportunityPriority(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-status">Pipeline status</Label>
          <select
            id="o-status"
            name="status"
            defaultValue={o.status}
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
          >
            {editableStatuses.map((s) => (
              <option key={s} value={s}>
                {formatOpportunityStatus(s)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-salesOwnerUserId">Sales owner</Label>
          <select
            id="o-salesOwnerUserId"
            name="salesOwnerUserId"
            defaultValue={o.salesOwnerUserId ?? ""}
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
          >
            <option value="">Unassigned</option>
            {props.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-scopeIntent">Scope intent</Label>
          <Textarea
            id="o-scopeIntent"
            name="scopeIntent"
            required
            defaultValue={o.scopeIntent}
            rows={5}
            className={cn(workspaceTextareaClass(), "min-h-[8rem] min-w-0 resize-y")}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-serviceAddressText">Service address</Label>
          <Textarea
            id="o-serviceAddressText"
            name="serviceAddressText"
            rows={2}
            defaultValue={o.serviceAddressText ?? ""}
            className={cn(workspaceTextareaClass(), "min-h-[4rem] min-w-0 resize-y")}
          />
          <label className="flex items-start gap-2 text-sm text-muted-foreground dark:text-zinc-500">
            <input
              type="checkbox"
              name="serviceAddressTbd"
              defaultChecked={o.serviceAddressTbd}
              className="mt-1 size-3.5 rounded-[4px] border border-input dark:border-zinc-600"
            />
            <span>Service location not yet determined (explicit)</span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2 rounded-[6px] border border-amber-500/25 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <label className="flex items-start gap-2 text-sm text-foreground dark:text-zinc-200">
            <input
              type="checkbox"
              name="contactIntakeWaived"
              defaultChecked={o.contactIntakeWaived}
              className="mt-1 size-3.5 rounded-[4px] border border-input dark:border-zinc-600"
            />
            <span>
              <span className="font-medium">Waive contact intake</span>
              <span className="mt-1 block text-muted-foreground dark:text-zinc-500">
                Recorded in the activity log when toggled. Use only when policy allows proceeding without contacts.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-desiredTimeline">Desired timeline</Label>
          <Input id="o-desiredTimeline" name="desiredTimeline" defaultValue={o.desiredTimeline ?? ""} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-qualificationStatus">Qualification</Label>
          <Input
            id="o-qualificationStatus"
            name="qualificationStatus"
            defaultValue={o.qualificationStatus ?? ""}
            className={cn(workspaceInputClass(), "min-w-0")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-estimatedValue">Estimated value</Label>
          <Input id="o-estimatedValue" name="estimatedValue" defaultValue={o.estimatedValue ?? ""} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-followUpAt">Follow-up date</Label>
          <Input
            id="o-followUpAt"
            name="followUpAt"
            type="datetime-local"
            defaultValue={o.followUpAtLocal}
            className={cn(workspaceInputClass(), "h-9 max-w-xs min-w-0")}
          />
        </div>
      </div>

      {state && !state.ok ? (
        <div className="rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? <p className="text-sm text-muted-foreground">Saved.</p> : null}

      <Button type="submit" size="sm" disabled={pending} className="rounded-[5px] font-semibold">
        {pending ? "Saving…" : "Save opportunity"}
      </Button>
    </form>
  );
}
