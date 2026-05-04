import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkPlanTaskCardShell(props: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-[6px] border border-border/70 bg-card/30 p-3 dark:border-zinc-800/50 dark:bg-zinc-950/25",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
