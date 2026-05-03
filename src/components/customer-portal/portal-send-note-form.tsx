"use client";

import { useActionState, useMemo, useState } from "react";
import { CustomerPortalSubmissionType } from "@prisma/client";

import { submitPortalCustomerNote } from "@/app/portal/[token]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PORTAL_SUBMISSION_MESSAGE_MAX } from "@/server/phase9/customer-portal-submission-types";

type Props = {
  rawToken: string;
};

export function PortalSendNoteForm({ rawToken }: Props) {
  const [messageLen, setMessageLen] = useState(0);
  const [state, action, pending] = useActionState(submitPortalCustomerNote, undefined);

  const success = state?.ok === true;
  const errorText = state && !state.ok ? state.error : null;

  const typeOptions = useMemo(
    () =>
      [
        { value: CustomerPortalSubmissionType.GENERAL_REQUEST, label: "General question" },
        { value: CustomerPortalSubmissionType.AVAILABILITY_NOTE, label: "Availability note" },
      ] as const,
    [],
  );

  if (success) {
    return (
      <div
        className="rounded-sm border border-border bg-background/60 px-4 py-4"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-foreground">We received your note.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The office will review it. If you need urgent help, use the contact information above.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="portalToken" value={rawToken} />

      <div className="space-y-2">
        <Label htmlFor="portal-note-type" className="text-sm font-medium text-foreground">
          Type
        </Label>
        <select
          id="portal-note-type"
          name="type"
          required
          className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          defaultValue={CustomerPortalSubmissionType.GENERAL_REQUEST}
        >
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="portal-note-subject" className="text-sm font-medium text-foreground">
          Subject <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="portal-note-subject" name="subject" maxLength={120} autoComplete="off" className="rounded-sm" />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label htmlFor="portal-note-message" className="text-sm font-medium text-foreground">
            Message
          </Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {messageLen}/{PORTAL_SUBMISSION_MESSAGE_MAX}
          </span>
        </div>
        <Textarea
          id="portal-note-message"
          name="message"
          required
          rows={5}
          maxLength={PORTAL_SUBMISSION_MESSAGE_MAX}
          className="min-h-[120px] rounded-sm resize-y"
          onChange={(e) => setMessageLen(e.target.value.length)}
          placeholder="Describe your question or availability. The office will review this message."
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          This is not live chat. Please allow time for staff to respond during business hours.
        </p>
      </div>

      {errorText ? (
        <p className="text-sm text-destructive" role="alert">
          {errorText}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="rounded-sm">
        {pending ? "Sending…" : "Send note"}
      </Button>
    </form>
  );
}
