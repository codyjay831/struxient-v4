import { cn } from "@/lib/utils";

/** Shared shell for `DialogContent` in workspace-style modals (Jobs, schedule rows, etc.). */
export function workspaceDialogContentClass() {
  return cn(
    "min-w-0 border-border bg-background text-foreground sm:rounded-[6px] dark:border-zinc-800/80 dark:bg-zinc-950",
  );
}

export function workspaceInputClass() {
  return cn(
    "h-8 rounded-[5px] border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground",
    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
    "dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600",
    "dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/30",
  );
}

export function workspaceTextareaClass() {
  return cn(
    "rounded-[5px] border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground",
    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
    "dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600",
    "dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/30",
  );
}

export function workspaceSelectClass() {
  return cn(
    "h-8 rounded-[5px] border border-input bg-background px-2 text-xs text-foreground",
    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
    "dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100",
    "dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/30",
  );
}
