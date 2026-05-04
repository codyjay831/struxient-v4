import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Generic sticky intelligence / summary column (non–quote-specific). */
export function WorkspaceSummaryPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "min-w-0 space-y-3 rounded-[6px] border border-border bg-card/95 p-3 text-card-foreground backdrop-blur-sm",
        "dark:border-zinc-800/60 dark:bg-zinc-950/50",
        "lg:sticky lg:top-4",
        className,
      )}
    >
      {title ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">{title}</p>
      ) : null}
      <div className="min-w-0 space-y-3">{children}</div>
    </aside>
  );
}
