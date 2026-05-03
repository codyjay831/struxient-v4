"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Clock,
  FileText,
  LayoutList,
  Package,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuoteWorkbenchStep = "basics" | "proposal" | "lines" | "execution" | "readiness" | "activity";

const stepMeta: Record<
  QuoteWorkbenchStep,
  { label: string; short: string; icon: typeof Package; description: string }
> = {
  basics: {
    label: "Basics",
    short: "Setup",
    icon: LayoutList,
    description: "Identity, scope intent, location, pipeline",
  },
  proposal: {
    label: "Proposal",
    short: "Customer",
    icon: FileText,
    description: "Customer-facing copy & preview",
  },
  lines: {
    label: "Line items",
    short: "Commercial",
    icon: Package,
    description: "Quoted work & pricing",
  },
  execution: {
    label: "Quote-prep",
    short: "Internal",
    icon: ClipboardList,
    description: "Internal prep before send",
  },
  readiness: {
    label: "Readiness",
    short: "Send",
    icon: ShieldAlert,
    description: "Checklist & send controls",
  },
  activity: {
    label: "Activity",
    short: "Log",
    icon: Clock,
    description: "Workspace audit trail",
  },
};

/** Quote workspace: bounded width, no negative horizontal bleed; theme tokens + dark premium. */
export function QuoteWorkbenchCanvas({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative w-full min-w-0 max-w-full overflow-x-hidden",
        "min-h-[calc(100vh-4rem)] border-y border-border bg-muted/25 text-foreground",
        "dark:border-zinc-900/80 dark:bg-background dark:text-foreground",
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

type CommandBarProps = {
  salesHref: string;
  quoteTitle: string;
  displayNumber: number;
  statusLabel: string;
  customerName: string;
  opportunityTitle: string;
  serviceType: string;
  totalLabel: string;
  readinessHeadline: string;
  readinessTone: "ok" | "warn" | "block";
  nextAction: string;
  isSent: boolean;
  primaryActions: ReactNode;
  sentLifecycle: ReactNode;
  actionErrors: ReactNode;
};

export function QuoteWorkbenchCommandBar({
  salesHref,
  quoteTitle,
  displayNumber,
  statusLabel,
  customerName,
  opportunityTitle,
  serviceType,
  totalLabel,
  readinessHeadline,
  readinessTone,
  nextAction,
  isSent,
  primaryActions,
  sentLifecycle,
  actionErrors,
}: CommandBarProps) {
  const readinessClass =
    readinessTone === "block"
      ? "text-red-600 dark:text-red-400"
      : readinessTone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";
  return (
    <header className="border-b border-border pb-3 dark:border-zinc-800/60 sm:pb-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={salesHref}
              className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:text-primary dark:hover:text-blue-400"
            >
              <ArrowLeft className="size-3" aria-hidden />
              Sales
            </Link>
            <span className="hidden text-muted-foreground/80 sm:inline" aria-hidden>
              ·
            </span>
            <span className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary dark:bg-zinc-900/90 dark:text-blue-400/95">
              #{displayNumber}
            </span>
            <span className="rounded-[4px] border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-zinc-800/90 dark:bg-zinc-950 dark:text-zinc-400">
              {statusLabel}
            </span>
          </div>
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg dark:text-white">
            {quoteTitle}
          </h1>
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="text-foreground/90 dark:text-zinc-300">{customerName}</span>
            <span className="mx-1.5 text-border dark:text-zinc-700">·</span>
            <span>{opportunityTitle}</span>
            <span className="text-muted-foreground dark:text-zinc-600"> · {serviceType}</span>
          </p>
        </div>
        <div className="flex min-w-0 shrink flex-col items-stretch gap-2 sm:flex-row sm:items-end lg:max-w-[min(100%,20rem)] lg:shrink-0 lg:flex-col lg:items-end">
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Quote total</p>
            <p className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl dark:text-white">
              {totalLabel}
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-end gap-1 border-t border-border pt-2 sm:border-t-0 sm:pt-0 dark:border-zinc-800/50 lg:border-t lg:pt-2">
            <p className={cn("text-right text-[11px] font-medium", readinessClass)}>{readinessHeadline}</p>
            <p className="max-w-full text-right text-[10px] leading-relaxed text-muted-foreground sm:max-w-xs dark:text-zinc-500">
              {nextAction}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-zinc-800/40">
        {!isSent ? (
          <div className="flex flex-wrap items-center gap-2">{primaryActions}</div>
        ) : (
          <div className="min-w-0 flex-1">{sentLifecycle}</div>
        )}
        {actionErrors}
      </div>
    </header>
  );
}

type StepRailProps = {
  active: QuoteWorkbenchStep;
  onSelect: (s: QuoteWorkbenchStep) => void;
  counts: Partial<Record<QuoteWorkbenchStep, string | number | null>>;
  flags: Partial<Record<QuoteWorkbenchStep, "attention" | "ok" | "muted">>;
};

export function QuoteWorkbenchStepRail({ active, onSelect, counts, flags }: StepRailProps) {
  const order: QuoteWorkbenchStep[] = ["basics", "proposal", "lines", "execution", "readiness", "activity"];
  return (
    <nav aria-label="Quote workspace sections" className="flex min-w-0 flex-col gap-0.5">
      {order.map((id) => {
        const meta = stepMeta[id];
        const Icon = meta.icon;
        const isActive = active === id;
        const flag = flags[id];
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "group flex w-full min-w-0 items-start gap-2.5 rounded-[5px] px-2.5 py-2 text-left transition",
              isActive
                ? "bg-primary/10 ring-1 ring-inset ring-primary/30 dark:bg-blue-500/[0.08] dark:ring-blue-500/35"
                : "hover:bg-muted/80 dark:hover:bg-zinc-900/60",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[4px] border",
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:group-hover:text-zinc-400",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-xs font-semibold",
                    isActive ? "text-foreground dark:text-white" : "text-muted-foreground dark:text-zinc-400",
                  )}
                >
                  {meta.label}
                </span>
                {count != null && count !== "" ? (
                  <span className="shrink-0 rounded-[3px] bg-muted px-1 font-mono text-[10px] text-muted-foreground dark:bg-zinc-900 dark:text-zinc-500">
                    {count}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground dark:text-zinc-600">
                {meta.description}
              </span>
              {flag === "attention" ? (
                <span className="mt-1 inline-block text-[10px] font-medium text-amber-700 dark:text-amber-400/90">
                  Needs attention
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function QuoteWorkbenchMobileSteps({
  active,
  onSelect,
}: {
  active: QuoteWorkbenchStep;
  onSelect: (s: QuoteWorkbenchStep) => void;
}) {
  const order: QuoteWorkbenchStep[] = ["basics", "proposal", "lines", "execution", "readiness", "activity"];
  return (
    <div className="mb-3 flex min-w-0 max-w-full gap-1 overflow-x-auto overscroll-x-contain pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {order.map((id) => {
        const meta = stepMeta[id];
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "shrink-0 rounded-[5px] border px-2.5 py-1.5 text-[11px] font-medium transition",
              isActive
                ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                : "border-border bg-muted/40 text-muted-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500",
            )}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}

type IntelProps = {
  total: string;
  subtotal: string;
  status: string;
  readinessOk: boolean;
  lineCount: number;
  stageCount: number;
  lineTaskCount: number;
  prepCount: number;
  blockerCount: number;
  nextAction: string;
  onJumpProposal: () => void;
};

export function QuoteWorkbenchIntelligencePanel({
  total,
  subtotal,
  status,
  readinessOk,
  lineCount,
  stageCount,
  lineTaskCount,
  prepCount,
  blockerCount,
  nextAction,
  onJumpProposal,
}: IntelProps) {
  return (
    <div className="sticky top-4 min-w-0 space-y-0 divide-y divide-border rounded-[6px] border border-border bg-card/95 text-card-foreground backdrop-blur-sm dark:divide-zinc-800/50 dark:border-zinc-800/60">
      <div className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Total</p>
        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground dark:text-white">{total}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground dark:text-zinc-600">Sub {subtotal}</p>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 p-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Status</p>
          <p className="mt-0.5 truncate text-xs font-medium text-foreground dark:text-zinc-200">{status}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Send</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-semibold",
              readinessOk ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {readinessOk ? "Clear" : "Blocked"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Lines</p>
          <p className="mt-0.5 font-mono text-sm text-foreground dark:text-zinc-200">{lineCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Stages</p>
          <p className="mt-0.5 font-mono text-sm text-foreground dark:text-zinc-200">{stageCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Line tasks</p>
          <p className="mt-0.5 font-mono text-sm text-foreground dark:text-zinc-200">{lineTaskCount}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Prep tasks</p>
          <p className="mt-0.5 font-mono text-sm text-amber-800 dark:text-amber-400/90">{prepCount}</p>
        </div>
      </div>
      {!readinessOk ? (
        <div className="p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-red-700 dark:text-red-400/80">Blockers</p>
          <p className="mt-0.5 font-mono text-lg text-red-700 dark:text-red-300">{blockerCount}</p>
        </div>
      ) : null}
      <div className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:text-zinc-600">Next</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground dark:text-zinc-400">{nextAction}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onJumpProposal}
          className="mt-2 h-7 px-2 text-[11px] text-primary hover:bg-primary/10 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
        >
          <Sparkles className="mr-1 size-3" aria-hidden />
          Proposal & preview
        </Button>
      </div>
    </div>
  );
}

export function QuoteWorkbenchPanelFrame({
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

export function quoteWorkbenchInputClass() {
  return cn(
    "h-8 rounded-[5px] border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground",
    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
    "dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600",
    "dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/30",
  );
}

export function quoteWorkbenchTextareaClass() {
  return cn(
    "rounded-[5px] border border-input bg-background text-xs text-foreground placeholder:text-muted-foreground",
    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
    "dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:placeholder:text-zinc-600",
    "dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/30",
  );
}

export function quoteWorkbenchSelectClass() {
  return cn(
    "h-8 rounded-[5px] border border-input bg-background px-2 text-xs text-foreground",
    "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40",
    "dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100",
    "dark:focus-visible:border-blue-500/50 dark:focus-visible:ring-blue-500/30",
  );
}
