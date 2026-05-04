import { cn } from "@/lib/utils";

/**
 * Filter / control cluster shell (source tabs, category tabs, etc.) — matches Schedule / Work Station.
 */
export function workspaceFilterShellClass() {
  return cn(
    "space-y-3 rounded-[6px] border border-border/80 bg-card/20 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/25 sm:p-4",
  );
}

/**
 * Bordered operational list container (jobs list, schedule rows, Work Station queue).
 */
export function workspaceListShellClass() {
  return cn(
    "min-w-0 divide-y divide-border overflow-hidden rounded-[6px] border border-border dark:divide-zinc-800/60 dark:border-zinc-800/60",
  );
}

/** Dashed empty / placeholder well inside dialogs or panels. */
export function workspaceDashedEmptyWellClass() {
  return cn(
    "rounded-[6px] border border-dashed border-border bg-muted/40 px-4 py-8 dark:border-zinc-800/70 dark:bg-zinc-950/30",
  );
}
