"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspacePanelFrame } from "@/components/workspace/workspace-panel-frame";
import { WorkspaceSummaryPanel } from "@/components/workspace/workspace-summary-panel";
import { workspaceFilterShellClass, workspaceListShellClass } from "@/components/workspace/workspace-surface-tokens";
import { Button } from "@/components/ui/button";
import {
  WORK_STATION_MAX_CARDS,
  type WorkStationCard,
  type WorkStationCardCategory,
  type WorkStationFeedCategoryFilter,
  type WorkStationFeedSourceFilter,
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

function categoryLabel(c: WorkStationCardCategory): string {
  return c.replace(/_/g, " ");
}

function priorityAccentClass(p: WorkStationCard["priority"]): string {
  switch (p) {
    case "CRITICAL":
      return "border-l-[3px] border-l-destructive";
    case "HIGH":
      return "border-l-[3px] border-l-amber-500 dark:border-l-amber-500/80";
    case "NORMAL":
      return "border-l-[3px] border-l-primary/55 dark:border-l-blue-500/60";
    case "LOW":
    default:
      return "border-l-[3px] border-l-border dark:border-l-zinc-700";
  }
}

function priorityPillClass(p: WorkStationCard["priority"]): string {
  switch (p) {
    case "CRITICAL":
      return "border-destructive/45 bg-destructive/10 text-destructive dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300";
    case "HIGH":
      return "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100";
    case "NORMAL":
      return "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200";
    case "LOW":
    default:
      return "border-border bg-muted/25 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500";
  }
}

const badgeBase =
  "rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

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
  const sourceLabel = SOURCE_TABS.find((t) => t.key === props.activeSource)?.label ?? props.activeSource;
  const categoryLabelActive = CATEGORY_TABS.find((t) => t.key === props.activeCategory)?.label ?? props.activeCategory;
  const atCap = props.totalCapped >= WORK_STATION_MAX_CARDS;
  const categoryFiltered = props.activeCategory !== "all" && props.totalCapped > props.cards.length;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_min(100%,300px)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <div className={workspaceFilterShellClass()}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">
            Source
          </p>
          <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist" aria-label="Work sources">
            {SOURCE_TABS.map((t) => (
              <Link
                key={t.key}
                href={buildHref({ source: t.key, category: props.activeCategory })}
                className={cn(
                  "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  props.activeSource === t.key
                    ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        <div className={workspaceFilterShellClass()}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">
            Category
          </p>
          <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist" aria-label="Work categories">
            {CATEGORY_TABS.map((t) => (
              <Link
                key={t.key}
                href={buildHref({ category: t.key, source: props.activeSource })}
                className={cn(
                  "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  props.activeCategory === t.key
                    ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300",
                )}
              >
                {t.label}
                <span className="ml-1 tabular-nums text-muted-foreground/90 dark:text-zinc-500">
                  ({tabCount(t.key, props.countsByCategory)})
                </span>
              </Link>
            ))}
          </div>
        </div>

        {props.cards.length === 0 ? (
          <WorkspaceEmptyState
            title="Nothing in this queue"
            description={emptyMessage(props.activeCategory, hasCardsElsewhere)}
          >
            <Button asChild variant="secondary" className="rounded-[5px] font-semibold">
              <Link href="/app/sales/opportunities">Sales pipeline</Link>
            </Button>
          </WorkspaceEmptyState>
        ) : (
          <WorkspacePanelFrame
            kicker="Queue"
            title="Decision queue"
            subtitle="Order follows existing Struxient rules: category, then priority, then most recently updated. The first row is the same top item you would have seen before this layout pass."
          >
            <ul className={workspaceListShellClass()}>
              {props.cards.map((card, index) => (
                <li
                  key={card.id}
                  className={cn(
                    "min-w-0 bg-card/10 px-3.5 py-3.5 dark:bg-zinc-950/15 sm:px-4 sm:py-4",
                    priorityAccentClass(card.priority),
                    index === 0
                      ? "bg-primary/[0.04] ring-1 ring-primary/20 dark:bg-blue-500/[0.06] dark:ring-blue-500/20"
                      : null,
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      {index === 0 ? (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary dark:text-blue-300">
                          Next up — first in sorted queue
                        </p>
                      ) : null}
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            badgeBase,
                            "border-border bg-muted/30 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500",
                          )}
                        >
                          {sourceBadge(card.sourceType)}
                        </span>
                        <span
                          className={cn(
                            badgeBase,
                            "border-border font-medium normal-case tracking-normal text-foreground dark:border-zinc-800 dark:text-zinc-300",
                          )}
                        >
                          {categoryLabel(card.category)}
                        </span>
                        <span className={cn(badgeBase, priorityPillClass(card.priority))}>{priorityBadge(card.priority)}</span>
                        {card.statusLabel ? (
                          <span
                            className={cn(
                              badgeBase,
                              "border-border font-medium normal-case tracking-normal text-muted-foreground dark:border-zinc-800 dark:text-zinc-500",
                            )}
                          >
                            {card.statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-foreground dark:text-zinc-100">{card.title}</p>
                        {card.summary?.trim() ? (
                          <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">{card.summary.trim()}</p>
                        ) : null}
                        <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">{card.reason}</p>
                      </div>
                      {card.blockedReasons && card.blockedReasons.length > 0 ? (
                        <ul className="list-inside list-disc text-xs text-muted-foreground dark:text-zinc-500">
                          {card.blockedReasons.slice(0, 6).map((br, idx) => (
                            <li key={`${card.id}-br-${idx}`}>{br}</li>
                          ))}
                        </ul>
                      ) : null}
                      {card.roleHint ? (
                        <p className="text-[11px] text-muted-foreground dark:text-zinc-600">{card.roleHint}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground dark:text-zinc-500">
                        {[card.customerName, card.quoteDisplayNumber != null ? `Quote #${card.quoteDisplayNumber}` : null, card.jobDisplayNumber != null ? `Job #${card.jobDisplayNumber}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {(card.updatedAt ?? card.createdAt) ? (
                        <p className="text-[10px] tabular-nums text-muted-foreground dark:text-zinc-600">
                          {card.updatedAt
                            ? `Updated ${new Date(card.updatedAt).toLocaleString()}`
                            : card.createdAt
                              ? `Created ${new Date(card.createdAt).toLocaleString()}`
                              : null}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      <Button asChild size="sm" className="rounded-[5px] font-semibold">
                        <Link href={card.primaryHref}>{card.primaryActionLabel}</Link>
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </WorkspacePanelFrame>
        )}
      </div>

      <WorkspaceSummaryPanel title="Board">
        <dl className="min-w-0 space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground dark:text-zinc-500">Source</dt>
            <dd className="min-w-0 text-right font-medium text-foreground dark:text-zinc-200">{sourceLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground dark:text-zinc-500">Category</dt>
            <dd className="min-w-0 text-right font-medium text-foreground dark:text-zinc-200">{categoryLabelActive}</dd>
          </div>
          <div className="border-t border-border pt-2 dark:border-zinc-800/60" />
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground dark:text-zinc-500">Rows shown</dt>
            <dd className="shrink-0 font-semibold tabular-nums text-foreground dark:text-zinc-100">{props.cards.length}</dd>
          </div>
          {categoryFiltered ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-500">
              {props.totalCapped} item{props.totalCapped === 1 ? "" : "s"} match this source after the global cap; the category tab hides
              some of them. Switch to &quot;All&quot; to see the full capped set for this source.
            </p>
          ) : null}
          {props.cards.length === 0 && hasCardsElsewhere && props.activeCategory !== "all" ? (
            <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              This category is empty, but other items exist for the selected source. Try the &quot;All&quot; category tab.
            </p>
          ) : null}
          {atCap ? (
            <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              Queue capped at {WORK_STATION_MAX_CARDS} cards (existing limit). Narrow source filters if something feels missing.
            </p>
          ) : null}
        </dl>
        <div className="border-t border-border pt-2 dark:border-zinc-800/60" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
          Mix for this source (capped set)
        </p>
        <dl className="min-w-0 space-y-1.5 text-[11px]">
          {(Object.keys(FILTER_TO_CATEGORY) as (keyof typeof FILTER_TO_CATEGORY)[]).map((key) => (
            <div key={key} className="flex justify-between gap-2 tabular-nums">
              <dt className="capitalize text-muted-foreground dark:text-zinc-500">{key.replace(/_/g, " ")}</dt>
              <dd className="font-medium text-foreground dark:text-zinc-300">
                {props.countsByCategory[FILTER_TO_CATEGORY[key]]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-600">
          About 30 minutes? Start at the first row in the queue, then work down — same ordering the feed has always used.
        </p>
      </WorkspaceSummaryPanel>
    </div>
  );
}
