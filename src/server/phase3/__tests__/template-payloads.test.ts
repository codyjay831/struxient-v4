import { describe, expect, it } from "vitest";
import { PricingMode, QuoteLineMode } from "@prisma/client";
import {
  parseLineItemWithPlanPayload,
  parseStageWithTasksPayload,
  parseTaskOnlyPayload,
} from "@/server/phase3/template-payloads";

describe("template payload parsers", () => {
  it("parseLineItemWithPlanPayload accepts valid payload", () => {
    const p = parseLineItemWithPlanPayload({
      line: {
        title: "Install",
        customerDescription: "Scope text",
        quantity: 1,
        pricingMode: PricingMode.FIXED_PRICE,
        lineMode: QuoteLineMode.REQUIRED,
      },
      stages: [
        {
          title: "Stage 1",
          tasks: [{ title: "Task A", isRequired: true, customerVisible: false }],
        },
      ],
    });
    expect(p.line.title).toBe("Install");
    expect(p.stages[0]?.tasks[0]?.title).toBe("Task A");
  });

  it("parseLineItemWithPlanPayload rejects invalid payload", () => {
    expect(() => parseLineItemWithPlanPayload({})).toThrow();
  });

  it("parseStageWithTasksPayload accepts valid payload", () => {
    const p = parseStageWithTasksPayload({
      stage: { title: "Permit" },
      tasks: [{ title: "Submit", isRequired: false }],
    });
    expect(p.stage.title).toBe("Permit");
    expect(p.tasks[0]?.title).toBe("Submit");
  });

  it("parseStageWithTasksPayload rejects invalid payload", () => {
    expect(() => parseStageWithTasksPayload({ stage: {}, tasks: [] })).toThrow();
  });

  it("parseTaskOnlyPayload accepts valid payload", () => {
    const p = parseTaskOnlyPayload({
      task: { title: "Inspect", isRequired: true, customerVisible: true, customerLabel: "Walkthrough" },
    });
    expect(p.task.title).toBe("Inspect");
  });

  it("parseTaskOnlyPayload rejects invalid payload", () => {
    expect(() => parseTaskOnlyPayload({ task: {} })).toThrow();
  });
});
