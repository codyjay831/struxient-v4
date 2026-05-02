"use client";

import { useActionState } from "react";
import { createQuoteDraftFromOpportunity } from "@/app/(app)/app/sales/quotes/actions";
import { Button } from "@/components/ui/button";

export function CreateQuoteDraftForm({ opportunityId }: { opportunityId: string }) {
  const [state, formAction, pending] = useActionState(createQuoteDraftFromOpportunity, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="rounded-sm">
        {pending ? "Creating…" : "Create quote draft"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Opens the quote workspace where line items, planned execution, readiness, and internal customer preview are
        authored. Only one active draft per opportunity is allowed until the quote is sent.
      </p>
    </form>
  );
}
