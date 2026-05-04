import type { CompletionRequirementDto } from "@/server/phase13/completion-requirements";
import { cn } from "@/lib/utils";
import { workPlanBadgeClass } from "./work-plan-classnames";

export type WorkPlanTaskBadgesProps = {
  isRequired: boolean;
  customerVisible: boolean;
  completionRequirement: CompletionRequirementDto;
  /** Job work plan review: task created without a quote-line seed id. */
  showAddedDuringReview?: boolean;
  /** Quote line prep status label (e.g. "NOT READY"), not used on job rows. */
  prepStatusLabel?: string | null;
};

export function WorkPlanTaskBadges(props: WorkPlanTaskBadgesProps) {
  const { isRequired, customerVisible, completionRequirement: req, showAddedDuringReview, prepStatusLabel } = props;
  const reqLabel =
    req.state === "invalid" ? "Invalid requirements" : req.state === "active" ? "Requirements set" : "Missing requirements";

  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={cn(
          workPlanBadgeClass,
          isRequired
            ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200"
            : "border-border/80 bg-muted/30 text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400",
        )}
      >
        {isRequired ? "Required" : "Optional"}
      </span>
      <span
        className={cn(
          workPlanBadgeClass,
          customerVisible
            ? "border-sky-500/40 bg-sky-500/10 text-sky-950 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-200"
            : "border-border/80 bg-muted/30 text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400",
        )}
      >
        {customerVisible ? "Customer-visible" : "Internal"}
      </span>
      <span
        className={cn(
          workPlanBadgeClass,
          req.state === "active"
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:border-emerald-800/45 dark:bg-emerald-950/25 dark:text-emerald-200"
            : req.state === "invalid"
              ? "border-destructive/40 bg-destructive/10 text-destructive dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              : "border-border/80 bg-muted/30 text-muted-foreground dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400",
        )}
      >
        {reqLabel}
      </span>
      {showAddedDuringReview ? (
        <span
          className={cn(
            workPlanBadgeClass,
            "border-violet-500/35 bg-violet-500/10 text-violet-950 dark:border-violet-800/45 dark:bg-violet-950/25 dark:text-violet-200",
          )}
        >
          Added during review
        </span>
      ) : null}
      {prepStatusLabel ? (
        <span
          className={cn(
            workPlanBadgeClass,
            "font-mono normal-case text-muted-foreground dark:text-zinc-400",
          )}
        >
          {prepStatusLabel}
        </span>
      ) : null}
    </div>
  );
}
