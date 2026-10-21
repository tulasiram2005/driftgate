import { chromium, firefox, webkit } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { allowedRequest, robotsAllows, type NetworkConfig } from "./network.js";
import { runCheck } from "./catalog.js";
import { QualityCheckError } from "./quality.js";
import { resultStatus, type Attempt, type Job } from "./schema.js";
import type { EvidenceStore } from "./storage.js";

export async function execute(
  job: Job,
  network: NetworkConfig,
  store: EvidenceStore,
  emit: (event: unknown) => Promise<void>,
): Promise<void> {
  const statuses: string[] = [];
  for (const cell of job.matrix) {
    const browser = await { chromium, firefox, webkit }[cell.browser].launch({
      headless: true,
      ...(network.proxy ? { proxy: { server: network.proxy } } : {}),
    });
    try {
      for (const check of job.checks) {
        const attempts: Attempt[] = [];
        for (let n = 1; n <= job.retries + 1; n++) {
          const directory = await mkdtemp(join(tmpdir(), "driftgate-runner-"));
          const context = await browser.newContext({
            viewport:
              cell.device === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 900 },
            ...(cell.browser !== "firefox" ? { isMobile: cell.device === "mobile" } : {}),
            hasTouch: cell.device === "mobile",
            serviceWorkers: "block",
            acceptDownloads: false,
            recordVideo: { dir: directory },
            userAgent: "DriftGateRunner/1.0",
          });
          const attempt: Attempt = { attempt: n, status: "passed", durationMs: 0, evidence: [] };
          const started = Date.now();
          let requests = 0;
          let violation = false;
          let robotsApproved = network.local;
          let tail = Promise.resolve();
          const base = `runs/${job.runId}/${cell.browser}-${cell.device}/${check}/${n}`;
          try {
            await context.route("**/*", async (route) => {
              const request = route.request();
              const permitted =
                allowedRequest(request.url(), request.method(), network.origin) &&
                ++requests <= 120 &&
                request.redirectedFrom() === null &&
                (robotsApproved || request.url() === `${network.origin}/robots.txt`);
              if (!permitted) {
                violation = true;
                await route.abort();
                return;
              }
              tail = tail.then(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
              await tail;
              await route.continue();
            });
            await context.routeWebSocket("**/*", (socket) => {
              violation = true;
              socket.close();
            });
            await context.tracing.start({ screenshots: true, snapshots: true });
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            if (!network.local) {
              const response = await page.goto(`${network.origin}/robots.txt`, { timeout: 10000 });
              if (
                response?.status() !== 200 ||
                !robotsAllows((await response.text()).slice(0, 65537))
              )
                throw new Error("Robots policy denied");
              robotsApproved = true;
            }
            try {
              await runCheck(page, check, network.origin, job.environment);
              if (violation) throw new Error("Network policy violation");
            } catch (error) {
              attempt.status = "failed";
              attempt.error =
                error instanceof QualityCheckError
                  ? error.message.slice(0, 2000)
                  : "Fixed check failed or network policy denied";
            }
            await page.screenshot({ path: join(directory, "screenshot.png"), timeout: 10000 });
            await context.tracing.stop({ path: join(directory, "trace.zip") });
            const video = page.video();
            await context.close();
            attempt.evidence.push(
              await store.put(
                join(directory, "screenshot.png"),
                `${base}/screenshot.png`,
                "screenshot",
              ),
            );
            attempt.evidence.push(
              await store.put(join(directory, "trace.zip"), `${base}/trace.zip`, "trace"),
            );
            if (video)
              attempt.evidence.push(
                await store.put(await video.path(), `${base}/video.webm`, "video"),
              );
          } finally {
            await context.close();
            await rm(directory, { recursive: true, force: true });
          }
          attempt.durationMs = Date.now() - started;
          attempts.push(attempt);
          if (attempt.status === "passed") break;
        }
        const status = resultStatus(attempts);
        statuses.push(status);
        await emit({
          version: 1,
          eventId: randomUUID(),
          runId: job.runId,
          type: "result",
          result: { checkId: check, ...cell, status, attempts },
        });
      }
    } finally {
      await browser.close();
    }
  }
  await emit({
    version: 1,
    eventId: randomUUID(),
    runId: job.runId,
    type: "completed",
    status: statuses.includes("failed")
      ? "failed"
      : statuses.includes("flaky")
        ? "flaky"
        : "passed",
    resultCount: statuses.length,
  });
}
