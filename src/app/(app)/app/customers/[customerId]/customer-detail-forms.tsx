"use client";

import { useActionState, useMemo, useState } from "react";
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
import { workspaceInputClass, workspaceSelectClass, workspaceTextareaClass } from "@/components/workspace/workspace-form-controls";
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
    <form action={action} className="min-w-0 space-y-5">
      <input type="hidden" name="customerId" value={props.customerId} />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
              workspaceInputClass(),
              "min-w-0",
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
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
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
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
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
              workspaceTextareaClass(),
              "min-h-[6rem] min-w-0 resize-y",
              state && !state.ok && state.fieldErrors?.notes && "border-destructive ring-1 ring-destructive/30",
            )}
          />
          <FieldError message={state && !state.ok ? state.fieldErrors?.notes?.[0] : undefined} />
        </div>
      </div>
      {state && !state.ok && !state.fieldErrors ? (
        <p className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-xs font-medium text-primary">Saved.</p> : null}
      <Button type="submit" size="sm" disabled={pending} className="rounded-[5px] font-semibold">
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
      className="grid min-w-0 gap-3 rounded-[6px] border border-dashed border-border/70 bg-muted/10 p-4 sm:grid-cols-2 dark:border-zinc-800/60 dark:bg-zinc-950/20"
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
          className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
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
        <Input id="nc-value" name="value" required className={cn(workspaceInputClass(), "min-w-0")} placeholder="Email or phone number" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nc-label" className="text-xs font-medium text-muted-foreground">
          Label
        </Label>
        <Input id="nc-label" name="label" className={cn(workspaceInputClass(), "min-w-0")} placeholder="Optional" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="isPrimary" className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600" />
          Primary
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="okToEmail" className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600" />
          OK to email
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="okToSms" className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600" />
          OK to SMS
        </label>
      </div>
      <div className="sm:col-span-2">
        {state && !state.ok ? (
          <p className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={pending} className="mt-3 rounded-[5px] font-semibold">
          {pending ? "Adding…" : "Add contact"}
        </Button>
      </div>
    </form>
  );
}

export function ContactAddCollapsible({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" className="rounded-[5px] font-semibold" onClick={() => setOpen(true)}>
        Add contact method
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-[6px] border border-border bg-muted/20 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">New contact</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 rounded-[5px] text-[11px]" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <ContactAddForm customerId={customerId} />
    </div>
  );
}

export function CustomerProfileWorkspaceSection(props: {
  customerId: string;
  displayName: string;
  kind: CustomerKind;
  status: CustomerStatus;
  notes: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const notesPreview = (props.notes ?? "").trim();
  const clipped = notesPreview.length > 160 ? `${notesPreview.slice(0, 157)}…` : notesPreview;
  if (!editing) {
    return (
      <div className="rounded-[6px] border border-border bg-card/30 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-semibold text-foreground">{props.displayName}</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{formatCustomerKind(props.kind)}</span>
              <span className="text-border dark:text-zinc-700" aria-hidden>
                ·
              </span>
              <span>{formatCustomerStatus(props.status)}</span>
            </div>
            {clipped ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{clipped}</p>
            ) : (
              <p className="text-xs text-muted-foreground">No internal notes yet.</p>
            )}
          </div>
          <Button type="button" size="sm" className="shrink-0 rounded-[5px] font-semibold" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-[5px] text-[11px] text-muted-foreground"
          onClick={() => {
            setEditing(false);
            setFormKey((k) => k + 1);
          }}
        >
          Collapse editor
        </Button>
      </div>
      <CustomerProfileForm key={formKey} {...props} />
    </div>
  );
}

export function ContactEditForm({ customerId, c }: { customerId: string; c: Contact }) {
  const [state, action, pending] = useActionState(updateCustomerContactMethod, initial);
  const archived = Boolean(c.archivedAt);
  return (
    <form
      action={action}
      className={cn(
        "min-w-0 space-y-3 rounded-[6px] border border-border/80 p-3.5 dark:border-zinc-800/60",
        archived ? "border-dashed opacity-60" : "bg-card/25 dark:bg-card/15",
      )}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="contactId" value={c.id} />
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <select
            name="type"
            defaultValue={c.type}
            disabled={archived}
            className={cn(workspaceSelectClass(), "h-9 w-full min-w-0")}
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
          <Input name="value" required defaultValue={c.value} disabled={archived} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-muted-foreground">Label</Label>
          <Input name="label" defaultValue={c.label ?? ""} disabled={archived} className={cn(workspaceInputClass(), "min-w-0")} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isPrimary"
            defaultChecked={c.isPrimary}
            disabled={archived}
            className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600"
          />
          Primary
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="okToEmail"
            defaultChecked={c.okToEmail}
            disabled={archived}
            className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600"
          />
          OK to email
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="okToSms"
            defaultChecked={c.okToSms}
            disabled={archived}
            className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600"
          />
          OK to SMS
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="archived" defaultChecked={archived} className="size-3.5 rounded-[4px] border border-input dark:border-zinc-600" />
          Archived
        </label>
      </div>
      {state && !state.ok ? (
        <p className="rounded-[6px] border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive dark:border-red-900/45 dark:bg-red-950/25 dark:text-red-300">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="sm" variant="secondary" disabled={pending} className="rounded-[5px] font-semibold">
        {pending ? "Updating…" : "Update contact"}
      </Button>
    </form>
  );
}

/** Compact operational row; expands to the full edit form on demand. */
export function ContactMethodWorkspaceRow({ customerId, c }: { customerId: string; c: Contact }) {
  const [open, setOpen] = useState(false);
  const archived = Boolean(c.archivedAt);
  return (
    <li className={cn("min-w-0", archived && "opacity-[0.85]")}>
      {!open ? (
        <div className="flex min-w-0 flex-col gap-2 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:p-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium text-foreground dark:text-zinc-100">{c.value}</p>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-500">
              <span>{formatContactType(c.type)}</span>
              {c.label ? (
                <>
                  <span className="text-border dark:text-zinc-700" aria-hidden>
                    ·
                  </span>
                  <span className="truncate">{c.label}</span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {c.isPrimary ? (
                <span className="rounded-[4px] border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-200">
                  Primary
                </span>
              ) : null}
              {archived ? (
                <span className="rounded-[4px] border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/60">
                  Archived
                </span>
              ) : null}
              {c.okToEmail ? (
                <span className="rounded-[4px] border border-border/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-zinc-700">
                  Email OK
                </span>
              ) : null}
              {c.okToSms ? (
                <span className="rounded-[4px] border border-border/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-zinc-700">
                  SMS OK
                </span>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 rounded-[5px] font-semibold"
            onClick={() => setOpen(true)}
          >
            Edit
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" className="h-7 rounded-[5px] text-[11px]" onClick={() => setOpen(false)}>
              Close editor
            </Button>
          </div>
          <ContactEditForm customerId={customerId} c={c} />
        </div>
      )}
    </li>
  );
}
