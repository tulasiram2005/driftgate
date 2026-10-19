import { defineConfig, devices } from "@playwright/test";

const external = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: external ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  ...(external
    ? {}
    : {
        webServer: {
          command: "pnpm exec next start --port 3100",
          url: "http://127.0.0.1:3100",
          reuseExistingServer: !process.env.CI,
        },
      }),
});
