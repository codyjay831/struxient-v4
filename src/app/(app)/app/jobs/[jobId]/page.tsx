import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CustomerPortalSubmissionType,
  JobStatus,
  JobTaskStatus,
  MembershipRole,
  QuoteStatus,
  ScheduledWorkStatus,
} from "@prisma/client";
import { StaffPortalLinkPanel } from "@/components/customer-portal/staff-portal-link-panel";
import { canCreateCustomerPortalLink, canRevokeOrRegenerateCustomerPortalLink } from "@/lib/phase8-permissions";
import { JobScheduleSection } from "@/app/(app)/app/jobs/[jobId]/job-schedule-section";
import { JobLifecycleToolbar } from "@/app/(app)/app/jobs/[jobId]/job-lifecycle-toolbar";
import { JobTaskStatusForm, type JobTaskRowModel } from "@/app/(app)/app/jobs/[jobId]/job-task-status-form";
import { TaskScheduleDialog } from "@/app/(app)/app/jobs/[jobId]/task-schedule-dialog";
import { canUpdateJobTaskStatus, canViewJobsWorkspace } from "@/lib/phase4-permissions";
import { canMutateSchedule, canViewSchedule } from "@/lib/phase7-permissions";
import { formatJobStatus, formatJobTaskStatus } from "@/lib/format-enums";
import { canChangeJobStatus, canUpdateJobTaskWhenJobPaused } from "@/lib/phase5-permissions";
import { requireOrgSession } from "@/server/phase1/org-session";
import {
  getJobIdInOrganization,
  getJobWorkspace,
  listJobActivityForJob,
  type JobWorkspacePayload,
} from "@/server/phase4/job-queries";
import { getJobProgressForJob } from "@/server/phase5/job-progress";
import {
  canAttachNewScheduleToJob,
  getReadinessForScheduledListRow,
  listScheduledWorkForJob,
} from "@/server/phase7/scheduled-work-queries";
import { isTaskSchedulable } from "@/server/phase7/schedule-readiness";
import { parseSentSnapshotPreviewDto } from "@/server/phase2/customer-preview";
import { syncActivePortalTokenJobIdForQuote } from "@/server/phase8/portal-token-mutations";
import { findActivePortalTokenForQuote } from "@/server/phase8/portal-token-queries";
import { canManageCustomerPortalSubmissions, canViewCustomerPortalSubmissions } from "@/lib/phase9-permissions";
import {
  countNewCustomerPortalSubmissionsForJob,
  listCustomerPortalSubmissionsForJob,
} from "@/server/phase9/customer-portal-submission-queries";
import { StaffCustomerPortalSubmissionsPanel } from "@/components/customer-portal/staff-customer-portal-submissions-panel";
import { JobEvidenceSection } from "@/components/job-evidence/job-evidence-section";
import type { JobEvidenceRowDto } from "@/components/job-evidence/job-evidence-types-ui";
import { canManageJobEvidence, canViewJobEvidence } from "@/lib/phase12-permissions";
import {
  canCompleteJobTaskWithEvidenceOverride,
  canManageJobTaskCompletionRequirements,
} from "@/lib/phase13-permissions";
import { formatScheduleWindowDisplay } from "@/lib/format-schedule-window";
import {
  getEvidenceCountsByJobTask,
  listJobEvidenceForJob,
  listPromotionBucketsForAttachmentsOnJob,
} from "@/server/phase12/job-evidence-queries";
import { parseJobTaskCompletionRequirements, toCompletionRequirementDto } from "@/server/phase13/completion-requirements";
import {
  acceptedEvidenceCountForTaskFromMaps,
  loadAcceptedEvidenceCountMapsForJob,
} from "@/server/phase13/evidence-requirement-evaluation";
import { MetadataPill } from "@/components/customers/customer-area";
import { AppWorkspaceCanvas } from "@/components/workspace/app-workspace-canvas";
import { WorkspaceCommandHeader } from "@/components/workspace/workspace-command-header";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspacePanelFrame } from "@/components/workspace/workspace-panel-frame";
import { WorkspaceSummaryPanel } from "@/components/workspace/workspace-summary-panel";
import { Button } from "@/components/ui/button";

const TASK_STATUS_ORDER: JobTaskStatus[] = [
  JobTaskStatus.NOT_STARTED,
  JobTaskStatus.READY,
  JobTaskStatus.IN_PROGRESS,
  JobTaskStatus.BLOCKED,
  JobTaskStatus.COMPLETE,
];

function taskReadOnlyHint(role: Parameters<typeof canUpdateJobTaskStatus>[0], jobStatus: JobStatus): string | null {
  if (!canUpdateJobTaskStatus(role)) {
    return "Read-only for your role.";
  }
  if (jobStatus === JobStatus.COMPLETED || jobStatus === JobStatus.CANCELED) {
    return "This job is closed; tasks cannot be edited.";
  }
  if (jobStatus === JobStatus.PAUSED && !canUpdateJobTaskWhenJobPaused(role)) {
    return "This job is paused. Field updates resume when office staff resumes the job.";
  }
  return null;
}

type JobWorkspaceTask = JobWorkspacePayload["lines"][number]["stages"][number]["tasks"][number];

function toJobTaskRowModel(
  task: JobWorkspaceTask,
  role: MembershipRole,
  evidenceView: boolean,
  evidenceCountByTask: Map<string, number>,
  acceptedMaps: Awaited<ReturnType<typeof loadAcceptedEvidenceCountMapsForJob>>,
): JobTaskRowModel {
  const dto = toCompletionRequirementDto(parseJobTaskCompletionRequirements(task.completionRequirementsJson));
  const accepted =
    dto.state === "active"
      ? acceptedEvidenceCountForTaskFromMaps(task.id, dto.allowJobLevelEvidence, acceptedMaps)
      : 0;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    internalNotes: task.internalNotes,
    isRequired: task.isRequired,
    assignedRole: task.assignedRole,
    estimatedDurationMinutes: task.estimatedDurationMinutes,
    status: task.status,
    blockedReason: task.blockedReason,
    completionRequirement: dto,
    acceptedEvidenceForRequirement: accepted,
    linkedEvidenceCount: evidenceView ? (evidenceCountByTask.get(task.id) ?? 0) : undefined,
    canManageCompletionRequirements: canManageJobTaskCompletionRequirements(role),
    canOverrideEvidenceCompletion: canCompleteJobTaskWithEvidenceOverride(role),
  };
}

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const ctx = await requireOrgSession();
  if (!canViewJobsWorkspace(ctx.role)) {
    notFound();
  }

  const inOrg = await getJobIdInOrganization(ctx.organizationId, jobId);
  if (!inOrg) {
    notFound();
  }

  const job = await getJobWorkspace(ctx.organizationId, jobId);
  if (!job) {
    notFound();
  }
  const workspaceJob = job;

  await syncActivePortalTokenJobIdForQuote(ctx.organizationId, workspaceJob.quote.id);

  const portalPostSend: QuoteStatus[] = [QuoteStatus.SENT, QuoteStatus.ACCEPTED, QuoteStatus.ACTIVATED];
  const portalSnapshotOk = parseSentSnapshotPreviewDto(workspaceJob.quote.sentSnapshotJson) !== null;
  const showCustomerPortalSection = portalPostSend.includes(workspaceJob.quote.status) && portalSnapshotOk;
  const activePortalToken = showCustomerPortalSection
    ? await findActivePortalTokenForQuote(ctx.organizationId, workspaceJob.quote.id)
    : null;

  const portalJobSubmissionsAccess = canViewCustomerPortalSubmissions(ctx.role);
  const portalJobSubmissionsRaw = portalJobSubmissionsAccess
    ? await listCustomerPortalSubmissionsForJob(ctx, workspaceJob.id)
    : [];
  const portalJobNewCount = portalJobSubmissionsAccess
    ? await countNewCustomerPortalSubmissionsForJob(ctx, workspaceJob.id)
    : 0;

  const evidenceView = canViewJobEvidence(ctx.role);
  const evidenceManage = canManageJobEvidence(ctx.role);

  const fileAttachmentIds = portalJobSubmissionsRaw.flatMap((s) =>
    s.type === CustomerPortalSubmissionType.FILE_UPLOAD ? s.attachments.map((a) => a.id) : [],
  );

  const [progress, activity, scheduledRows, evidenceRaw, evidenceCountByTask, promotionBuckets, acceptedEvidenceMaps] =
    await Promise.all([
      getJobProgressForJob(ctx.organizationId, workspaceJob.id),
      listJobActivityForJob(ctx.organizationId, workspaceJob.id),
      listScheduledWorkForJob(ctx.organizationId, workspaceJob.id),
      evidenceView ? listJobEvidenceForJob(ctx, workspaceJob.id) : Promise.resolve([]),
      evidenceView ? getEvidenceCountsByJobTask(ctx, workspaceJob.id) : Promise.resolve(new Map<string, number>()),
      evidenceView && fileAttachmentIds.length > 0
        ? listPromotionBucketsForAttachmentsOnJob(ctx, workspaceJob.id, fileAttachmentIds)
        : Promise.resolve([]),
      loadAcceptedEvidenceCountMapsForJob(ctx, workspaceJob.id),
    ]);

  const evidenceRows: JobEvidenceRowDto[] = evidenceRaw.map((e) => ({
    id: e.id,
    status: e.status,
    title: e.title,
    description: e.description,
    promotedAt: e.promotedAt.toISOString(),
    reviewedAt: e.reviewedAt?.toISOString() ?? null,
    rejectionReason: e.rejectionReason,
    jobTaskTitle: e.jobTask?.title ?? null,
    sourceAttachmentId: e.sourceAttachmentId,
    promotedByLabel: e.promotedBy
      ? e.promotedBy.name?.trim() || e.promotedBy.email?.trim() || null
      : null,
    reviewedByLabel: e.reviewedBy
      ? e.reviewedBy.name?.trim() || e.reviewedBy.email?.trim() || null
      : null,
  }));

  const evidenceTaskOptionsByJobId = {
    [workspaceJob.id]: workspaceJob.lines.flatMap((line) =>
      line.stages.flatMap((st) => st.tasks.map((t) => ({ id: t.id, title: t.title }))),
    ),
  };

  const evidencePromotionForPanel =
    portalJobSubmissionsAccess && evidenceView
      ? {
          taskOptionsByJobId: evidenceTaskOptionsByJobId,
          buckets: promotionBuckets.map((b) => ({
            attachmentId: b.attachmentId,
            jobId: workspaceJob.id,
            jobTaskId: b.jobTaskId,
          })),
          quoteIdForRevalidate: null as string | null,
        }
      : undefined;

  const scheduleItems = scheduledRows.map((row) => ({
    row,
    readiness: getReadinessForScheduledListRow(row),
  }));
  const activeScheduledTaskIds = new Set(
    scheduledRows.filter((r) => r.status === ScheduledWorkStatus.SCHEDULED).map((r) => r.jobTaskId),
  );

  const readOnlyHint = taskReadOnlyHint(ctx.role, workspaceJob.status);
  const canUpdateTasks = readOnlyHint === null;
  const showLifecycle = canChangeJobStatus(ctx.role);
  const showSchedule = canViewSchedule(ctx.role);
  const canMutateScheduleRows = canMutateSchedule(ctx.role);

  function scheduleActionForTask(task: {
    id: string;
    title: string;
    status: JobTaskStatus;
  }) {
    if (!showSchedule || !canMutateScheduleRows) {
      return undefined;
    }
    const jobAllows = canAttachNewScheduleToJob(workspaceJob.status);
    const taskAllows = isTaskSchedulable(task.status);
    const hasActive = activeScheduledTaskIds.has(task.id);
    if (!jobAllows || !taskAllows) {
      return undefined;
    }
    if (hasActive) {
      return (
        <TaskScheduleDialog
          jobId={workspaceJob.id}
          taskId={task.id}
          taskTitle={task.title}
          taskStatus={task.status}
          jobStatus={workspaceJob.status}
          disabled
          disabledReason="This task already has an active scheduled window. Use the Schedule section above to reschedule or cancel."
        />
      );
    }
    return (
      <TaskScheduleDialog
        jobId={workspaceJob.id}
        taskId={task.id}
        taskTitle={task.title}
        taskStatus={task.status}
        jobStatus={workspaceJob.status}
        disabled={false}
      />
    );
  }

  const headerDescription = [
    workspaceJob.customer.displayName,
    `Activated ${workspaceJob.activatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
    `Quote #${workspaceJob.quote.displayNumber}`,
    workspaceJob.opportunityId ? "Opportunity linked" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppWorkspaceCanvas>
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-8">
        <WorkspaceCommandHeader
          back={{ href: "/app/jobs", label: "Jobs" }}
          eyebrow="Job workspace"
          title={workspaceJob.title}
          badges={
            <>
              <MetadataPill variant="outline" className="font-mono">
                #{workspaceJob.displayNumber}
              </MetadataPill>
              <MetadataPill variant="muted">{formatJobStatus(workspaceJob.status)}</MetadataPill>
            </>
          }
          description={headerDescription}
          meta={
            <>
              <span>
                <span className="font-medium text-foreground/90">Updated</span>{" "}
                {workspaceJob.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <span>
                <span className="font-medium text-foreground/90">Created</span>{" "}
                {workspaceJob.createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-[5px] font-semibold">
                <Link href={`/app/customers/${workspaceJob.customer.id}`}>Customer</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-[5px] font-semibold">
                <Link href={`/app/sales/quotes/${workspaceJob.quote.id}`}>Quote workspace</Link>
              </Button>
              {workspaceJob.opportunityId ? (
                <Button asChild variant="outline" size="sm" className="rounded-[5px] font-semibold">
                  <Link href={`/app/sales/opportunities/${workspaceJob.opportunityId}`}>Opportunity</Link>
                </Button>
              ) : null}
            </div>
          }
        />

        {workspaceJob.statusReason && workspaceJob.status === JobStatus.CANCELED ? (
          <p className="max-w-3xl rounded-[6px] border border-border bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <span className="font-medium text-foreground dark:text-zinc-200">Cancel reason: </span>
            {workspaceJob.statusReason}
          </p>
        ) : null}
        {workspaceJob.statusReason && workspaceJob.status === JobStatus.PAUSED ? (
          <p className="max-w-3xl rounded-[6px] border border-border bg-muted/20 px-4 py-2.5 text-sm text-muted-foreground dark:border-zinc-800/60 dark:bg-zinc-950/40">
            <span className="font-medium text-foreground dark:text-zinc-200">Pause note: </span>
            {workspaceJob.statusReason}
          </p>
        ) : null}

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,17rem)] xl:grid-cols-[minmax(0,1fr)_min(100%,19rem)]">
          <div className="min-w-0 space-y-6">
      {showCustomerPortalSection ? (
        <StaffPortalLinkPanel
          quoteId={workspaceJob.quote.id}
          hasActiveToken={Boolean(activePortalToken)}
          lastViewedAt={activePortalToken?.lastViewedAt?.toISOString() ?? null}
          canCreateLink={canCreateCustomerPortalLink(ctx.role)}
          canRevokeRegenerateLink={canRevokeOrRegenerateCustomerPortalLink(ctx.role)}
        />
      ) : null}

      {portalJobSubmissionsAccess ? (
        <StaffCustomerPortalSubmissionsPanel
          title="Customer portal notes (this job)"
          newCount={portalJobNewCount}
          canManage={canManageCustomerPortalSubmissions(ctx.role)}
          canManageJobEvidence={evidenceManage}
          evidencePromotion={evidencePromotionForPanel}
          submissions={portalJobSubmissionsRaw.map((s) => ({
            id: s.id,
            type: s.type,
            status: s.status,
            subject: s.subject,
            message: s.message,
            createdAt: s.createdAt.toISOString(),
            customerDisplayName: s.customer.displayName.trim(),
            quoteDisplayNumber: s.quote?.displayNumber ?? null,
            jobDisplayNumber: s.job?.displayNumber ?? null,
            jobId: s.job?.id ?? null,
            visitLabel:
              s.type === CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION && s.scheduledWork?.jobTask
                ? s.scheduledWork.jobTask.customerLabel?.trim() ||
                  s.scheduledWork.jobTask.title?.trim() ||
                  null
                : null,
            scheduleWindowDisplay:
              s.type === CustomerPortalSubmissionType.APPOINTMENT_CONFIRMATION && s.scheduledWork
                ? formatScheduleWindowDisplay(
                    s.scheduledWork.scheduledStartAt.toISOString(),
                    s.scheduledWork.scheduledEndAt.toISOString(),
                  )
                : null,
            attachments: s.attachments.map((a) => ({
              id: a.id,
              originalFilename: a.originalFilename,
              sanitizedFilename: a.sanitizedFilename,
              contentType: a.contentType,
              detectedContentType: a.detectedContentType,
              sizeBytes: a.sizeBytes,
              status: a.status,
              createdAt: a.createdAt.toISOString(),
            })),
          }))}
        />
      ) : null}

      {evidenceView ? (
        <JobEvidenceSection canManage={evidenceManage} canView={evidenceView} rows={evidenceRows} />
      ) : null}

      {workspaceJob.status === JobStatus.PAUSED ? (
        <div
          className="rounded-[6px] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground dark:border-amber-500/25 dark:bg-amber-500/10"
          role="status"
        >
          <p className="font-medium text-amber-900 dark:text-amber-100">Job paused</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-zinc-400">
            Field roles cannot update tasks until the job is resumed. Office staff may still update tasks if work
            continues on site under office direction.
          </p>
        </div>
      ) : null}

      {workspaceJob.status === JobStatus.COMPLETED ? (
        <div
          className="rounded-[6px] border border-border bg-muted/20 px-4 py-3 text-sm text-foreground dark:border-zinc-800/60 dark:bg-zinc-950/40"
          role="status"
        >
          <p className="font-medium dark:text-zinc-100">Job completed</p>
          <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-400">
            This job is closed. Task status updates are disabled. Scope and pricing remain in the quote workspace.
          </p>
        </div>
      ) : null}

      {workspaceJob.status === JobStatus.CANCELED ? (
        <div
          className="rounded-[6px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground dark:border-red-900/40 dark:bg-red-950/25"
          role="status"
        >
          <p className="font-medium text-destructive dark:text-red-400">Job canceled</p>
          <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-400">
            This job is closed. Task status updates are disabled. The linked quote is unchanged in the archive.
          </p>
        </div>
      ) : null}

            <WorkspacePanelFrame
              kicker="Execution"
              title="Progress & job controls"
              subtitle="Required task completion and task mix by status. Job lifecycle actions respect your role."
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground dark:text-zinc-500">
                    Required tasks complete:{" "}
                    <span className="font-medium tabular-nums text-foreground dark:text-zinc-200">
                      {progress.requiredComplete}/{progress.requiredTotal}
                    </span>
                    {" · "}
                    Total tasks:{" "}
                    <span className="font-medium tabular-nums text-foreground dark:text-zinc-200">{progress.totalTasks}</span>
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground dark:text-zinc-500">
                    {TASK_STATUS_ORDER.map((s) => (
                      <li key={s}>
                        {formatJobTaskStatus(s)}:{" "}
                        <span className="tabular-nums font-medium text-foreground dark:text-zinc-200">{progress.byStatus[s]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {showLifecycle ? <JobLifecycleToolbar jobId={workspaceJob.id} status={workspaceJob.status} /> : null}
              </div>
            </WorkspacePanelFrame>

            {showSchedule ? (
              <WorkspacePanelFrame
                kicker="Schedule"
                title="Scheduled work"
                subtitle="Windows tied to job tasks. Readiness is derived from job and task facts."
              >
                <JobScheduleSection canMutate={canMutateScheduleRows} items={scheduleItems} />
              </WorkspacePanelFrame>
            ) : null}

            <WorkspacePanelFrame
              kicker="Plan"
              title="Execution plan"
              subtitle="Structure and titles were copied from the frozen sent snapshot at activation. Task status is operational only; the quote workspace remains the contract record."
            >
              <div className="min-w-0 space-y-5 pt-1">
                {workspaceJob.lines.map((line) => (
                  <div
                    key={line.id}
                    className="min-w-0 rounded-[6px] border border-border/80 bg-background/50 p-4 dark:border-zinc-800/60 dark:bg-zinc-950/35"
                  >
                    <h3 className="text-sm font-semibold text-foreground dark:text-zinc-100">{line.title}</h3>
                    {line.customerDescription ? (
                      <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-400">{line.customerDescription}</p>
                    ) : null}
                    <div className="mt-4 min-w-0 space-y-4 border-l border-border pl-3 dark:border-zinc-800/70 sm:pl-4">
                      {line.stages.map((stage) => (
                        <div key={stage.id} className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-zinc-600">
                            {stage.title}
                          </p>
                          {stage.internalNotes ? (
                            <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-500">{stage.internalNotes}</p>
                          ) : null}
                          <div className="mt-2 min-w-0 space-y-2">
                            {stage.tasks.map((task) => (
                              <JobTaskStatusForm
                                key={`${task.id}-${task.status}-${task.blockedReason ?? ""}-${JSON.stringify(task.completionRequirementsJson)}`}
                                jobId={workspaceJob.id}
                                task={toJobTaskRowModel(
                                  task,
                                  ctx.role,
                                  evidenceView,
                                  evidenceCountByTask,
                                  acceptedEvidenceMaps,
                                )}
                                canUpdate={canUpdateTasks}
                                readOnlyHint={readOnlyHint}
                                scheduleAction={scheduleActionForTask(task)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </WorkspacePanelFrame>

            <WorkspacePanelFrame
              kicker="Audit"
              title="Activity"
              subtitle="Internal staff timeline (newest first). Not shown to customers or on proposals."
            >
              {activity.length === 0 ? (
                <WorkspaceEmptyState
                  className="border-0 bg-transparent py-6"
                  title="No job events yet"
                  description="Lifecycle changes, task updates, and staff actions will appear here."
                />
              ) : (
                <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-[6px] border border-border dark:divide-zinc-800/60 dark:border-zinc-800/60">
                  {activity.map((e) => (
                    <li key={e.id} className="min-w-0 px-4 py-3">
                      <div className="flex min-w-0 flex-wrap justify-between gap-2 text-xs text-muted-foreground dark:text-zinc-500">
                        <span className="font-semibold uppercase tracking-wide text-foreground/90 dark:text-zinc-300">
                          {e.eventType.replace(/_/g, " ")}
                        </span>
                        <time className="shrink-0 tabular-nums">{e.createdAt.toLocaleString()}</time>
                      </div>
                      <p className="mt-1 text-sm text-foreground dark:text-zinc-200">{e.summary}</p>
                      <p className="mt-1 text-xs text-muted-foreground dark:text-zinc-500">
                        {e.actorUser?.name ?? e.actorUser?.email ?? "System"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </WorkspacePanelFrame>
          </div>

          <WorkspaceSummaryPanel title="Execution brief">
            <div className="space-y-2 text-[11px] text-muted-foreground dark:text-zinc-500">
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Status</span> — {formatJobStatus(workspaceJob.status)}
              </p>
              <p className="min-w-0">
                <span className="font-medium text-foreground dark:text-zinc-200">Customer</span> —{" "}
                <Link
                  href={`/app/customers/${workspaceJob.customer.id}`}
                  className="text-primary hover:underline dark:text-blue-400"
                >
                  {workspaceJob.customer.displayName}
                </Link>
              </p>
              <p className="min-w-0">
                <span className="font-medium text-foreground dark:text-zinc-200">Quote</span> —{" "}
                <Link
                  href={`/app/sales/quotes/${workspaceJob.quote.id}`}
                  className="tabular-nums text-primary hover:underline dark:text-blue-400"
                >
                  #{workspaceJob.quote.displayNumber}
                </Link>
              </p>
              {workspaceJob.opportunityId ? (
                <p className="min-w-0">
                  <span className="font-medium text-foreground dark:text-zinc-200">Opportunity</span> —{" "}
                  <Link
                    href={`/app/sales/opportunities/${workspaceJob.opportunityId}`}
                    className="text-primary hover:underline dark:text-blue-400"
                  >
                    Open pipeline record
                  </Link>
                </p>
              ) : null}
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Required progress</span> —{" "}
                <span className="tabular-nums">
                  {progress.requiredComplete}/{progress.requiredTotal}
                </span>
              </p>
              <p>
                <span className="font-medium text-foreground dark:text-zinc-200">Tasks</span> —{" "}
                <span className="tabular-nums">{progress.totalTasks}</span>
              </p>
              {progress.byStatus.BLOCKED > 0 ? (
                <p className="text-amber-800 dark:text-amber-400/90">
                  <span className="font-medium">Blocked</span> — {progress.byStatus.BLOCKED}
                </p>
              ) : null}
            </div>
            <div className="border-t border-border pt-3 dark:border-zinc-800/50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary dark:text-blue-400/90">Focus</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground dark:text-zinc-400">
                {progress.byStatus.BLOCKED > 0
                  ? `${progress.byStatus.BLOCKED} task(s) blocked — review in the execution plan.`
                  : progress.requiredComplete < progress.requiredTotal
                    ? `${progress.requiredTotal - progress.requiredComplete} required task(s) not complete.`
                    : workspaceJob.status === JobStatus.ACTIVE
                      ? "Monitor scheduled work and task execution on the left."
                      : "This job is not active for field task updates."}
              </p>
            </div>
          </WorkspaceSummaryPanel>
        </div>
      </div>
    </AppWorkspaceCanvas>
  );
}
