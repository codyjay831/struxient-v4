"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Progressive disclosure for creation flows: value prop + explicit intent before showing the full form.
 * No fake secondary paths — only reveals `children` after the user chooses to continue.
 */
export function ProgressiveCreateShell({
  intentTitle,
  intentDescription,
  continueLabel,
  children,
  className,
}: {
  intentTitle: string;
  intentDescription: string;
  continueLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (open) {
    return <div className={cn("min-w-0", className)}>{children}</div>;
  }
  return (
    <div
      className={cn(
        "rounded-[6px] border border-border bg-card/50 p-5 dark:border-zinc-800/60 dark:bg-zinc-950/35 sm:p-6",
        className,
      )}
    >
      <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{intentTitle}</p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground dark:text-zinc-500 sm:text-sm">
        {intentDescription}
      </p>
      <Button type="button" className="mt-5 rounded-[5px] font-semibold" onClick={() => setOpen(true)}>
        {continueLabel}
      </Button>
    </div>
  );
}
