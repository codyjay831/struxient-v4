import { describe, expect, it } from "vitest";
import {
  parseJobTaskCompletionRequirements,
  serializeEvidenceRequirementInput,
  toCompletionRequirementDto,
} from "@/server/phase13/completion-requirements";

describe("parseJobTaskCompletionRequirements", () => {
  it("treats null as none", () => {
    expect(parseJobTaskCompletionRequirements(null).kind).toBe("none");
    expect(parseJobTaskCompletionRequirements(undefined).kind).toBe("none");
  });

  it("parses valid v1 evidence requirement", () => {
    const r = parseJobTaskCompletionRequirements({
      version: 1,
      evidence: { required: true, minAcceptedCount: 2, allowJobLevelEvidence: true },
    });
    expect(r.kind).toBe("valid");
    if (r.kind === "valid") {
      expect(r.v1.evidence.minAcceptedCount).toBe(2);
      expect(r.v1.evidence.allowJobLevelEvidence).toBe(true);
    }
  });

  it("treats evidence.required false as none", () => {
    const r = parseJobTaskCompletionRequirements({
      version: 1,
      evidence: { required: false, allowJobLevelEvidence: true },
    });
    expect(r.kind).toBe("none");
  });

  it("rejects wrong version", () => {
    const r = parseJobTaskCompletionRequirements({
      version: 2,
      evidence: { required: true, minAcceptedCount: 1 },
    });
    expect(r.kind).toBe("invalid");
  });

  it("rejects unknown root keys (strict)", () => {
    const r = parseJobTaskCompletionRequirements({
      version: 1,
      evidence: { required: true, minAcceptedCount: 1 },
      extra: 1,
    });
    expect(r.kind).toBe("invalid");
  });

  it("rejects non-object", () => {
    expect(parseJobTaskCompletionRequirements("x").kind).toBe("invalid");
    expect(parseJobTaskCompletionRequirements([]).kind).toBe("invalid");
  });

  it("rejects required true without minAcceptedCount", () => {
    const r = parseJobTaskCompletionRequirements({
      version: 1,
      evidence: { required: true },
    });
    expect(r.kind).toBe("invalid");
  });

  it("rejects minAcceptedCount out of range", () => {
    const r = parseJobTaskCompletionRequirements({
      version: 1,
      evidence: { required: true, minAcceptedCount: 0 },
    });
    expect(r.kind).toBe("invalid");
  });
});

describe("serializeEvidenceRequirementInput", () => {
  it("returns null when not required", () => {
    expect(
      serializeEvidenceRequirementInput({
        required: false,
        minAcceptedCount: 3,
        allowJobLevelEvidence: true,
      }),
    ).toBeNull();
  });

  it("builds v1 JSON when required", () => {
    const j = serializeEvidenceRequirementInput({
      required: true,
      minAcceptedCount: 3,
      allowJobLevelEvidence: false,
    }) as { version: number; evidence: { minAcceptedCount: number } };
    expect(j.version).toBe(1);
    expect(j.evidence.minAcceptedCount).toBe(3);
  });

  it("throws when min out of range", () => {
    expect(() =>
      serializeEvidenceRequirementInput({
        required: true,
        minAcceptedCount: 11,
        allowJobLevelEvidence: false,
      }),
    ).toThrow();
  });
});

describe("toCompletionRequirementDto", () => {
  it("maps invalid parse to dto", () => {
    const dto = toCompletionRequirementDto(parseJobTaskCompletionRequirements({ foo: 1 }));
    expect(dto.state).toBe("invalid");
  });
});
