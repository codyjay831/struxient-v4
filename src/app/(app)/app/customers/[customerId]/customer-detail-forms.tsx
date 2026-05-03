"use client";

import { useActionState, useMemo } from "react";
import {
  CustomerContactType,
  CustomerKind,
  CustomerStatus,
} from "@prisma/client";
import { updateCustomer, addCustomerContactMethod, updateCustomerContactMethod, type ActionResult } from "@/app/(app)/app/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/customers/customer-area";
import { formatContactType, formatCustomerKind, formatCustomerStatus } from "@/lib/format-enums";
import { cn } from "@/lib/utils";

const initial: ActionResult | undefined = undefined;

type Contact = {
  id: string;
  type: CustomerContactType;
  value: string;
  isPrimary: boolean;
  okToEmail: boolean;
  okToSms: boolean;
  label: string | null;
  archivedAt: string | null;
};

export function CustomerProfileForm(props: {
  customerId: string;
  displayName: string;
  kind: CustomerKind;
  status: CustomerStatus;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState(updateCustomer, initial);
  const defaults = useMemo(
    () => ({
      displayName: props.displayName,
      kind: props.kind,
      status: props.status,
      notes: props.notes ?? "",
    }),
    [props.displayName, props.kind, props.status, props.notes],
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="customerId" value={props.customerId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cd-displayName" className="text-xs font-medium text-muted-foreground">
            Display name
          </Label>
          <Input
            id="cd-displayName"
            name="displayName"
            required
            key={defaults.displayName}
            defaultValue={defaults.displayName}
            aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.displayName)}
            className={cn(
              "rounded-md border-border/80 bg-background/50",
              state && !state.ok && state.fieldErrors?.displayName && "border-destructive ring-1 ring-destructive/30",
            )}
          />
          <FieldError message={state && !state.ok ? state.fieldErrors?.displayName?.[0] : undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd-kind" className="text-xs font-medium text-muted-foreground">
            Kind
          </Label>
          <select
            id="cd-kind"
            name="kind"
            defaultValue={defaults.kind}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            {[CustomerKind.UNKNOWN, CustomerKind.PERSON, CustomerKind.COMPANY].map((k) => (
              <option key={k} value={k}>
                {formatCustomerKind(k)}
              </option>
            ))}
          </select>
          <FieldError message={state && !state.ok ? state.fieldErrors?.kind?.[0] : undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd-status" className="text-xs font-medium text-muted-foreground">
            Status
          </Label>
          <select
            id="cd-status"
            name="status"
            defaultValue={defaults.status}
            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {[CustomerStatus.ACTIVE, CustomerStatus.INACTIVE, CustomerStatus.ARCHIVED].map((s) => (
              <option key={s} value={s}>
                {formatCustomerStatus(s)}
              </option>
            ))}
          </select>
          <FieldError message={state && !state.ok ? state.fieldErrors?.status?.[0] : undefined} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cd-notes" className="text-xs font-medium text-muted-foreground">
            Notes
          </Label>
          <Textarea
            id="cd-notes"
            name="notes"
            key={defaults.notes}
            defaultValue={defaults.notes}
            rows={4}
            aria-invalid={Boolean(state && !state.ok && state.fieldErrors?.notes)}
            className={cn(
              "rounded-md border-border/80 bg-background/50",
              state && !state.ok && state.fieldErrors?.notes && "border-destructive ring-1 ring-destructive/30",
            )}
          />
          <FieldError message={state && !state.ok ? state.fieldErrors?.notes?.[0] : undefined} />
        </div>
      </div>
      {state && !state.ok && !state.fieldErrors ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="text-xs font-medium text-primary">Saved.</p> : null}
      <Button type="submit" size="sm" disabled={pending} className="rounded-md font-semibold">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function ContactAddForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(addCustomerContactMethod, initial);
  return (
    <form
      action={action}
      className="grid gap-3 rounded-md border border-dashed border-border/70 bg-muted/10 p-4 sm:grid-cols-2 dark:bg-muted/5"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <div className="space-y-2">
        <Label htmlFor="nc-type" className="text-xs font-medium text-muted-foreground">
          Type
        </Label>
        <select
          id="nc-type"
          name="type"
          defaultValue={CustomerContactType.PHONE}
          className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 text-sm shadow-sm"
        >
          {Object.values(CustomerContactType).map((t) => (
            <option key={t} value={t}>
              {formatContactType(t)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="nc-value" className="text-xs font-medium text-muted-foreground">
          Value
        </Label>
        <Input id="nc-value" name="value" required className="rounded-md bg-background/50" placeholder="Email or phone number" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nc-label" className="text-xs font-medium text-muted-foreground">
          Label
        </Label>
        <Input id="nc-label" name="label" className="rounded-md bg-background/50" placeholder="Optional" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="isPrimary" className="size-3.5 rounded-sm border border-input" />
          Primary
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="okToEmail" className="size-3.5 rounded-sm border border-input" />
          OK to email
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="okToSms" className="size-3.5 rounded-sm border border-input" />
          OK to SMS
        </label>
      </div>
      <div className="sm:col-span-2">
        {state && !state.ok ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
        ) : null}
        <Button type="submit" size="sm" disabled={pending} className="mt-3 rounded-md font-semibold">
          {pending ? "Adding…" : "Add contact"}
        </Button>
      </div>
    </form>
  );
}

export function ContactEditForm({ customerId, c }: { customerId: string; c: Contact }) {
  const [state, action, pending] = useActionState(updateCustomerContactMethod, initial);
  const archived = Boolean(c.archivedAt);
  return (
    <form
      action={action}
      className={cn(
        "space-y-3 rounded-md border border-border/80 p-3.5",
        archived ? "border-dashed opacity-60" : "bg-card/25 dark:bg-card/15",
      )}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="contactId" value={c.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <select
            name="type"
            defaultValue={c.type}
            disabled={archived}
            className="flex h-9 w-full rounded-md border border-input bg-background/50 px-2 text-sm"
          >
            {Object.values(CustomerContactType).map((t) => (
              <option key={t} value={t}>
                {formatContactType(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Value</Label>
          <Input name="value" required defaultValue={c.value} disabled={archived} className="rounded-md bg-background/50" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <Input name="label" defaultValue={c.label ?? ""} disabled={archived} className="rounded-md bg-background/50" />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isPrimary"
            defaultChecked={c.isPrimary}
            disabled={archived}
            className="size-3.5 rounded-sm border border-input"
          />
          Primary
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="okToEmail"
            defaultChecked={c.okToEmail}
            disabled={archived}
            className="size-3.5 rounded-sm border border-input"
          />
          OK to email
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="okToSms"
            defaultChecked={c.okToSms}
            disabled={archived}
            className="size-3.5 rounded-sm border border-input"
          />
          OK to SMS
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="archived" defaultChecked={archived} className="size-3.5 rounded-sm border border-input" />
          Archived
        </label>
      </div>
      {state && !state.ok ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="rounded-md font-semibold">
        {pending ? "Updating…" : "Update contact"}
      </Button>
    </form>
  );
}
