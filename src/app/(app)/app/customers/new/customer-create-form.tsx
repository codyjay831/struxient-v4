"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerKind } from "@prisma/client";
import { Building2, ClipboardList, Sparkles, User } from "lucide-react";
import { createCustomer, type ActionResult } from "@/app/(app)/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CustomerSectionCard,
  FieldError,
  MetadataPill,
} from "@/components/customers/customer-area";
import { formatCustomerKind } from "@/lib/format-enums";
import { cn } from "@/lib/utils";

const initial: ActionResult | undefined = undefined;

export function CustomerCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createCustomer, initial);
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<CustomerKind>(CustomerKind.UNKNOWN);

  useEffect(() => {
    if (state?.ok && "customerId" in state && state.customerId) {
      router.push(`/app/customers/${state.customerId}`);
    }
  }, [state, router]);

  const previewName = displayName.trim() || "—";
  const previewKind = formatCustomerKind(kind);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,320px)] lg:items-start">
      <form action={formAction} className="min-w-0 space-y-6">
        <div className="space-y-6">
          <CustomerSectionCard
            title="Identity"
            description="This name appears across sales, scheduling, and jobs. You can refine details anytime."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-xs font-medium text-muted-foreground">
                  Display name
                </Label>
                <Input
                  id="displayName"
                  name="displayName"
                  required
                  autoComplete="organization"
                  placeholder="Company or person name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.displayName)}
                  className={cn(
                    "rounded-md border-border/80 bg-background/50",
                    state && !state.ok && state.fieldErrors?.displayName && "border-destructive ring-1 ring-destructive/30",
                  )}
                />
                <FieldError message={state && !state.ok ? state.fieldErrors?.displayName?.[0] : undefined} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kind" className="text-xs font-medium text-muted-foreground">
                  Kind
                </Label>
                <select
                  id="kind"
                  name="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as CustomerKind)}
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm text-foreground shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    state && !state.ok && state.fieldErrors?.kind && "border-destructive ring-1 ring-destructive/30",
                  )}
                >
                  <option value={CustomerKind.UNKNOWN}>{formatCustomerKind(CustomerKind.UNKNOWN)}</option>
                  <option value={CustomerKind.PERSON}>{formatCustomerKind(CustomerKind.PERSON)}</option>
                  <option value={CustomerKind.COMPANY}>{formatCustomerKind(CustomerKind.COMPANY)}</option>
                </select>
                <FieldError message={state && !state.ok ? state.fieldErrors?.kind?.[0] : undefined} />
              </div>
            </div>
          </CustomerSectionCard>

          <CustomerSectionCard
            title="Relationship notes"
            description="Internal context only — how you know them, gate codes, billing preferences, or cautions. Not shown to customers."
          >
            <div className="space-y-2">
              <Label htmlFor="notes" className="sr-only">
                Notes
              </Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Access instructions, referral source, relationship history…"
                rows={5}
                className={cn(
                  "min-h-[120px] resize-y rounded-md border-border/80 bg-background/50",
                  state && !state.ok && state.fieldErrors?.notes && "border-destructive ring-1 ring-destructive/30",
                )}
                aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.notes)}
              />
              <FieldError message={state && !state.ok ? state.fieldErrors?.notes?.[0] : undefined} />
            </div>
          </CustomerSectionCard>
        </div>

        {state && !state.ok && !state.fieldErrors ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {state && !state.ok && state.fieldErrors && !state.fieldErrors.displayName && !state.fieldErrors.notes && !state.fieldErrors.kind ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-6">
          <Button type="submit" disabled={pending} className="rounded-md px-5 font-semibold">
            {pending ? "Creating…" : "Create customer"}
          </Button>
          <Button type="button" variant="outline" className="rounded-md" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="rounded-md border border-primary/25 bg-primary/[0.06] p-4 dark:bg-primary/[0.09]">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-foreground">What happens next</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                This customer becomes the anchor for opportunities, quotes, contact methods, notes, portal activity, and
                jobs. Nothing is lost if you start lean — add depth as work progresses.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border/80 bg-card/30 p-4 dark:bg-card/25">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Record preview</h2>
          <div className="mt-3 space-y-3">
            <div className="flex items-start gap-2">
              {kind === CustomerKind.COMPANY ? (
                <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : kind === CustomerKind.PERSON ? (
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{previewName}</p>
                <p className="text-xs text-muted-foreground">{previewKind}</p>
              </div>
            </div>
            <MetadataPill variant="accent">Operational record</MetadataPill>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          After creation, open the customer to add emails and phones, link opportunities, and track activity — all
          scoped to your organization.
        </p>
      </aside>
    </div>
  );
}
