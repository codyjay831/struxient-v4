import Link from "next/link";
import { notFound } from "next/navigation";
import { formatReadinessShort, readinessBadgeClassName } from "@/lib/schedule-readiness-ui";
import { canViewSchedule } from "@/lib/phase7-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  getReadinessForScheduledListRow,
  groupScheduledRowsByUtcDay,
  listScheduledWorkForOrganization,
} from "@/server/phase7/scheduled-work-queries";

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Schedule</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Scheduled job work with readiness labels based on current job and task facts. This view does not check crew
          capacity, permits, materials, or payments — only information already on the job and quote record.
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground/90">
          Day groups use UTC midnight boundaries. For exact local dispatch, confirm times with your crew lead.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Date range">
          {RANGE_TABS.map((t) => (
            <Link
              key={t.key}
              href={filterHref({ range: t.key, status, readiness })}
              className={`rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                range === t.key
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Schedule status">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={filterHref({ range, status: t.key, readiness })}
              className={`rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                status === t.key
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Readiness">
          {READINESS_TABS.map((t) => (
            <Link
              key={t.key}
              href={filterHref({ range, status, readiness: t.key })}
              className={`rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                readiness === t.key
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-sm border border-border bg-card/10 px-5 py-8">
          <p className="text-sm font-medium text-foreground">No scheduled work for this range.</p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Schedule job tasks from the job workspace when dates are firm. Use Today or Upcoming to see the next
            windows, or widen filters if you expect older or canceled rows.
          </p>
          <p className="mt-4 text-xs">
            <Link href="/app/jobs" className="font-medium text-primary hover:underline">
              Open jobs
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dayKeys.map((day) => {
            const dayRows = grouped.get(day) ?? [];
            return (
              <section key={day} className="space-y-3">
                <h2 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
                  {day}
                </h2>
                <ul className="divide-y divide-border rounded-sm border border-border">
                  {dayRows.map((row) => {
                    const r = getReadinessForScheduledListRow(row);
                    return (
                      <li key={row.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{row.title}</span>
                              <span
                                className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${readinessBadgeClassName(r.label)}`}
                              >
                                {formatReadinessShort(r.label)}
                              </span>
                              <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {row.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Job #{row.job.displayNumber} · {row.job.customer.displayName}
                            </p>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {row.scheduledStartAt.toLocaleString()} – {row.scheduledEndAt.toLocaleString()}
                            </p>
                            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{r.explanation}</p>
                          </div>
                          <Link
                            href={`/app/jobs/${row.jobId}`}
                            className="shrink-0 rounded-sm border border-border bg-card/30 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-muted/50"
                          >
                            Job detail
                          </Link>
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
  );
}
