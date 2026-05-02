"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OpportunityPriority } from "@prisma/client";
import { createOpportunity, type ActionResult } from "@/app/(app)/app/sales/opportunities/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatOpportunityPriority } from "@/lib/format-enums";

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
      <div className="rounded-sm border border-border bg-card/30 p-6 text-sm text-muted-foreground">
        Create a customer before opening an opportunity.{" "}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => router.push("/app/customers/new")}>
          New customer
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="customerId">Customer</Label>
          <select
            id="customerId"
            name="customerId"
            required
            defaultValue={props.defaultCustomerId ?? props.customers[0]?.id}
            className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm"
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
          <Input id="title" name="title" required className="rounded-sm" placeholder="Short label for this request" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceType">Service type</Label>
          <Input id="serviceType" name="serviceType" required className="rounded-sm" placeholder="e.g. EV charger install" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Lead source</Label>
          <Input id="source" name="source" required className="rounded-sm" placeholder="Referral, web, walk-in…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" name="priority" defaultValue={OpportunityPriority.NORMAL} className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
            {Object.values(OpportunityPriority).map((p) => (
              <option key={p} value={p}>
                {formatOpportunityPriority(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="salesOwnerUserId">Sales owner</Label>
          <select id="salesOwnerUserId" name="salesOwnerUserId" className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm">
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
            placeholder="What the customer wants done, in plain language, before line items exist."
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="serviceAddressText">Service address</Label>
          <Textarea id="serviceAddressText" name="serviceAddressText" rows={2} placeholder="Site address or directions" />
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="serviceAddressTbd" className="mt-1 size-3.5 rounded-sm border border-input" />
            <span>Service location not yet determined (explicit)</span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2 rounded-sm border border-amber-500/25 bg-amber-500/5 p-4">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" name="contactIntakeWaived" className="mt-1 size-3.5 rounded-sm border border-input" />
            <span>
              <span className="font-medium">Waive contact intake</span>
              <span className="mt-1 block text-muted-foreground">
                Only use when policy allows proceeding without email or phone on file. This choice is recorded in the
                activity log.
              </span>
            </span>
          </label>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="desiredTimeline">Desired timeline</Label>
          <Input id="desiredTimeline" name="desiredTimeline" className="rounded-sm" placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qualificationStatus">Qualification</Label>
          <Input id="qualificationStatus" name="qualificationStatus" className="rounded-sm" placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Estimated value</Label>
          <Input id="estimatedValue" name="estimatedValue" className="rounded-sm" placeholder="Optional number" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="followUpAt">Follow-up date</Label>
          <Input id="followUpAt" name="followUpAt" type="datetime-local" className="max-w-xs rounded-sm" />
        </div>
      </div>

      {state && !state.ok ? (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {state.error}
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="rounded-sm">
          {pending ? "Creating…" : "Create opportunity"}
        </Button>
        <Button type="button" variant="outline" className="rounded-sm" onClick={() => router.push("/app/sales/opportunities")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
