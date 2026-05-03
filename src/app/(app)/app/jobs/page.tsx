import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatus } from "@prisma/client";
import { canViewJobsWorkspace } from "@/lib/phase4-permissions";
import { formatJobStatus } from "@/lib/format-enums";
import { requireOrgSession } from "@/server/phase1/org-session";
import { listJobsForOrganization, parseJobListStatusParam, type JobListStatusFilter } from "@/server/phase4/job-queries";
import { getJobProgressMapForJobs } from "@/server/phase5/job-progress";
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
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Jobs</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Operational work created from accepted quotes. Execution structure was fixed at activation; task and job
          status here do not change quote records.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {FILTER_TABS.map((tab) => {
          const href = tab.param ? `/app/jobs?status=${tab.param}` : "/app/jobs";
          const active = filter === tab.value;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-background/60 text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-sm border border-border bg-card/20 p-8">
          <p className="text-sm font-medium text-foreground">
            {filter === "ALL" ? "No jobs yet." : "No jobs match this filter."}
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {filter === "ALL"
              ? "Jobs are created when an accepted quote is activated from the quote workspace."
              : "Try another status, or clear the filter to see all jobs in your organization."}
          </p>
          <Link
            href="/app/sales/opportunities"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Go to sales
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                <th className="px-4 py-3 font-medium text-foreground">Job</th>
                <th className="px-4 py-3 font-medium text-foreground">Customer</th>
                <th className="px-4 py-3 font-medium text-foreground">Quote</th>
                <th className="px-4 py-3 font-medium text-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-foreground">Required</th>
                <th className="px-4 py-3 font-medium text-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const p = progressMap.get(j.id)!;
                return (
                  <tr key={j.id} className="border-b border-border/80 last:border-0 hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <Link href={`/app/jobs/${j.id}`} className="font-medium text-primary hover:underline">
                        Job #{j.displayNumber}
                      </Link>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{j.title}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{j.customer.displayName}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/sales/quotes/${j.quote.id}`}
                        className="text-primary hover:underline tabular-nums"
                      >
                        Quote #{j.quote.displayNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatJobStatus(j.status)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {p.requiredComplete}/{p.requiredTotal} · {p.totalTasks} tasks
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {j.updatedAt.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
