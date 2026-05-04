import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatus } from "@prisma/client";
import { canViewJobsWorkspace } from "@/lib/phase4-permissions";
import { formatJobStatus } from "@/lib/format-enums";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listJobsForOrganization, parseJobListStatusParam, type JobListStatusFilter } from "@/server/phase4/job-queries";
import { getJobProgressMapForJobs } from "@/server/phase5/job-progress";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { workspaceListShellClass } from "@/components/workspace/workspace-surface-tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FILTER_TABS: { label: string; value: JobListStatusFilter; param: string | null }[] = [
  { label: "All", value: "ALL", param: null },
  { label: "Active", value: JobStatus.ACTIVE, param: "active" },
  { label: "Paused", value: JobStatus.PAUSED, param: "paused" },
  { label: "Completed", value: JobStatus.COMPLETED, param: "completed" },
  { label: "Canceled", value: JobStatus.CANCELED, param: "canceled" },
];

export default async function JobsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireOrgSession();
  if (!canViewJobsWorkspace(ctx.role)) {
    notFound();
  }

  const sp = await searchParams;
  const filter = parseJobListStatusParam(sp.status);
  const jobs = await listJobsForOrganization(ctx.organizationId, { status: filter });
  const progressMap = await getJobProgressMapForJobs(
    ctx.organizationId,
    jobs.map((j) => j.id),
  );

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          eyebrow="Execution"
          title="Jobs"
          description="Operational work created from accepted quotes. Execution structure was fixed at activation; task and job status here do not change quote records."
          actions={
            <Button asChild variant="outline" className="rounded-[5px] font-semibold">
              <Link href="/app/sales/opportunities">Sales pipeline</Link>
            </Button>
          }
        />

        <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border pb-3 dark:border-zinc-800/60">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-600">
            Status
          </span>
          {FILTER_TABS.map((tab) => {
            const href = tab.param ? `/app/jobs?status=${tab.param}` : "/app/jobs";
            const active = filter === tab.value;
            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground dark:border-zinc-800/80 dark:bg-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {jobs.length === 0 ? (
          <WorkspaceEmptyState
            title={filter === "ALL" ? "No jobs yet" : "No jobs match this filter"}
            description={
              filter === "ALL"
                ? "Jobs are created when an accepted quote is activated from the quote workspace."
                : "Try another status, or clear the filter to see all jobs in your organization."
            }
          >
            <Button asChild variant="secondary" className="rounded-[5px] font-semibold">
              <Link href="/app/sales/opportunities">Go to sales</Link>
            </Button>
          </WorkspaceEmptyState>
        ) : (
          <ul className={workspaceListShellClass()}>
            {jobs.map((j) => {
              const p = progressMap.get(j.id)!;
              const blocked = p.byStatus.BLOCKED;
              const needsAttention =
                j.status === JobStatus.ACTIVE && (blocked > 0 || p.requiredComplete < p.requiredTotal);
              return (
                <li
                  key={j.id}
                  className="min-w-0 p-3.5 transition-colors hover:bg-muted/25 dark:hover:bg-zinc-900/40 sm:p-4"
                >
                  <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Link
                          href={`/app/jobs/${j.id}`}
                          className="truncate text-sm font-semibold text-primary hover:underline dark:text-blue-400"
                        >
                          Job #{j.displayNumber}
                        </Link>
                        <span className="rounded-[4px] border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
                          {formatJobStatus(j.status)}
                        </span>
                        {needsAttention ? (
                          <span className="rounded-[4px] border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200/90">
                            Needs attention
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground dark:text-zinc-400">{j.title}</p>
                      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground dark:text-zinc-500">
                        <Link
                          href={`/app/customers/${j.customer.id}`}
                          className="font-medium text-foreground/90 hover:underline dark:text-zinc-300"
                        >
                          {j.customer.displayName}
                        </Link>
                        <span className="text-border dark:text-zinc-700" aria-hidden>
                          ·
                        </span>
                        <Link
                          href={`/app/sales/quotes/${j.quote.id}`}
                          className="tabular-nums text-primary hover:underline dark:text-blue-400"
                        >
                          Quote #{j.quote.displayNumber}
                        </Link>
                        {j.opportunityId ? (
                          <>
                            <span className="text-border dark:text-zinc-700" aria-hidden>
                              ·
                            </span>
                            <Link
                              href={`/app/sales/opportunities/${j.opportunityId}`}
                              className="text-primary hover:underline dark:text-blue-400"
                            >
                              Opportunity
                            </Link>
                          </>
                        ) : null}
                      </div>
                      <p className="text-[11px] tabular-nums text-muted-foreground dark:text-zinc-600">
                        Required {p.requiredComplete}/{p.requiredTotal} complete · {p.totalTasks} task{p.totalTasks === 1 ? "" : "s"}
                        {blocked > 0 ? (
                          <span className="text-amber-800 dark:text-amber-400/90"> · {blocked} blocked</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 text-left text-[11px] tabular-nums text-muted-foreground lg:text-right dark:text-zinc-500">
                      <time>
                        Updated {j.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </time>
                      <Link
                        href={`/app/jobs/${j.id}`}
                        className="font-semibold text-primary hover:underline dark:text-blue-400 lg:ml-auto"
                      >
                        Open job →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppWorkspaceCanvas>
  );
}
