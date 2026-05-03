"use client";

import { useActionState, useId, useState } from "react";

import { submitPortalAppointmentAck } from "@/app/portal/[token]/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PORTAL_APPOINTMENT_NOTE_MAX } from "@/server/phase10/portal-appointment-constants";

type Props = {
  rawToken: string;
  scheduleActionRef: string;
  initialReceived: boolean;
};

export function PortalAppointmentAckForm({ rawToken, scheduleActionRef, initialReceived }: Props) {
  const fieldId = useId();
  const [noteLen, setNoteLen] = useState(0);
  const [state, action, pending] = useActionState(submitPortalAppointmentAck, undefined);

  const success = state?.ok === true;
  const errorText = state && !state.ok ? state.error : null;

  if (initialReceived || success) {
    return (
      <div
        className="mt-3 rounded-sm border border-border bg-background/60 px-3 py-3"
        role="status"
        aria-live="polite"
      >
        <p className="text-xs font-medium text-foreground">Thanks — we received your confirmation.</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          The office will review it. This does not change your scheduled time; for changes, contact us directly.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="portalToken" value={rawToken} />
      <input type="hidden" name="scheduleActionRef" value={scheduleActionRef} />

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label htmlFor={`${fieldId}-note`} className="text-xs font-medium text-foreground">
            Optional note for the office
          </Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {noteLen}/{PORTAL_APPOINTMENT_NOTE_MAX}
          </span>
        </div>
        <Textarea
          id={`${fieldId}-note`}
          name="optionalNote"
          rows={3}
          maxLength={PORTAL_APPOINTMENT_NOTE_MAX}
          className="min-h-[72px] rounded-sm resize-y text-sm"
          placeholder="Gate codes, parking, or other details—optional."
          onChange={(e) => setNoteLen(e.target.value.length)}
        />
      </div>

      {errorText ? (
        <p className="text-xs text-destructive" role="alert">
          {errorText}
        </p>
      ) : null}

      <Button type="submit" size="sm" variant="secondary" className="rounded-sm" disabled={pending}>
        {pending ? "Sending…" : "Acknowledge appointment"}
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        This lets the office know you saw the appointment time. It does not reschedule or cancel work.
      </p>
    </form>
  );
}
