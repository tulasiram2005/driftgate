import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/app.ts", "src/config.ts", "src/contracts.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { statements: 80, lines: 80, functions: 80, branches: 65 },
    },
  },
});
