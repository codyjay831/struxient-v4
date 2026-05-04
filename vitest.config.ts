import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    include: [
      "src/**/*.integration.test.ts",
      "src/server/email/**/*.test.ts",
      "src/server/phase2/__tests__/*.test.ts",
      "src/server/phase6/work-station-feed.test.ts",
      "src/server/phase7/__tests__/*.integration.test.ts",
      "src/server/phase8/__tests__/*.test.ts",
      "src/server/phase9/__tests__/*.integration.test.ts",
      "src/server/phase11/__tests__/*.test.ts",
      "src/server/phase3/__tests__/template-payloads.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
