import { Prisma, QuoteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { OrgSessionContext } from "@/server/phase1/org-session";
import { sentQuoteSnapshotV2Schema } from "@/server/phase2/customer-preview";
import { parseJobTaskCompletionRequirements } from "@/server/phase13/completion-requirements";
import { QuoteActivityEventType } from "@/server/phase2/quote-activity-types";
import { recordQuoteActivity } from "@/server/phase2/record-quote-activity";
import { initialJobTaskStatusFromSnapshot } from "@/server/phase4/job-task-status-map";
import { JobActivityEventType } from "@/server/phase5/job-activity-types";
import { recordJobActivity } from "@/server/phase5/record-job-activity";

async function nextJobDisplayNumber(organizationId: string, tx: Prisma.TransactionClient) {
  const agg = await tx.job.aggregate({
    where: { organizationId },
    _max: { displayNumber: true },
  });
  return (agg._max.displayNumber ?? 0) + 1;
}

export type ActivateJobQuoteRow = {
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
 * Creates Job + lines/stages/tasks from validated snapshot v2 only (no live quote execution reads).
 * Sets quote ACTIVATED, activatedAt/By, and jobId. Caller enforces RBAC, org, ACCEPTED, and duplicate job checks.
 */
export async function activateAcceptedQuoteAsJobInTransaction(
  ctx: OrgSessionContext,
  quote: ActivateJobQuoteRow,
): Promise<{ ok: true; jobId: string; opportunityId: string } | { ok: false; error: string }> {
  const snap = sentQuoteSnapshotV2Schema.safeParse(quote.sentSnapshotJson);
  if (!snap.success) {
    return { ok: false, error: "Activation requires a valid sent snapshot (version 2)." };
  }
  const plan = snap.data.internalExecutionPlan;
  if (!plan.lines.length) {
    return {
      ok: false,
      error:
        "The sent snapshot has no execution lines. Add line execution to the quote before sending, or revise the quote.",
    };
  }

  const activatedAt = new Date();
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
          activatedAt,
          activatedByUserId: ctx.userId,
        },
      });

      await recordJobActivity(tx, {
        organizationId: ctx.organizationId,
        jobId: job.id,
        actorUserId: ctx.userId,
        eventType: JobActivityEventType.JOB_CREATED,
        summary: `Job #${displayNumber} created from quote #${quote.displayNumber}`,
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

      const prevStatus = quote.status;
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: QuoteStatus.ACTIVATED,
          activatedAt,
          activatedBy: { connect: { id: ctx.userId } },
          jobId: job.id,
        },
      });

      await recordQuoteActivity(tx, {
        organizationId: ctx.organizationId,
        quoteId: quote.id,
        opportunityId: quote.opportunityId,
        customerId: quote.customerId,
        actorUserId: ctx.userId,
        eventType: QuoteActivityEventType.QUOTE_ACTIVATED,
        summary: `Job #${displayNumber} created from quote #${quote.displayNumber}`,
        payload: { quoteId: quote.id, jobId: job.id },
      });
      await recordQuoteActivity(tx, {
        organizationId: ctx.organizationId,
        quoteId: quote.id,
        opportunityId: quote.opportunityId,
        customerId: quote.customerId,
        actorUserId: ctx.userId,
        eventType: QuoteActivityEventType.QUOTE_STATUS_CHANGED,
        summary: `Status: ${prevStatus} → ${QuoteStatus.ACTIVATED}`,
        payload: { fromStatus: prevStatus, toStatus: QuoteStatus.ACTIVATED },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "INVALID_SNAPSHOT_COMPLETION_REQUIREMENTS") {
      return {
        ok: false,
        error:
          "Activation blocked: the sent snapshot contains an invalid planned completion requirement. Revise and re-send the quote, or contact support.",
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
