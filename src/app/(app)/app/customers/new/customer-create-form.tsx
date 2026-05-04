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
import { FieldError, MetadataPill } from "@/components/customers/customer-area";
import { WorkspacePanelFrame } from "@/components/workspace/workspace-panel-frame";
import { WorkspaceSummaryPanel } from "@/components/workspace/workspace-summary-panel";
import { workspaceInputClass, workspaceSelectClass, workspaceTextareaClass } from "@/components/workspace/workspace-form-controls";
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
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,17rem)] xl:grid-cols-[minmax(0,1fr)_min(100%,19rem)]">
      <form action={formAction} className="min-w-0 space-y-6">
        <WorkspacePanelFrame
          kicker="Identity"
          title="Who is this record for?"
          subtitle="This name appears across sales, scheduling, and jobs. You can refine details anytime after save."
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
                  workspaceInputClass(),
                  "min-w-0",
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
                  workspaceSelectClass(),
                  "h-9 w-full min-w-0",
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
        </WorkspacePanelFrame>

        <WorkspacePanelFrame
          kicker="Context"
          title="Relationship notes"
          subtitle="Internal context only — how you know them, gate codes, billing preferences, or cautions. Not shown to customers."
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
                workspaceTextareaClass(),
                "min-h-[120px] min-w-0 resize-y",
                state && !state.ok && state.fieldErrors?.notes && "border-destructive ring-1 ring-destructive/30",
              )}
              aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.notes)}
            />
            <FieldError message={state && !state.ok ? state.fieldErrors?.notes?.[0] : undefined} />
          </div>
        </WorkspacePanelFrame>

        {state && !state.ok && !state.fieldErrors ? (
          <p className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
            {state.error}
          </p>
        ) : null}
        {state && !state.ok && state.fieldErrors && !state.fieldErrors.displayName && !state.fieldErrors.notes && !state.fieldErrors.kind ? (
          <p className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        <div className="flex min-w-0 flex-wrap items-center gap-3 border-t border-border/50 pt-6 dark:border-zinc-800/50">
          <Button type="submit" disabled={pending} className="rounded-[5px] px-5 font-semibold">
            {pending ? "Creating…" : "Create customer"}
          </Button>
          <Button type="button" variant="outline" className="rounded-[5px]" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>

      <WorkspaceSummaryPanel title="Record preview">
        <div className="rounded-[6px] border border-primary/25 bg-primary/[0.06] p-3 dark:border-blue-500/30 dark:bg-blue-500/[0.07]">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary dark:text-blue-400" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-foreground dark:text-zinc-100">What happens next</h2>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">
                This customer becomes the anchor for opportunities, quotes, contact methods, notes, portal activity, and jobs.
                Add depth as work progresses.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">As saved</p>
          <div className="flex items-start gap-2">
            {kind === CustomerKind.COMPANY ? (
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground dark:text-zinc-500" aria-hidden />
            ) : kind === CustomerKind.PERSON ? (
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground dark:text-zinc-500" aria-hidden />
            ) : (
              <ClipboardList className="mt-0.5 size-4 shrink-0 text-muted-foreground dark:text-zinc-500" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground dark:text-zinc-100">{previewName}</p>
              <p className="text-xs text-muted-foreground dark:text-zinc-500">{previewKind}</p>
            </div>
          </div>
          <MetadataPill variant="accent">Operational record</MetadataPill>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">
          After creation, open the customer to add emails and phones, link opportunities, and track activity — all scoped to your
          organization.
        </p>
      </WorkspaceSummaryPanel>
    </div>
  );
}
