import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Config } from "./config.js";

const execute = promisify(execFile);
function relayStorageEndpoint(endpoint: string | undefined): {
  endpoint?: string;
  localTest: boolean;
} {
  if (!endpoint) return { localTest: false };
  const url = new URL(endpoint);
  if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) {
    url.hostname = "host.docker.internal";
    return { endpoint: url.href, localTest: true };
  }
  return { endpoint, localTest: false };
}
export function runnerEnvironment(config: Config, encoded: string): Record<string, string> {
  if (!config.RUNNER_CALLBACK_SECRET || !config.RUNNER_CALLBACK_URL)
    throw new Error("Runner callback configuration required");
  const callback = new URL(config.RUNNER_CALLBACK_URL);
  if (!["http:", "https:"].includes(callback.protocol) || callback.username || callback.password)
    throw new Error("Invalid callback URL");
  const storage = relayStorageEndpoint(config.S3_ENDPOINT);
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    RUNNER_JOB_BASE64: encoded,
    RUNNER_CALLBACK_URL: callback.href,
    RUNNER_CALLBACK_SECRET: config.RUNNER_CALLBACK_SECRET,
    RUNNER_CALLBACK_LOCAL: callback.protocol === "http:" ? "1" : "0",
    ...(storage.endpoint ? { RUNNER_S3_ENDPOINT: storage.endpoint } : {}),
    ...(storage.localTest ? { RUNNER_S3_LOCAL_TEST: "1" } : {}),
    ...(config.S3_BUCKET ? { RUNNER_S3_BUCKET: config.S3_BUCKET } : {}),
    RUNNER_S3_REGION: config.S3_REGION,
    ...(config.S3_ACCESS_KEY_ID ? { AWS_ACCESS_KEY_ID: config.S3_ACCESS_KEY_ID } : {}),
    ...(config.S3_SECRET_ACCESS_KEY ? { AWS_SECRET_ACCESS_KEY: config.S3_SECRET_ACCESS_KEY } : {}),
    ...(process.env.DOCKER_HOST ? { DOCKER_HOST: process.env.DOCKER_HOST } : {}),
  };
}
export async function launchSandbox(config: Config, encoded: string) {
  if (!config.RUNNER_LOCAL_SANDBOX_ENABLED) throw new Error("LOCAL Docker sandbox is disabled");
  if (
    !config.S3_BUCKET ||
    !config.S3_ENDPOINT ||
    !config.S3_ACCESS_KEY_ID ||
    !config.S3_SECRET_ACCESS_KEY
  )
    throw new Error("LOCAL API execution requires private S3 storage for relayed evidence");
  const output = await mkdtemp(join(tmpdir(), "driftgate-runner-"));
  const project = `driftgate-runner-${randomUUID()}`;
  const script = fileURLToPath(new URL("../../runner/docker/run-local.sh", import.meta.url));
  const compose = fileURLToPath(new URL("../../runner/docker/compose.yml", import.meta.url));
  const env = {
    ...runnerEnvironment(config, encoded),
    RUNNER_LOCAL_OUTPUT: output,
    COMPOSE_PROJECT_NAME: project,
  };
  try {
    await new Promise<void>((resolve, reject) => {
      // Compose gives the browser network_mode:none and no credentials. A separate
      // relay starts only after the browser exits to upload evidence and callbacks.
      const child = spawn("sh", [script], {
        env,
        stdio: "inherit",
        timeout: config.RUN_TIMEOUT_MS,
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`Sandbox execution exited ${code}`)),
      );
    });
  } finally {
    await execute(
      "docker",
      ["compose", "-f", compose, "--profile", "control", "down", "--volumes", "--remove-orphans"],
      { env, timeout: 30000 },
    ).catch(() => undefined);
  }
}
