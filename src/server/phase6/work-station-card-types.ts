export type WorkStationCardCategory =
  | "NOW"
  | "NEXT"
  | "BLOCKED"
  | "WAITING"
  | "NEEDS_REVIEW"
  | "DONE";

export type WorkStationCardSourceType =
  | "OPPORTUNITY"
  | "OPPORTUNITY_TASK"
  | "QUOTE"
  | "JOB"
  | "JOB_TASK"
  | "CUSTOMER_PORTAL_SUBMISSION"
  | "JOB_EVIDENCE";

export type WorkStationCardPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type WorkStationCard = {
  id: string;
  category: WorkStationCardCategory;
  priority: WorkStationCardPriority;
  sourceType: WorkStationCardSourceType;
  sourceId: string;
  title: string;
  summary?: string;
  reason: string;
  primaryActionLabel: string;
  primaryHref: string;
  secondaryHref?: string;
  customerName?: string;
  quoteDisplayNumber?: number;
  jobDisplayNumber?: number;
  statusLabel?: string;
  blockedReasons?: string[];
  roleHint?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkStationFeedSourceFilter = "all" | "opportunities" | "quotes" | "jobs";

export type WorkStationFeedCategoryFilter =
  | "all"
  | "now"
  | "next"
  | "blocked"
  | "waiting"
  | "needs_review"
  | "done";

export type WorkStationFeedFilters = {
  source: WorkStationFeedSourceFilter;
  category: WorkStationFeedCategoryFilter;
};

export const WORK_STATION_QUERY_CAP = 80;
export const WORK_STATION_MAX_CARDS = 80;

export const CATEGORY_ORDER: Record<WorkStationCardCategory, number> = {
  NOW: 0,
  NEXT: 1,
  BLOCKED: 2,
  WAITING: 3,
  NEEDS_REVIEW: 4,
  DONE: 5,
};

export const PRIORITY_ORDER: Record<WorkStationCardPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};
