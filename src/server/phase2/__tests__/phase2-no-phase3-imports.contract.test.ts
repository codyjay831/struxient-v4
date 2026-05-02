import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 2 customer preview / readiness / send must remain decoupled from Phase 3 template modules.
 */
describe("Phase 2 modules do not import Phase 3", () => {
  const phase2Dir = join(__dirname, "..");
  const files = ["customer-preview.ts", "quote-readiness.ts", "quote-mutations.ts"] as const;

  it.each(files)("%s has no phase3 imports", (name) => {
    const src = readFileSync(join(phase2Dir, name), "utf8");
    expect(src).not.toMatch(/@\/server\/phase3\b/);
    expect(src).not.toMatch(/from\s+["'].*\/phase3\//);
  });
});
