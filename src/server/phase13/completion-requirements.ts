import { z } from "zod";

export const COMPLETION_REQUIREMENTS_VERSION = 1 as const;

/** Strict v1 evidence block — unknown keys rejected. */
const evidenceRequirementV1Schema = z
  .object({
    required: z.boolean(),
    minAcceptedCount: z.number().int().min(1).max(10).optional(),
    allowJobLevelEvidence: z.boolean().optional().default(false),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.required && (val.minAcceptedCount === undefined || val.minAcceptedCount < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minAcceptedCount is required when evidence.required is true.",
        path: ["minAcceptedCount"],
      });
    }
  });

export const completionRequirementsV1Schema = z
  .object({
    version: z.literal(1),
    evidence: evidenceRequirementV1Schema,
  })
  .strict();

export type CompletionRequirementsV1Parsed = z.infer<typeof completionRequirementsV1Schema>;

export type ParsedCompletionRequirements =
  | { kind: "none" }
  | { kind: "valid"; v1: CompletionRequirementsV1Parsed }
  | { kind: "invalid"; reason: string };

/**
 * Parse stored JSON for JobTask.completionRequirementsJson.
 * - null/undefined → no requirements
 * - non-object → invalid
 * - wrong version / zod failure → invalid
 */
export function parseJobTaskCompletionRequirements(json: unknown): ParsedCompletionRequirements {
  if (json === null || json === undefined) {
    return { kind: "none" };
  }
  if (typeof json !== "object" || Array.isArray(json)) {
    return { kind: "invalid", reason: "Completion requirements must be a JSON object." };
  }
  const r = completionRequirementsV1Schema.safeParse(json);
  if (!r.success) {
    return { kind: "invalid", reason: "Completion requirements are invalid or unsupported." };
  }
  const v = r.data;
  if (!v.evidence.required) {
    return { kind: "none" };
  }
  return { kind: "valid", v1: v };
}

export type EvidenceRequirementInputV1 = {
  required: boolean;
  minAcceptedCount: number;
  allowJobLevelEvidence: boolean;
};

/**
 * Build JSON for persistence from staff input. Throws nothing — validates and returns null if cleared.
 */
export function serializeEvidenceRequirementInput(input: EvidenceRequirementInputV1): unknown | null {
  if (!input.required) {
    return null;
  }
  const min = Math.floor(Number(input.minAcceptedCount));
  if (!Number.isFinite(min) || min < 1 || min > 10) {
    throw new Error("Minimum accepted evidence count must be between 1 and 10.");
  }
  return {
    version: COMPLETION_REQUIREMENTS_VERSION,
    evidence: {
      required: true,
      minAcceptedCount: min,
      allowJobLevelEvidence: Boolean(input.allowJobLevelEvidence),
    },
  } satisfies CompletionRequirementsV1Parsed;
}

/** Safe DTO for client — no raw JSON. */
export type CompletionRequirementDto =
  | { state: "none" }
  | { state: "invalid"; message: string }
  | {
      state: "active";
      minAcceptedCount: number;
      allowJobLevelEvidence: boolean;
    };

export function toCompletionRequirementDto(parsed: ParsedCompletionRequirements): CompletionRequirementDto {
  if (parsed.kind === "none") {
    return { state: "none" };
  }
  if (parsed.kind === "invalid") {
    return { state: "invalid", message: parsed.reason };
  }
  return {
    state: "active",
    minAcceptedCount: parsed.v1.evidence.minAcceptedCount ?? 1,
    allowJobLevelEvidence: parsed.v1.evidence.allowJobLevelEvidence,
  };
}

export function requirementSummaryForAudit(dto: CompletionRequirementDto): string {
  if (dto.state === "none") {
    return "none";
  }
  if (dto.state === "invalid") {
    return `invalid: ${dto.message}`;
  }
  return `evidence required min=${dto.minAcceptedCount} jobLevel=${dto.allowJobLevelEvidence}`;
}
