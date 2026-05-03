import { Prisma } from "@prisma/client";

import {
  parseJobTaskCompletionRequirements,
  type CompletionRequirementsV1Parsed,
} from "@/server/phase13/completion-requirements";

/**
 * Quote → template serialization: include canonical v1 completion requirements when the DB row has an active gate.
 * Throws if the row holds invalid JSON (fail closed; do not save corrupted template payloads).
 */
export function serializeQuoteTaskCompletionRequirementsForTemplatePayload(
  dbJson: unknown | null | undefined,
  taskTitleForError: string,
): { completionRequirementsJson: CompletionRequirementsV1Parsed } | Record<string, never> {
  if (dbJson === null || dbJson === undefined) {
    return {};
  }
  const p = parseJobTaskCompletionRequirements(dbJson);
  if (p.kind === "invalid") {
    throw new Error(
      `Cannot save template: planned task "${taskTitleForError}" has invalid completion requirements in the database.`,
    );
  }
  if (p.kind === "none") {
    return {};
  }
  return { completionRequirementsJson: p.v1 };
}

/** Template → quote row: Prisma JSON column value from parsed template task payload. */
export function quoteRowCompletionJsonFromTemplateTaskPayload(
  payload: CompletionRequirementsV1Parsed | undefined,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (payload === undefined) {
    return Prisma.JsonNull;
  }
  return payload as unknown as Prisma.InputJsonValue;
}
