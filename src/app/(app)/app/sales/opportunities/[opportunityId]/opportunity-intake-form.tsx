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
import { formatOpportunityPriority, formatOpportunityStatus } from "@/lib/format-enums";

const initial: ActionResult | undefined = undefined;

const editableStatuses: OpportunityStatus[] = [
  OpportunityStatus.NEW,
  OpportunityStatus.QUALIFIED,
  OpportunityStatus.INFO_GATHERING,
  OpportunityStatus.SITE_VISIT_NEEDED,
  OpportunityStatus.QUOTE_DRAFT_READY,
  OpportunityStatus.QUOTE_DRAFT_CREATED,
];

export function OpportunityIntakeForm(props: {
  opportunity: {
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
  members: { id: string; label: string }[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateOpportunity, initial);
  const o = props.opportunity;

  if (props.disabled) {
    return (
      <div className="grid gap-4 rounded-sm border border-border bg-card/20 p-4 text-sm sm:grid-cols-2">
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
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="opportunityId" value={o.id} />
      <input type="hidden" name="customerId" value={o.customerId} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-title">Title</Label>
          <Input id="o-title" name="title" required defaultValue={o.title} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-serviceType">Service type</Label>
          <Input id="o-serviceType" name="serviceType" required defaultValue={o.serviceType} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-source">Lead source</Label>
          <Input id="o-source" name="source" required defaultValue={o.source} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-priority">Priority</Label>
          <select
            id="o-priority"
            name="priority"
            defaultValue={o.priority}
            className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
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
            className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
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
            className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
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
          <Textarea id="o-scopeIntent" name="scopeIntent" required defaultValue={o.scopeIntent} rows={5} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-serviceAddressText">Service address</Label>
          <Textarea
            id="o-serviceAddressText"
            name="serviceAddressText"
            rows={2}
            defaultValue={o.serviceAddressText ?? ""}
          />
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              name="serviceAddressTbd"
              defaultChecked={o.serviceAddressTbd}
              className="mt-1 size-3.5 rounded-sm border border-input"
            />
            <span>Service location not yet determined (explicit)</span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2 rounded-sm border border-amber-500/25 bg-amber-500/5 p-4">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="contactIntakeWaived"
              defaultChecked={o.contactIntakeWaived}
              className="mt-1 size-3.5 rounded-sm border border-input"
            />
            <span>
              <span className="font-medium">Waive contact intake</span>
              <span className="mt-1 block text-muted-foreground">
                Recorded in the activity log when toggled. Use only when policy allows proceeding without contacts.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-desiredTimeline">Desired timeline</Label>
          <Input id="o-desiredTimeline" name="desiredTimeline" defaultValue={o.desiredTimeline ?? ""} className="rounded-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-qualificationStatus">Qualification</Label>
          <Input
            id="o-qualificationStatus"
            name="qualificationStatus"
            defaultValue={o.qualificationStatus ?? ""}
            className="rounded-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-estimatedValue">Estimated value</Label>
          <Input id="o-estimatedValue" name="estimatedValue" defaultValue={o.estimatedValue ?? ""} className="rounded-sm" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-followUpAt">Follow-up date</Label>
          <Input
            id="o-followUpAt"
            name="followUpAt"
            type="datetime-local"
            defaultValue={o.followUpAtLocal}
            className="max-w-xs rounded-sm"
          />
        </div>
      </div>

      {state && !state.ok ? (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}
      {state?.ok ? <p className="text-sm text-muted-foreground">Saved.</p> : null}

      <Button type="submit" size="sm" disabled={pending} className="rounded-sm">
        {pending ? "Saving…" : "Save opportunity"}
      </Button>
    </form>
  );
}
