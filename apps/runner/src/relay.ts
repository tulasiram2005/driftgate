import { readFile, readdir, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { callback } from "./callback.js";
import { createStore, safeKey } from "./storage.js";
import { checks } from "./schema.js";

// This process runs only after the browser container exits. It has no browser.
const spool = process.env.RUNNER_SPOOL_DIR ?? "/spool";
const root = await realpath(process.env.RUNNER_EVIDENCE_DIR ?? "/evidence");
const files = (await readdir(spool)).filter((name) => /^\d{3}\.json$/.test(name)).sort();
if (!files.length || files.length > checks.length * 9 + 1) throw new Error("Invalid spool length");
const events = [];
for (const file of files) {
  const text = await readFile(resolve(spool, file), "utf8");
  if (text.length > 1024 * 1024) throw new Error("Spool event too large");
  events.push(JSON.parse(text));
}
if (events.at(-1)?.type !== "completed") throw new Error("Incomplete runner spool");
const remote = process.env.RUNNER_S3_BUCKET ? await createStore(process.env, false) : undefined;
for (const event of events) {
  if (event.type === "result") {
    for (const attempt of event.result.attempts) {
      for (const evidence of attempt.evidence) {
        safeKey(evidence.key);
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
