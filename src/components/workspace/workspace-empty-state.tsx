import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceEmptyState({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[6px] border border-dashed border-border bg-card/40 px-5 py-10 text-center dark:border-zinc-800/70 dark:bg-zinc-950/30 sm:px-8",
        className,
      )}
    >
      <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground dark:text-zinc-500 sm:text-sm">
        {description}
      </p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
