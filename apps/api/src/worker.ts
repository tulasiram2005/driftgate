import { Queue, Worker } from "bullmq";
import { PrismaClient } from "../generated/client/index.js";
import { readConfig } from "./config.js";
import { launchSandbox } from "./sandbox.js";

const config = readConfig();
if (!config.REDIS_URL || !config.RUNNER_CALLBACK_SECRET)
  throw new Error("Worker requires REDIS_URL and RUNNER_CALLBACK_SECRET");
const redis = new URL(config.REDIS_URL);
const connection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: decodeURIComponent(redis.password) || undefined,
  ...(redis.protocol === "rediss:" ? { tls: {} } : {}),
  maxRetriesPerRequest: null,
};
const db = new PrismaClient();
const queue = new Queue("driftgate-runs", { connection });
let stopping = false;
const worker = new Worker(
  "driftgate-runs",
  async (job) => {
    const run = await db.run.findUnique({
      where: { id: String(job.data.runId) },
      include: { outbox: true },
    });
    if (!run || !["QUEUED", "RUNNING"].includes(run.status) || !run.outbox) return;
    // Reload the authoritative payload. Redis does not supply targets or credentials.
    const encoded = Buffer.from(JSON.stringify(run.outbox.payload)).toString("base64");
    if (run.dispatch === "GITHUB") {
      if (!config.GITHUB_REPOSITORY || !config.GITHUB_TOKEN)
        throw new Error("GitHub dispatch is not configured");
      const response = await fetch(
        `https://api.github.com/repos/${config.GITHUB_REPOSITORY}/actions/workflows/${config.GITHUB_WORKFLOW}/dispatches`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(30000),
          headers: {
            Authorization: `Bearer ${config.GITHUB_TOKEN}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ ref: config.GITHUB_REF, inputs: { job: encoded } }),
        },
      );
      if (response.status !== 204) throw new Error(`GitHub dispatch failed: ${response.status}`);
    } else {
      await launchSandbox(config, encoded);
    }
  },
  { connection, concurrency: 1 },
);
worker.on("error", (error) => console.error("Execution worker error", error.message));
queue.on("error", (error) => console.error("Dispatch queue error", error.message));

async function tick() {
  const now = new Date();
  const pending = await db.dispatchOutbox.findMany({
    where: {
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "CLAIMED", leaseUntil: { lt: now } },
      ],
    },
    take: 50,
    orderBy: { availableAt: "asc" },
  });
  for (const row of pending) {
    const claim = await db.dispatchOutbox.updateMany({
      where: {
        id: row.id,
        OR: [{ status: "PENDING" }, { status: "CLAIMED", leaseUntil: { lt: now } }],
      },
      data: {
        status: "CLAIMED",
        leaseUntil: new Date(Date.now() + 60000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    try {
      await queue.add(
        "run",
        { runId: row.runId },
        {
          jobId: row.runId,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
      await db.dispatchOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", leaseUntil: null, lastError: null },
      });
    } catch {
      await db.dispatchOutbox.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          leaseUntil: null,
          lastError: "Queue delivery failed",
          availableAt: new Date(
            Date.now() + Math.min(60000, 1000 * 2 ** Math.min(row.attempts, 6)),
          ),
        },
      });
    }
  }
  const expired = await db.run.findMany({
    where: {
      mode: "AUTOMATED",
      status: { in: ["QUEUED", "RUNNING"] },
      createdAt: { lt: new Date(Date.now() - config.RUN_TIMEOUT_MS) },
    },
    select: { id: true },
    take: 100,
  });
  for (const run of expired)
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Run" WHERE id = ${run.id} FOR UPDATE`;
      const changed = await tx.run.updateMany({
        where: { id: run.id, status: { in: ["QUEUED", "RUNNING"] } },
        data: { status: "TIMED_OUT" },
      });
      if (changed.count)
        await tx.runEvent.create({ data: { runId: run.id, data: { status: "TIMED_OUT" } } });
    });
}
async function loop() {
  while (!stopping) {
    try {
      await tick();
    } catch {
      console.error("Outbox polling failed; retrying");
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
const polling = loop();
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    stopping = true;
    void polling
      .then(() => worker.close())
      .then(() => queue.close())
      .then(() => db.$disconnect());
  });
