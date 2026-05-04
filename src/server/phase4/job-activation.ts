import { JobStatus, JobTaskStatus, Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { canActivateAcceptedQuoteAsJob } from "@/lib/phase4-permissions";
import { sentQuoteSnapshotV2Schema } from "@/server/phase2/customer-preview";
import { parseJobTaskCompletionRequirements } from "@/server/phase13/completion-requirements";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import { recordQuoteActivity } from "@/server/phase2/record-quote-activity";
import { initialJobTaskStatusFromSnapshot } from "@/server/phase4/job-task-status-map";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { recordJobActivity } from "@/server/phase5/record-job-activity";
import { buildActivationBaseline } from "@/server/phase4/job-activation-baseline";

async function nextJobDisplayNumber(organizationId: string, tx: Prisma.TransactionClient) {
  const agg = await tx.job.aggregate({
    where: { organizationId },
    _max: { displayNumber: true },
  });
  return (agg._max.displayNumber ?? 0) + 1;
}

export type InitializeJobQuoteRow = {
  id: string;
  organizationId: string;
  customerId: string;
  opportunityId: string;
  title: string;
  displayNumber: number;
  status: QuoteStatus;
  sentSnapshotJson: unknown;
};

/**
 * Materializes a Job + lines/stages/tasks in WORK_PLAN_REVIEW status from validated snapshot v2.
 * Decoupled from Quote activation (Quote remains ACCEPTED).
 * Caller enforces RBAC, org, ACCEPTED, and duplicate job checks.
 */
export async function initializeJobFromAcceptedQuoteInTransaction(
  ctx: OrgSessionContext,
  quote: InitializeJobQuoteRow,
): Promise<{ ok: true; jobId: string; opportunityId: string } | { ok: false; error: string }> {
  const snap = sentQuoteSnapshotV2Schema.safeParse(quote.sentSnapshotJson);
  if (!snap.success) {
    return { ok: false, error: "Job creation requires a valid sent snapshot (version 2)." };
  }
  /** Proposed work-plan seed from sent snapshot v2 (not final field execution truth). */
  const plan = snap.data.internalExecutionPlan;
  if (!plan.lines.length) {
    return {
      ok: false,
      error:
        "The sent snapshot has no proposed work-plan lines. Add stages/tasks to line items before sending, or revise the quote.",
    };
  }

  const sourceSnapshotJson = snap.data as unknown as Prisma.InputJsonValue;

  try {
    await prisma.$transaction(async (tx) => {
      const dup = await tx.job.findUnique({ where: { quoteId: quote.id } });
      if (dup) {
        throw new Error("DUPLICATE_JOB");
      }

      const displayNumber = await nextJobDisplayNumber(ctx.organizationId, tx);
      const job = await tx.job.create({
        data: {
          organizationId: ctx.organizationId,
          quoteId: quote.id,
          customerId: quote.customerId,
          opportunityId: quote.opportunityId,
          displayNumber,
          title: quote.title,
          sourceSnapshotJson,
          status: JobStatus.WORK_PLAN_REVIEW,
          activatedAt: null,
          activatedByUserId: null,
        },
      });

      await recordJobActivity(tx, {
        organizationId: ctx.organizationId,
        jobId: job.id,
        actorUserId: ctx.userId,
        eventType: JobActivityEventType.JOB_WORK_PLAN_CREATED,
        summary: `Work plan review started for Job #${displayNumber} from quote #${quote.displayNumber}`,
        payloadJson: { quoteId: quote.id, jobId: job.id },
      });

      for (const line of plan.lines) {
        const jl = await tx.jobLine.create({
          data: {
            organizationId: ctx.organizationId,
            jobId: job.id,
            sourceQuoteLineItemId: line.quoteLineItemId,
            title: line.title,
            customerDescription: null,
            sortOrder: line.sortOrder,
          },
        });

        for (const stage of line.stages) {
          const js = await tx.jobStage.create({
            data: {
              organizationId: ctx.organizationId,
              jobId: job.id,
              jobLineId: jl.id,
              sourceQuoteStageId: stage.id,
              title: stage.title,
              sortOrder: stage.sortOrder,
              internalNotes: stage.internalNotes ?? null,
            },
          });

          for (const task of stage.tasks) {
            let completionRequirementsJson: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
            if (task.completionRequirementsJson !== undefined && task.completionRequirementsJson !== null) {
              const pr = parseJobTaskCompletionRequirements(task.completionRequirementsJson);
              if (pr.kind === "invalid") {
                throw new Error("INVALID_SNAPSHOT_COMPLETION_REQUIREMENTS");
              }
              if (pr.kind === "valid") {
                completionRequirementsJson = pr.v1 as unknown as Prisma.InputJsonValue;
              }
            }
            await tx.jobTask.create({
              data: {
                organizationId: ctx.organizationId,
                jobId: job.id,
                jobLineId: jl.id,
                jobStageId: js.id,
                sourceQuoteTaskId: task.id,
                title: task.title,
                description: task.description ?? null,
                status: initialJobTaskStatusFromSnapshot(task.status),
                isRequired: task.isRequired,
                sortOrder: task.sortOrder,
                assignedRole: task.assignedRole ?? null,
                estimatedDurationMinutes: task.estimatedDurationMinutes ?? null,
                customerVisible: task.customerVisible,
                customerLabel: task.customerLabel ?? null,
                internalNotes: task.internalNotes ?? null,
                completionRequirementsJson,
              },
            });
          }
        }
      }

      await tx.quote.update({
        where: { id: quote.id },
        data: {
          jobId: job.id,
        },
      });

      await recordQuoteActivity(tx, {
        organizationId: ctx.organizationId,
        quoteId: quote.id,
        opportunityId: quote.opportunityId,
        customerId: quote.customerId,
        actorUserId: ctx.userId,
        eventType: QuoteActivityEventType.QUOTE_WORK_PLAN_REVIEW_STARTED,
        summary: `Job #${displayNumber} work plan review started`,
        payload: { quoteId: quote.id, jobId: job.id },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_SNAPSHOT_COMPLETION_REQUIREMENTS") {
      return {
        ok: false,
        error:
          "Job creation blocked: the sent snapshot contains an invalid planned completion requirement. Revise and re-send the quote, or contact support.",
      };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "A job already exists for this quote." };
    }
    if (e instanceof Error && e.message === "DUPLICATE_JOB") {
      return { ok: false, error: "A job already exists for this quote." };
    }
    throw e;
  }

  const job = await prisma.job.findUniqueOrThrow({ where: { quoteId: quote.id }, select: { id: true } });
  return { ok: true, jobId: job.id, opportunityId: quote.opportunityId };
}

export async function jobMutationActivateExecution(
  ctx: OrgSessionContext,
  formData: FormData
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  if (!canActivateAcceptedQuoteAsJob(ctx.role)) {
    return { ok: false, error: "You do not have permission to activate job execution." };
  }

  const jobId = formData.get("jobId");
  if (typeof jobId !== "string" || !jobId) {
    return { ok: false, error: "Job ID is required." };
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    include: {
      quote: true,
      lines: {
        include: {
          stages: {
            include: {
              tasks: { where: { archivedAt: null } },
            },
          },
        },
      },
    },
  });

  if (!job) {
    return { ok: false, error: "Job not found." };
  }

  // Preconditions
  if (job.status !== JobStatus.WORK_PLAN_REVIEW) {
    return { ok: false, error: "Only a job in work plan review can be activated." };
  }
  if (!job.quote || job.quote.organizationId !== ctx.organizationId) {
    return { ok: false, error: "Related quote not found or organization mismatch." };
  }
  if (job.quote.status !== QuoteStatus.ACCEPTED) {
    return { ok: false, error: "The quote must be in ACCEPTED status to activate execution." };
  }
  if (job.quote.jobId !== job.id) {
    return { ok: false, error: "Quote and job are not correctly linked." };
  }
  if (job.activatedAt) {
    return { ok: false, error: "This job is already activated." };
  }

  const allTasks = job.lines.flatMap((l) => l.stages.flatMap((s) => s.tasks));
  if (allTasks.length === 0) {
    return { ok: false, error: "Cannot activate a job with no tasks." };
  }
  if (allTasks.some((t) => t.status === JobTaskStatus.IN_PROGRESS || t.status === JobTaskStatus.COMPLETE)) {
    return { ok: false, error: "Cannot activate a job that already has tasks in progress or complete." };
  }

  // Validate sent snapshot to ensure activation baseline can be built reliably
  try {
    sentQuoteSnapshotV2Schema.parse(job.quote.sentSnapshotJson);
  } catch {
    return { ok: false, error: "Activation blocked: the quote has an invalid or incompatible sent snapshot." };
  }

  const now = new Date();
  const baseline = buildActivationBaseline({
    ...job,
    activatedAt: now,
    activatedByUserId: ctx.userId,
  });

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update Job
      await tx.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.ACTIVE,
          activatedAt: now,
          activatedByUserId: ctx.userId,
          activationBaselineJson: baseline as Prisma.InputJsonValue,
        },
      });

      // 2. Update Quote
      await tx.quote.update({
        where: { id: job.quote.id },
        data: {
          status: QuoteStatus.ACTIVATED,
          activatedAt: now,
          activatedByUserId: ctx.userId,
        },
      });

      // 3. Record Activity
      await recordJobActivity(tx, {
        organizationId: ctx.organizationId,
        jobId: job.id,
        actorUserId: ctx.userId,
        eventType: JobActivityEventType.JOB_EXECUTION_ACTIVATED,
        summary: `Execution activated for Job #${job.displayNumber}. Work plan released to field.`,
        payloadJson: { jobId: job.id, quoteId: job.quote.id },
      });

      await recordQuoteActivity(tx, {
        organizationId: ctx.organizationId,
        quoteId: job.quote.id,
        opportunityId: job.quote.opportunityId,
        customerId: job.quote.customerId,
        actorUserId: ctx.userId,
        eventType: QuoteActivityEventType.QUOTE_ACTIVATED,
        summary: `Quote #${job.quote.displayNumber} activated. Execution is now active.`,
        payload: { quoteId: job.quote.id, jobId: job.id },
      });

      await recordQuoteActivity(tx, {
        organizationId: ctx.organizationId,
        quoteId: job.quote.id,
        opportunityId: job.quote.opportunityId,
        customerId: job.quote.customerId,
        actorUserId: ctx.userId,
        eventType: QuoteActivityEventType.QUOTE_STATUS_CHANGED,
        summary: `Status: ${QuoteStatus.ACCEPTED} → ${QuoteStatus.ACTIVATED}`,
        payload: { fromStatus: QuoteStatus.ACCEPTED, toStatus: QuoteStatus.ACTIVATED },
      });
    });

    return { ok: true, jobId: job.id };
  } catch (e) {
    console.error("Failed to activate job execution:", e);
    return { ok: false, error: "An unexpected error occurred while activating execution." };
  }
}
