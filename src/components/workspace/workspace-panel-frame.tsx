import type { ReactNode } from "react";

export function WorkspacePanelFrame({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 min-w-0">
      <div className="mb-5 border-b border-border pb-4 dark:border-zinc-800/50">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary dark:text-blue-400/90">{kicker}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground dark:text-white">{title}</h2>
        {subtitle ? (
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}
