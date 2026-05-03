import type { ScheduleReadinessLabel } from "@/server/phase7/scheduled-work-types";

export function formatReadinessShort(label: ScheduleReadinessLabel): string {
  switch (label) {
    case "SCHEDULED_READY":
      return "Ready";
    case "SCHEDULED_AT_RISK":
      return "At risk";
    case "SCHEDULED_BLOCKED":
      return "Blocked";
    case "READY_TO_SCHEDULE":
      return "Ready to schedule";
    case "NOT_SCHEDULABLE":
      return "Not schedulable";
    case "COMPLETED":
      return "Complete";
    case "CANCELED":
      return "Canceled";
    default:
      return label;
  }
}

export function readinessBadgeClassName(label: ScheduleReadinessLabel): string {
  switch (label) {
    case "SCHEDULED_READY":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    case "SCHEDULED_AT_RISK":
      return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "SCHEDULED_BLOCKED":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "READY_TO_SCHEDULE":
      return "border-primary/40 bg-primary/10 text-primary";
    case "NOT_SCHEDULABLE":
      return "border-border bg-muted/30 text-muted-foreground";
    case "COMPLETED":
      return "border-border bg-muted/20 text-muted-foreground";
    case "CANCELED":
      return "border-border bg-muted/20 text-muted-foreground";
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}
