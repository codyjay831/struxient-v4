import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MetadataPill({
  children,
  variant = "muted",
  className,
}: {
  children: ReactNode;
  variant?: "muted" | "accent" | "outline";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium tabular-nums",
        variant === "muted" && "border-transparent bg-muted/60 text-muted-foreground dark:bg-zinc-800/60 dark:text-zinc-400",
        variant === "accent" && "border-primary/35 bg-primary/10 text-primary dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-200",
        variant === "outline" && "border-border bg-background/80 text-foreground dark:border-zinc-700 dark:bg-zinc-950/50",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}
