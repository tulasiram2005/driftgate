import { constants } from "node:fs";
import { open, readdir, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { callback } from "./callback.js";
import { createStore, safeKey } from "./storage.js";
import { parseJob } from "./schema.js";

// This process runs only after the browser container exits. It has no browser.
const job = parseJob(
  JSON.parse(Buffer.from(process.env.RUNNER_JOB_BASE64 ?? "", "base64").toString("utf8")),
);
const spool = process.env.RUNNER_SPOOL_DIR ?? "/spool";
const root = await realpath(process.env.RUNNER_EVIDENCE_DIR ?? "/evidence");
const files = (await readdir(spool)).filter((name) => /^\d{3}\.json$/.test(name)).sort();
if (files.length !== job.checks.length * job.matrix.length + 1)
  throw new Error("Invalid spool length");
const events = [];
for (const file of files) {
  const handle = await open(
    resolve(spool, file),
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error("Invalid spool event file");
    const event = JSON.parse(await handle.readFile("utf8"));
    if (event.runId !== job.runId || event.version !== 1) throw new Error("Spool job mismatch");
    if (file === files.at(-1)) {
      if (event.type !== "completed" || event.resultCount !== files.length - 1)
        throw new Error("Incomplete runner spool");
    } else {
      if (event.type !== "result") throw new Error("Expected runner result");
      const { browser, device, checkId, attempts } = event.result;
      if (
        !job.checks.includes(checkId) ||
        !job.matrix.some((cell) => cell.browser === browser && cell.device === device)
      )
        throw new Error("Unexpected runner result");
      for (const attempt of attempts) {
        if (
          !Number.isInteger(attempt.attempt) ||
          attempt.attempt < 1 ||
          attempt.attempt > job.retries + 1
        )
          throw new Error("Invalid attempt");
        const prefix = `runs/${job.runId}/${browser}-${device}/${checkId}/${attempt.attempt}/`;
        for (const evidence of attempt.evidence) {
          safeKey(evidence.key);
          if (!evidence.key.startsWith(prefix))
            throw new Error("Evidence outside dispatched result");
        }
      }
    }
    events.push(event);
  } finally {
    await handle.close();
  }
}
const remote = process.env.RUNNER_S3_BUCKET ? await createStore(process.env, false) : undefined;
for (const event of events) {
  if (event.type === "result") {
    for (const attempt of event.result.attempts) {
      for (const evidence of attempt.evidence) {
        const path = await realpath(resolve(root, evidence.key));
        if (!path.startsWith(root + sep)) throw new Error("Evidence escapes root");
        if (remote) await remote.put(path, evidence.key, evidence.kind);
      }
    }
  }
  await callback(
    process.env.RUNNER_CALLBACK_URL ?? "",
    process.env.RUNNER_CALLBACK_SECRET ?? "",
    event,
    process.env.RUNNER_CALLBACK_LOCAL === "1",
  );
}
