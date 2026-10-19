import { parseJob } from "./schema.js";
import { networkConfig } from "./network.js";
import { createStore } from "./storage.js";
import { callback } from "./callback.js";
import { execute } from "./execute.js";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

try {
  const encoded = process.env.RUNNER_JOB_BASE64 ?? process.argv[2] ?? "";
  if (!encoded || encoded.length > 16384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
    throw new Error("Invalid base64 job");
  const job = parseJob(JSON.parse(Buffer.from(encoded, "base64").toString("utf8")));
  const network = await networkConfig(process.env);
  const url = process.env.RUNNER_CALLBACK_URL ?? "";
  const secret = process.env.RUNNER_CALLBACK_SECRET ?? "";
  const spool = process.env.RUNNER_SPOOL_DIR;
  if (spool && !network.local) throw new Error("Spooling is local only");
  if (!spool && (!url || Buffer.byteLength(secret) < 32))
    throw new Error("Callback configuration required");
  let eventNumber = 0;
  if (spool) await mkdir(spool, { recursive: true });
  const store = await createStore(process.env, network.local);
  const deadline = setTimeout(
    () => {
      process.stderr.write("Runner deadline exceeded\n");
      process.exit(1);
    },
    20 * 60 * 1000,
  );
  try {
    await execute(job, network, store, async (event) => {
      if (spool) {
        await writeFile(
          join(spool, `${String(++eventNumber).padStart(3, "0")}.json`),
          JSON.stringify(event),
          { flag: "wx", mode: 0o600 },
        );
      } else await callback(url, secret, event, network.local);
    });
  } finally {
    clearTimeout(deadline);
  }
} catch {
  console.error(
    "Runner failed; check job, isolation, browser, storage and callback configuration.",
  );
  process.exitCode = 1;
}
