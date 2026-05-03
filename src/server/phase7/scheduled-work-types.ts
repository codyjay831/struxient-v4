export type ScheduleReadinessLabel =
  | "READY_TO_SCHEDULE"
  | "SCHEDULED_READY"
  | "SCHEDULED_AT_RISK"
  | "SCHEDULED_BLOCKED"
  | "NOT_SCHEDULABLE"
  | "COMPLETED"
  | "CANCELED";

export type ScheduleReadiness = {
  label: ScheduleReadinessLabel;
  explanation: string;
};

export type GlobalScheduleRangeFilter = "today" | "upcoming" | "all";

export type GlobalScheduleStatusFilter = "scheduled" | "canceled" | "completed" | "all";

export type GlobalScheduleReadinessFilter = "all" | "ready" | "at_risk" | "blocked";
