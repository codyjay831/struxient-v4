import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bounded full-width workspace surface (quote workspace baseline).
 * min-w-0 + overflow-x-hidden prevents page-level horizontal bleed.
 */
export function AppWorkspaceCanvas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full min-w-0 max-w-full overflow-x-hidden",
        "min-h-[calc(100vh-4rem)] border-y border-border bg-muted/25 text-foreground",
        "dark:border-zinc-900/80 dark:bg-background dark:text-foreground",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.05),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto min-w-0 max-w-[min(1720px,100%)] px-3 pb-16 pt-3 sm:px-5 sm:pt-4 lg:px-8">
        {children}
      </div>
    </div>
  );
}
