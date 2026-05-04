import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatus, ScheduledWorkStatus } from "@prisma/client";
import { formatJobStatus, formatJobTaskStatus } from "@/lib/format-enums";
import { formatReadinessShort, readinessBadgeClassName } from "@/lib/schedule-readiness-ui";
import { canViewSchedule } from "@/lib/phase7-permissions";
import { cn } from "@/lib/utils";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceSummaryPanel } from "@/components/workspace/workspace-summary-panel";
import { workspaceFilterShellClass, workspaceListShellClass } from "@/components/workspace/workspace-surface-tokens";
import { Button } from "@/components/ui/button";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  GLOBAL_SCHEDULE_LIST_CAP,
  getReadinessForScheduledListRow,
  groupScheduledRowsByUtcDay,
  listScheduledWorkForOrganization,
  type ScheduledWorkListRow,
} from "@/server/phase7/scheduled-work-queries";
import type { ScheduleReadinessLabel } from "@/server/phase7/scheduled-work-types";

function pickParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function filterHref(partial: { range?: string; status?: string; readiness?: string }) {
  const params = new URLSearchParams();
  if (partial.range && partial.range !== "today") {
    params.set("range", partial.range);
  }
  if (partial.status && partial.status !== "scheduled") {
    params.set("status", partial.status);
  }
  if (partial.readiness && partial.readiness !== "all") {
    params.set("readiness", partial.readiness);
  }
  const q = params.toString();
  return q ? `/app/schedule?${q}` : "/app/schedule";
}

const RANGE_TABS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All" },
];

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "scheduled", label: "Scheduled" },
  { key: "canceled", label: "Canceled" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All statuses" },
];

const READINESS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All readiness" },
  { key: "ready", label: "Ready" },
  { key: "at_risk", label: "At risk" },
  { key: "blocked", label: "Blocked" },
];

function formatUtcDayHeading(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function serviceAddressLine(job: ScheduledWorkListRow["job"]): string | null {
  const qText = job.quote.serviceAddressText?.trim() ?? "";
  if (!job.quote.serviceAddressTbd && qText.length > 0) {
    return qText;
  }
  const opp = job.opportunity;
  if (opp && !opp.serviceAddressTbd) {
    const oText = opp.serviceAddressText?.trim() ?? "";
    if (oText.length > 0) return oText;
  }
  return null;
}

const badgeBase = "rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

function readinessCounts(rows: ScheduledWorkListRow[]) {
  const acc: Partial<Record<ScheduleReadinessLabel, number>> = {};
  for (const row of rows) {
    const label = getReadinessForScheduledListRow(row).label;
    acc[label] = (acc[label] ?? 0) + 1;
  }
  return acc;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgSession();
  if (!canViewSchedule(ctx.role)) {
    notFound();
  }

  const sp = await searchParams;
  const range = pickParam(sp.range) ?? "today";
  const status = pickParam(sp.status) ?? "scheduled";
  const readiness = pickParam(sp.readiness) ?? "all";

  const rows = await listScheduledWorkForOrganization(ctx, { range, status, readiness });
  const grouped = groupScheduledRowsByUtcDay(rows);
  const dayKeys = [...grouped.keys()].sort();
  const counts = readinessCounts(rows);

  const rangeLabel = RANGE_TABS.find((t) => t.key === range)?.label ?? range;
  const statusLabel = STATUS_TABS.find((t) => t.key === status)?.label ?? status;
  const readinessLabel = READINESS_TABS.find((t) => t.key === readiness)?.label ?? readiness;

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          eyebrow="Operations"
          title="Schedule"
          description="Dispatch view of booked job task windows. Readiness reflects current job and task facts only — not crew capacity, permits, materials, or payments."
          actions={
            <Button asChild variant="outline" className="rounded-[5px] font-semibold">
              <Link href="/app/jobs">Jobs</Link>
            </Button>
          }
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_min(100%,320px)] lg:items-start">
          <div className="min-w-0 space-y-6">
            <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
              Day groups use UTC midnight boundaries. For exact local dispatch, confirm times with your crew lead.
            </p>

            <div className={workspaceFilterShellClass()}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">
                Filters
              </p>
              <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist" aria-label="Date range">
                {RANGE_TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={filterHref({ range: t.key, status, readiness })}
                    className={cn(
                      "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      range === t.key
                        ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist" aria-label="Schedule status">
                {STATUS_TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={filterHref({ range, status: t.key, readiness })}
                    className={cn(
                      "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      status === t.key
                        ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5" role="tablist" aria-label="Readiness">
                {READINESS_TABS.map((t) => (
                  <Link
                    key={t.key}
                    href={filterHref({ range, status, readiness: t.key })}
                    className={cn(
                      "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      readiness === t.key
                        ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300",
                    )}
                  >
                    {t.label}
                  </Link>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <WorkspaceEmptyState
                title="No scheduled work for this view"
                description="Schedule job tasks from each job when dates are firm. Try Today or Upcoming, widen status filters, or clear readiness to see more rows."
              >
                <Button asChild variant="secondary" className="rounded-[5px] font-semibold">
                  <Link href="/app/jobs">Open jobs</Link>
                </Button>
              </WorkspaceEmptyState>
            ) : (
              <div className="min-w-0 space-y-8">
                {dayKeys.map((day) => {
                  const dayRows = grouped.get(day) ?? [];
                  return (
                    <section key={day} className="min-w-0 space-y-3">
                      <div className="flex min-w-0 flex-wrap items-end justify-between gap-2 border-b border-border pb-2 dark:border-zinc-800/60">
                        <div className="min-w-0">
                          <h2 className="text-sm font-semibold text-foreground dark:text-zinc-100">
                            {formatUtcDayHeading(day)}
                          </h2>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground tabular-nums dark:text-zinc-600">
                            UTC {day}
                          </p>
                        </div>
                        <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground dark:text-zinc-500">
                          {dayRows.length} window{dayRows.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ul className={workspaceListShellClass()}>
                        {dayRows.map((row) => {
                          const r = getReadinessForScheduledListRow(row);
                          const address = serviceAddressLine(row.job);
                          const statusText = row.status.replace(/_/g, " ");
                          return (
                            <li key={row.id} className="min-w-0 bg-card/10 px-3.5 py-3.5 dark:bg-zinc-950/15 sm:px-4 sm:py-4">
                              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground dark:text-zinc-100">{row.title}</span>
                                    <span
                                      className={cn(
                                        badgeBase,
                                        readinessBadgeClassName(r.label),
                                      )}
                                    >
                                      {formatReadinessShort(r.label)}
                                    </span>
                                    <span
                                      className={cn(
                                        badgeBase,
                                        "border-border font-medium normal-case tracking-normal text-muted-foreground dark:border-zinc-800 dark:text-zinc-500",
                                      )}
                                    >
                                      {statusText}
                                    </span>
                                    <span
                                      className={cn(
                                        badgeBase,
                                        "border-border bg-muted/30 text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
                                      )}
                                    >
                                      Job {formatJobStatus(row.job.status)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground dark:text-zinc-500">
                                    <Link
                                      href={`/app/jobs/${row.jobId}`}
                                      className="font-semibold text-primary hover:underline dark:text-blue-400"
                                    >
                                      Job #{row.job.displayNumber}
                                    </Link>
                                    <span className="text-muted-foreground/80 dark:text-zinc-600"> · </span>
                                    <span className="text-foreground/90 dark:text-zinc-300">{row.job.customer.displayName}</span>
                                    {row.job.title?.trim() ? (
                                      <>
                                        <span className="text-muted-foreground/80 dark:text-zinc-600"> · </span>
                                        <span>{row.job.title.trim()}</span>
                                      </>
                                    ) : null}
                                  </p>
                                  <p className="text-xs font-medium tabular-nums text-foreground/90 dark:text-zinc-300">
                                    {row.scheduledStartAt.toLocaleString()} – {row.scheduledEndAt.toLocaleString()}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground dark:text-zinc-500">
                                    Task: <span className="font-medium text-foreground dark:text-zinc-200">{row.jobTask.title}</span>
                                    <span className="text-muted-foreground/70 dark:text-zinc-600"> · </span>
                                    {formatJobTaskStatus(row.jobTask.status)}
                                  </p>
                                  {address ? (
                                    <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
                                      <span className="font-medium text-foreground/85 dark:text-zinc-400">Location: </span>
                                      {address}
                                    </p>
                                  ) : null}
                                  {row.notes?.trim() ? (
                                    <p className="text-xs leading-relaxed text-foreground/90 dark:text-zinc-300">
                                      <span className="font-medium text-muted-foreground dark:text-zinc-500">Notes: </span>
                                      {row.notes.trim()}
                                    </p>
                                  ) : null}
                                  {row.status === ScheduledWorkStatus.CANCELED && row.cancelReason?.trim() ? (
                                    <p className="text-xs leading-relaxed text-destructive dark:text-red-400">
                                      <span className="font-medium">Cancel reason: </span>
                                      {row.cancelReason.trim()}
                                    </p>
                                  ) : null}
                                  <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
                                    {r.explanation}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                                  <Button
                                    asChild
                                    size="sm"
                                    className="rounded-[5px] font-semibold"
                                    variant={row.job.status === JobStatus.ACTIVE ? "default" : "secondary"}
                                  >
                                    <Link href={`/app/jobs/${row.jobId}`}>Open job</Link>
                                  </Button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <WorkspaceSummaryPanel title="Board">
            <dl className="min-w-0 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground dark:text-zinc-500">Range</dt>
                <dd className="shrink-0 font-medium text-foreground dark:text-zinc-200">{rangeLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground dark:text-zinc-500">Status</dt>
                <dd className="min-w-0 text-right font-medium text-foreground dark:text-zinc-200">{statusLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground dark:text-zinc-500">Readiness</dt>
                <dd className="min-w-0 text-right font-medium text-foreground dark:text-zinc-200">{readinessLabel}</dd>
              </div>
              <div className="border-t border-border pt-2 dark:border-zinc-800/60" />
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground dark:text-zinc-500">Windows</dt>
                <dd className="shrink-0 font-semibold tabular-nums text-foreground dark:text-zinc-100">{rows.length}</dd>
              </div>
              {rows.length >= GLOBAL_SCHEDULE_LIST_CAP ? (
                <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  List capped at {GLOBAL_SCHEDULE_LIST_CAP}. Narrow filters if you need a specific window.
                </p>
              ) : null}
              <div className="border-t border-border pt-2 dark:border-zinc-800/60" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                In this result set
              </p>
              <div className="flex justify-between gap-2">
                <dt className="text-emerald-800/90 dark:text-emerald-200/90">Ready</dt>
                <dd className="shrink-0 font-medium tabular-nums text-foreground dark:text-zinc-200">
                  {counts.SCHEDULED_READY ?? 0}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-amber-900/90 dark:text-amber-200/90">At risk</dt>
                <dd className="shrink-0 font-medium tabular-nums text-foreground dark:text-zinc-200">
                  {counts.SCHEDULED_AT_RISK ?? 0}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-destructive dark:text-red-400">Blocked</dt>
                <dd className="shrink-0 font-medium tabular-nums text-foreground dark:text-zinc-200">
                  {counts.SCHEDULED_BLOCKED ?? 0}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-zinc-600">
              Use filters to focus on what needs attention, then open the job to adjust tasks or schedule from the job
              workspace.
            </p>
          </WorkspaceSummaryPanel>
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
