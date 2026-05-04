import type {
  WorkPlanReviewChecklistItem,
  WorkPlanReviewSummary,
} from "@/server/phase4/work-plan-review-summary";
import { cn } from "@/lib/utils";

function tierLabel(tier: WorkPlanReviewChecklistItem["tier"]): string {
  switch (tier) {
    case "required":
      return "Required to activate";
    case "recommended":
      return "Recommended before activation";
    case "optional":
      return "Optional";
    default:
      return tier;
  }
}

function Stat(props: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-[6px] border border-border/70 bg-background/60 px-3 py-2 dark:border-zinc-800/50 dark:bg-zinc-950/40">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-500">
        {props.label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground dark:text-zinc-100">{props.value}</p>
      {props.sub ? <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-zinc-500">{props.sub}</p> : null}
    </div>
  );
}

export function WorkPlanReviewPanels(props: { summary: WorkPlanReviewSummary }) {
  const { summary } = props;

  return (
    <div className="space-y-4">
      <div className="rounded-[6px] border border-border/80 bg-muted/10 px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-950/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground dark:text-zinc-100">Plan summary</p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">
              Quick counts for this job&apos;s active work plan. Archived tasks stay in the database but are hidden here
              and left out of activation baseline.
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "text-xs font-semibold",
                summary.readyToActivate
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-amber-800 dark:text-amber-400",
              )}
            >
              {summary.readyToActivate ? "Ready to activate" : "Not ready — fix required items"}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-zinc-500">
              Job last updated{" "}
              {new Date(summary.jobUpdatedAtIso).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Stat label="Active tasks" value={summary.activeTaskCount} />
          <Stat label="Required" value={summary.requiredTaskCount} />
          <Stat label="Optional" value={summary.optionalTaskCount} />
          <Stat label="Customer-visible" value={summary.customerVisibleTaskCount} sub="Milestones for portal" />
          <Stat label="Stages" value={summary.stageCount} />
          <Stat label="Added in review" value={summary.manuallyAddedTaskCount} sub="Not from quote seed" />
          <Stat label="Archived" value={summary.archivedTaskCount} sub="Hidden from active plan" />
          <Stat
            label="Req. without rules"
            value={summary.tasksMissingCompletionRequirementsCount}
            sub="Evidence not set"
          />
        </div>

        {summary.tasksWithoutAssignedRoleCount > 0 ? (
          <p className="mt-3 text-[11px] text-muted-foreground dark:text-zinc-500">
            {summary.tasksWithoutAssignedRoleCount} task{summary.tasksWithoutAssignedRoleCount === 1 ? "" : "s"}{" "}
            {summary.tasksWithoutAssignedRoleCount === 1 ? "has" : "have"} no assigned role — fine for activation; fill
            in when you know the crew.
          </p>
        ) : null}
      </div>

      {summary.hardBlockers.length > 0 ? (
        <div
          className="rounded-[6px] border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm dark:border-red-900/40 dark:bg-red-950/25"
          role="alert"
        >
          <p className="font-medium text-destructive dark:text-red-400">Activation blockers</p>
          <ul className="mt-2 list-inside list-disc text-xs text-destructive/95 dark:text-red-300/95">
            {summary.hardBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground dark:text-zinc-400">
            The server still validates on Activate. Fix the items above, then try again.
          </p>
        </div>
      ) : null}

      {summary.recommendations.length > 0 ? (
        <div className="rounded-[6px] border border-border/80 bg-background/50 px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-950/35">
          <p className="text-sm font-semibold text-foreground dark:text-zinc-100">Suggestions</p>
          <p className="mt-1 text-[11px] text-muted-foreground dark:text-zinc-500">
            Recommended, not required — activation can still run if only these apply.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground dark:text-zinc-400">
            {summary.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-[6px] border border-border/80 bg-background/50 px-4 py-3 dark:border-zinc-800/60 dark:bg-zinc-950/35">
        <p className="text-sm font-semibold text-foreground dark:text-zinc-100">Activation readiness</p>
        <p className="mt-1 text-[11px] text-muted-foreground dark:text-zinc-500">
          Scheduling stays off during review. Nothing here replaces the Activate button — it only explains risk.
        </p>
        <ul className="mt-3 space-y-2">
          {summary.checklist.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex gap-2 rounded-[5px] border px-2.5 py-2 text-xs",
                item.tier === "required" && "border-amber-500/30 bg-amber-500/5 dark:border-amber-900/30 dark:bg-amber-950/20",
                item.tier === "recommended" && "border-border/80 bg-muted/10 dark:border-zinc-800/50 dark:bg-zinc-950/25",
                item.tier === "optional" && "border-border/60 bg-transparent dark:border-zinc-800/40",
              )}
            >
              <span className="mt-0.5 shrink-0 font-mono text-[11px]" aria-hidden>
                {item.ok ? "✓" : "○"}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-500">
                  {tierLabel(item.tier)}
                </p>
                <p className={cn("font-medium", item.ok ? "text-foreground dark:text-zinc-200" : "text-foreground dark:text-zinc-100")}>
                  {item.label}
                </p>
                {item.hint ? (
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground dark:text-zinc-500">{item.hint}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
