import { z } from "zod";
import type { Prisma } from "@prisma/client";

/**
 * Activation Baseline Schema (Version 1)
 * Captured at the moment of JobStatus.WORK_PLAN_REVIEW -> JobStatus.ACTIVE transition.
 */
export const activationBaselineV1Schema = z.object({
  version: z.literal(1),
  activatedAt: z.string(), // ISO string
  activatedByUserId: z.string(),
  lines: z.array(
    z.object({
      id: z.string(),
      sourceQuoteLineItemId: z.string().nullable(),
      title: z.string(),
      sortOrder: z.number(),
      stages: z.array(
        z.object({
          id: z.string(),
          sourceQuoteStageId: z.string().nullable(),
          title: z.string(),
          sortOrder: z.number(),
          tasks: z.array(
            z.object({
              id: z.string(),
              sourceQuoteTaskId: z.string().nullable(),
              title: z.string(),
              sortOrder: z.number(),
              isRequired: z.boolean(),
              assignedRole: z.string().nullable(),
              completionRequirementsJson: z.any().nullable(),
              customerVisible: z.boolean(),
              customerLabel: z.string().nullable(),
              statusAtActivation: z.string(),
            })
          ),
        })
      ),
    })
  ),
});

export type ActivationBaselineV1 = z.infer<typeof activationBaselineV1Schema>;

/**
 * Builds the activation baseline JSON from a loaded Job with its lines, stages, and tasks.
 */
export function buildActivationBaseline(
  job: {
    id: string;
    activatedAt: Date;
    activatedByUserId: string;
    lines: Array<{
      id: string;
      sourceQuoteLineItemId: string | null;
      title: string;
      sortOrder: number;
      stages: Array<{
        id: string;
        sourceQuoteStageId: string | null;
        title: string;
        sortOrder: number;
        tasks: Array<{
          id: string;
          sourceQuoteTaskId: string | null;
          title: string;
          sortOrder: number;
          isRequired: boolean;
          assignedRole: string | null;
          completionRequirementsJson: Prisma.JsonValue | null;
          customerVisible: boolean;
          customerLabel: string | null;
          status: string;
        }>;
      }>;
    }>;
  }
): ActivationBaselineV1 {
  return {
    version: 1,
    activatedAt: job.activatedAt.toISOString(),
    activatedByUserId: job.activatedByUserId,
    lines: job.lines.map((line) => ({
      id: line.id,
      sourceQuoteLineItemId: line.sourceQuoteLineItemId,
      title: line.title,
      sortOrder: line.sortOrder,
      stages: line.stages.map((stage) => ({
        id: stage.id,
        sourceQuoteStageId: stage.sourceQuoteStageId,
        title: stage.title,
        sortOrder: stage.sortOrder,
        tasks: stage.tasks.map((task) => ({
          id: task.id,
          sourceQuoteTaskId: task.sourceQuoteTaskId,
          title: task.title,
          sortOrder: task.sortOrder,
          isRequired: task.isRequired,
          assignedRole: task.assignedRole,
          completionRequirementsJson: task.completionRequirementsJson,
          customerVisible: task.customerVisible,
          customerLabel: task.customerLabel,
          statusAtActivation: task.status,
        })),
      })),
    })),
  };
}
