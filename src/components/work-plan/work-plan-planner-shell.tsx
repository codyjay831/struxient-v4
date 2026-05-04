import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkPlanPlannerShell(props: {
  title: string;
  description: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { title, description, className, children } = props;
  return (
    <div
      className={cn(
        "space-y-6 rounded-[6px] border border-primary/25 bg-primary/[0.03] p-4 dark:border-blue-900/35 dark:bg-blue-950/15",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-primary dark:text-blue-400">{title}</p>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">{description}</div>
      </div>
      {children}
    </div>
  );
}
