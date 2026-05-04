"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OpportunityPriority } from "@prisma/client";
import { createOpportunity, type ActionResult } from "@/app/(app)/app/sales/opportunities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { workspaceInputClass, workspaceSelectClass, workspaceTextareaClass } from "@/components/workspace/workspace-form-controls";
import { formatOpportunityPriority } from "@/lib/format-enums";
import { cn } from "@/lib/utils";

const initial: ActionResult | undefined = undefined;

export function OpportunityCreateForm(props: {
  customers: { id: string; displayName: string }[];
  members: { id: string; label: string }[];
  defaultCustomerId: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createOpportunity, initial);

  useEffect(() => {
    if (state?.ok && "opportunityId" in state && state.opportunityId) {
      router.push(`/app/sales/opportunities/${state.opportunityId}`);
    }
  }, [state, router]);

  if (props.customers.length === 0) {
    return (
      <div className="rounded-[6px] border border-border/80 bg-card/30 p-6 text-sm text-muted-foreground dark:border-zinc-800/60 dark:bg-zinc-950/30">
        Create a customer before opening an opportunity.{" "}
        <button type="button" className="font-medium text-primary hover:underline dark:text-blue-400" onClick={() => router.push("/app/customers/new")}>
          New customer
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl min-w-0 space-y-8">
      <div className="grid min-w-0 gap-6 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="customerId">Customer</Label>
          <select
            id="customerId"
            name="customerId"
            required
            defaultValue={props.defaultCustomerId ?? props.customers[0]?.id}
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
          >
            {props.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required className={cn(workspaceInputClass(), "min-w-0")} placeholder="Short label for this request" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceType">Service type</Label>
          <Input id="serviceType" name="serviceType" required className={cn(workspaceInputClass(), "min-w-0")} placeholder="e.g. EV charger install" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Lead source</Label>
          <Input id="source" name="source" required className={cn(workspaceInputClass(), "min-w-0")} placeholder="Referral, web, walk-in…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" name="priority" defaultValue={OpportunityPriority.NORMAL} className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}>
            {Object.values(OpportunityPriority).map((p) => (
              <option key={p} value={p}>
                {formatOpportunityPriority(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesOwnerUserId">Sales owner</Label>
          <select id="salesOwnerUserId" name="salesOwnerUserId" className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}>
            <option value="">Unassigned</option>
            {props.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="scopeIntent">Scope intent</Label>
          <Textarea
            id="scopeIntent"
            name="scopeIntent"
            required
            rows={5}
            className={cn(workspaceTextareaClass(), "min-h-[8rem] min-w-0 resize-y")}
            placeholder="What the customer wants done, in plain language, before line items exist."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="serviceAddressText">Service address</Label>
          <Textarea
            id="serviceAddressText"
            name="serviceAddressText"
            rows={2}
            className={cn(workspaceTextareaClass(), "min-h-[4rem] min-w-0 resize-y")}
            placeholder="Site address or directions"
          />
          <label className="flex items-start gap-2 text-sm text-muted-foreground dark:text-zinc-500">
            <input type="checkbox" name="serviceAddressTbd" className="mt-1 size-3.5 rounded-[4px] border border-input dark:border-zinc-600" />
            <span>Service location not yet determined (explicit)</span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2 rounded-[6px] border border-amber-500/25 bg-amber-500/5 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <label className="flex items-start gap-2 text-sm text-foreground dark:text-zinc-200">
            <input type="checkbox" name="contactIntakeWaived" className="mt-1 size-3.5 rounded-[4px] border border-input dark:border-zinc-600" />
            <span>
              <span className="font-medium">Waive contact intake</span>
              <span className="mt-1 block text-muted-foreground dark:text-zinc-500">
                Only use when policy allows proceeding without email or phone on file. This choice is recorded in the
                activity log.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="desiredTimeline">Desired timeline</Label>
          <Input id="desiredTimeline" name="desiredTimeline" className={cn(workspaceInputClass(), "min-w-0")} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qualificationStatus">Qualification</Label>
          <Input id="qualificationStatus" name="qualificationStatus" className={cn(workspaceInputClass(), "min-w-0")} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Estimated value</Label>
          <Input id="estimatedValue" name="estimatedValue" className={cn(workspaceInputClass(), "min-w-0")} placeholder="Optional number" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="followUpAt">Follow-up date</Label>
          <Input id="followUpAt" name="followUpAt" type="datetime-local" className={cn(workspaceInputClass(), "h-9 max-w-xs min-w-0")} />
        </div>
      </div>

      {state && !state.ok ? (
        <div className="rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} className="rounded-[5px] font-semibold">
          {pending ? "Creating…" : "Create opportunity"}
        </Button>
        <Button type="button" variant="outline" className="rounded-[5px] font-semibold" onClick={() => router.push("/app/sales/opportunities")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
