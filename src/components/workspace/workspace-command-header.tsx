import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type BackLink = { href: string; label: string };

export function WorkspaceCommandHeader({
  back,
  eyebrow,
  title,
  description,
  badges,
  meta,
  actions,
  className,
}: {
  back?: BackLink;
  eyebrow?: string;
  title: string;
  description?: string;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-border pb-4 dark:border-zinc-800/60 sm:pb-5", className)}>
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          {back ? (
            <Link
              href={back.href}
              className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:text-primary dark:hover:text-blue-400"
            >
              <ArrowLeft className="size-3 shrink-0" aria-hidden />
              {back.label}
            </Link>
          ) : null}
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary dark:text-blue-400/90">{eyebrow}</p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg dark:text-white">
              {title}
            </h1>
            {badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
          </div>
          {description ? (
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground dark:text-zinc-500 sm:text-sm">{description}</p>
          ) : null}
          {meta ? <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
