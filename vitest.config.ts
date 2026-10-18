import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["scripts/check-runtime.mjs"],
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage/tooling",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
