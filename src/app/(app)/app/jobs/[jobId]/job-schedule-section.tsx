import Link from "next/link";
import { ScheduledWorkStatus } from "@prisma/client";
import { ScheduledWorkRowActions } from "@/app/(app)/app/jobs/[jobId]/scheduled-work-row-actions";
import { formatReadinessShort, readinessBadgeClassName } from "@/lib/schedule-readiness-ui";
import type { ScheduleReadiness } from "@/server/phase7/scheduled-work-types";
import type { ScheduledWorkListRow } from "@/server/phase7/scheduled-work-queries";

function formatStatus(s: ScheduledWorkStatus): string {
  return s.replace(/_/g, " ");
}

export function JobScheduleSection(props: {
  canMutate: boolean;
  items: { row: ScheduledWorkListRow; readiness: ScheduleReadiness }[];
}) {
  const { canMutate, items } = props;

  return (
    <section className="space-y-4 rounded-sm border border-border bg-card/10 p-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Schedule</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Booked time windows for this job. Readiness reflects current job and task facts — scheduled does not always
          mean ready for field execution.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-sm border border-border/80 bg-background/40 px-4 py-5">
          <p className="text-sm text-foreground">No scheduled work for this job yet.</p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            When dates are firm, office staff can place tasks on the schedule from the execution plan below. Use the
            global{" "}
            <Link href="/app/schedule" className="font-medium text-primary hover:underline">
              Schedule
            </Link>{" "}
            page to review work across jobs.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-sm border border-border">
          {items.map(({ row, readiness }) => (
            <li key={row.id} className="px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{row.title}</span>
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${readinessBadgeClassName(readiness.label)}`}
                    >
                      {formatReadinessShort(readiness.label)}
                    </span>
                    <span className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {formatStatus(row.status)}
                    </span>
                  </div>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {row.scheduledStartAt.toLocaleString()} – {row.scheduledEndAt.toLocaleString()}
                  </p>
                  <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{readiness.explanation}</p>
                  {row.notes ? (
                    <p className="max-w-2xl text-xs leading-relaxed text-foreground/90">
                      <span className="font-medium text-muted-foreground">Notes: </span>
                      {row.notes}
                    </p>
                  ) : null}
                  {row.status === ScheduledWorkStatus.CANCELED && row.cancelReason ? (
                    <p className="max-w-2xl text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/90">Cancel reason: </span>
                      {row.cancelReason}
                    </p>
                  ) : null}
                </div>
              </div>
              {canMutate ? (
                <ScheduledWorkRowActions
                  scheduledWorkId={row.id}
                  status={row.status}
                  scheduledStartAt={row.scheduledStartAt}
                  scheduledEndAt={row.scheduledEndAt}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
