"use client";

import { useState } from "react";
import { OpportunityIntakeForm, OpportunityIntakeOpenSummary, type OpportunityIntakeFields } from "./opportunity-intake-form";
import { Button } from "@/components/ui/button";

export function OpportunityIntakeWorkspace(props: {
  opportunity: OpportunityIntakeFields;
  members: { id: string; label: string }[];
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);

  if (props.disabled) {
    return <OpportunityIntakeForm {...props} />;
  }

  if (!editing) {
    return (
      <div className="rounded-[6px] border border-border bg-card/30 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/30">
        <OpportunityIntakeOpenSummary opportunity={props.opportunity} members={props.members} />
        <Button
          type="button"
          size="sm"
          className="mt-4 rounded-[5px] font-semibold"
          onClick={() => setEditing(true)}
        >
          Edit intake
        </Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
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
      <OpportunityIntakeForm key={formKey} {...props} disabled={false} />
    </div>
  );
}
