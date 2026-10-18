import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
