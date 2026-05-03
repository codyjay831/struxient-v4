"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  WorkStationCard,
  WorkStationCardCategory,
  WorkStationFeedCategoryFilter,
  WorkStationFeedSourceFilter,
} from "@/server/phase6/work-station-card-types";

const CATEGORY_TABS: { key: WorkStationFeedCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "now", label: "Now" },
  { key: "next", label: "Next" },
  { key: "blocked", label: "Blocked" },
  { key: "waiting", label: "Waiting" },
  { key: "needs_review", label: "Needs review" },
  { key: "done", label: "Done" },
];

const SOURCE_TABS: { key: WorkStationFeedSourceFilter; label: string }[] = [
  { key: "all", label: "All sources" },
  { key: "opportunities", label: "Opportunities" },
  { key: "quotes", label: "Quotes" },
  { key: "jobs", label: "Jobs" },
];

const FILTER_TO_CATEGORY: Record<Exclude<WorkStationFeedCategoryFilter, "all">, WorkStationCardCategory> = {
  now: "NOW",
  next: "NEXT",
  blocked: "BLOCKED",
  waiting: "WAITING",
  needs_review: "NEEDS_REVIEW",
  done: "DONE",
};

function buildHref(partial: { category?: WorkStationFeedCategoryFilter; source?: WorkStationFeedSourceFilter }) {
  const params = new URLSearchParams();
  const source = partial.source ?? "all";
  const category = partial.category ?? "all";
  if (source !== "all") params.set("source", source);
  if (category !== "all") params.set("category", category);
  const q = params.toString();
  return q ? `/app/work-station?${q}` : "/app/work-station";
}

function sourceBadge(st: WorkStationCard["sourceType"]): string {
  switch (st) {
    case "OPPORTUNITY":
      return "Opportunity";
    case "OPPORTUNITY_TASK":
      return "Opportunity task";
    case "QUOTE":
      return "Quote";
    case "JOB":
      return "Job";
    case "JOB_TASK":
      return "Job task";
    case "CUSTOMER_PORTAL_SUBMISSION":
      return "Customer portal";
    case "JOB_EVIDENCE":
      return "Evidence";
    default:
      return st;
  }
}

function priorityBadge(p: WorkStationCard["priority"]): string {
  return p.replace(/_/g, " ");
}

function tabCount(
  tab: WorkStationFeedCategoryFilter,
  counts: Record<WorkStationCardCategory, number>,
): number {
  if (tab === "all") {
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }
  return counts[FILTER_TO_CATEGORY[tab]];
}

function emptyMessage(
  category: WorkStationFeedCategoryFilter,
  hasCardsElsewhere: boolean,
): string {
  if (!hasCardsElsewhere) {
    return "No work items match your current filters. Try another source or category, or continue in Sales and Jobs as records update.";
  }
  if (category === "blocked") {
    return "No blocked work right now.";
  }
  if (category === "now") {
    return "No ready work for your role in this view.";
  }
  return "No items in this category for the selected filters.";
}

type Props = {
  cards: WorkStationCard[];
  countsByCategory: Record<WorkStationCardCategory, number>;
  activeCategory: WorkStationFeedCategoryFilter;
  activeSource: WorkStationFeedSourceFilter;
  totalCapped: number;
};

export function WorkStationFeedUi(props: Props) {
  const hasCardsElsewhere = props.totalCapped > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-sm border border-border bg-card/30 p-1">
        {SOURCE_TABS.map((t) => (
          <Link
            key={t.key}
            href={buildHref({ source: t.key, category: props.activeCategory })}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              props.activeSource === t.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(FILTER_TO_CATEGORY) as (keyof typeof FILTER_TO_CATEGORY)[]).map((key) => (
          <div
            key={key}
            className="rounded-sm border border-border bg-card/20 px-3 py-2 text-xs text-muted-foreground"
          >
            <span className="font-semibold capitalize text-foreground">{key.replace(/_/g, " ")}</span>
            <span className="ml-2 tabular-nums">{props.countsByCategory[FILTER_TO_CATEGORY[key]]}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-sm border border-border bg-card/30 p-1">
        {CATEGORY_TABS.map((t) => (
          <Link
            key={t.key}
            href={buildHref({ category: t.key, source: props.activeSource })}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              props.activeCategory === t.key
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t.label}
            <span className="ml-1.5 tabular-nums text-muted-foreground">({tabCount(t.key, props.countsByCategory)})</span>
          </Link>
        ))}
      </div>

      {props.cards.length === 0 ? (
        <Card className="rounded-sm border-border bg-card/40">
          <CardHeader className="pb-2">
            <p className="text-sm font-medium text-foreground">No cards to show</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {emptyMessage(props.activeCategory, hasCardsElsewhere)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {props.cards.map((card) => (
            <li key={card.id}>
              <Card className="rounded-sm border-border bg-card/40">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-sm border border-border bg-background/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {sourceBadge(card.sourceType)}
                      </span>
                      {card.statusLabel ? (
                        <span className="rounded-sm border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {card.statusLabel}
                        </span>
                      ) : null}
                      <span className="rounded-sm border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {priorityBadge(card.priority)}
                      </span>
                    </div>
                    <Link
                      href={card.primaryHref}
                      className="shrink-0 rounded-sm border border-primary/50 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25"
                    >
                      {card.primaryActionLabel}
                    </Link>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{card.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{card.reason}</p>
                    {card.blockedReasons && card.blockedReasons.length > 0 ? (
                      <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                        {card.blockedReasons.slice(0, 6).map((br, idx) => (
                          <li key={`${card.id}-br-${idx}`}>{br}</li>
                        ))}
                      </ul>
                    ) : null}
                    {card.roleHint ? (
                      <p className="mt-2 text-xs text-muted-foreground">{card.roleHint}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[card.customerName, card.quoteDisplayNumber != null ? `Quote #${card.quoteDisplayNumber}` : null, card.jobDisplayNumber != null ? `Job #${card.jobDisplayNumber}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
