import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkPlanStageShell(props: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[6px] border border-border/80 bg-background/80 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40",
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
