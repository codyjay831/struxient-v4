import { Prisma } from "@prisma/client";

import {
  parseJobTaskCompletionRequirements,
  serializeEvidenceRequirementInput,
} from "@/server/phase13/completion-requirements";

export type QuoteLineItemLikeForSendValidation = {
  executionStages: {
    tasks: { id: string; title: string; completionRequirementsJson: unknown }[];
  }[];
};

/**
 * Build Prisma JSON for QuoteLineExecutionTask from staff form booleans/numbers.
 * Returns null when evidence is not required.
 */
export function quoteLineExecutionCompletionJsonFromForm(params: {
  evidenceRequired: boolean;
  minAcceptedEvidenceCount: number;
  allowJobLevelEvidence: boolean;
}): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!params.evidenceRequired) {
    return Prisma.JsonNull;
  }
  const raw = serializeEvidenceRequirementInput({
    required: true,
    minAcceptedCount: params.minAcceptedEvidenceCount,
    allowJobLevelEvidence: params.allowJobLevelEvidence,
  });
  if (raw == null) {
    return Prisma.JsonNull;
  }
  return raw as Prisma.InputJsonValue;
}

/** Validate every line execution task JSON before send. */
export function validateQuoteLineTasksCompletionRequirementsForSend(
  lineItems: QuoteLineItemLikeForSendValidation[],
): { ok: true } | { ok: false; error: string } {
  for (const line of lineItems) {
    for (const stage of line.executionStages) {
      for (const task of stage.tasks) {
        const p = parseJobTaskCompletionRequirements(task.completionRequirementsJson);
        if (p.kind === "invalid") {
          return {
            ok: false,
            error: `Send blocked: completion requirement on planned task "${task.title}" is invalid or unsupported. Clear it or fix the evidence settings.`,
          };
        }
      }
    }
  }
  return { ok: true };
}
