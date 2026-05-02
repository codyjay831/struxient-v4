"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerKind } from "@prisma/client";
import { createCustomer, type ActionResult } from "@/app/(app)/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: ActionResult | undefined = undefined;

export function CustomerCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCustomer, initial);

  useEffect(() => {
    if (state?.ok && "customerId" in state && state.customerId) {
      router.push(`/app/customers/${state.customerId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          required
          autoComplete="organization"
          placeholder="Company or person name"
          className="rounded-sm"
        />
        {state && !state.ok && state.fieldErrors?.displayName?.[0] ? (
          <p className="text-xs text-destructive">{state.fieldErrors.displayName[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="kind">Kind</Label>
        <select
          id="kind"
          name="kind"
          defaultValue={CustomerKind.UNKNOWN}
          className="flex h-9 w-full rounded-sm border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value={CustomerKind.UNKNOWN}>Unknown</option>
          <option value={CustomerKind.PERSON}>Person</option>
          <option value={CustomerKind.COMPANY}>Company</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" placeholder="Relationship context, access notes, or preferences" rows={4} />
      </div>

      {state && !state.ok && !state.fieldErrors ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state && !state.ok && state.fieldErrors && !state.fieldErrors.displayName ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="rounded-sm">
          {pending ? "Saving…" : "Create customer"}
        </Button>
        <Button type="button" variant="outline" className="rounded-sm" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
