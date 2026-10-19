import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/lib/cart.ts", "src/lib/flags.ts", "src/lib/products.ts", "src/lib/errors.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "/tmp/threadline-backend-coverage",
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
