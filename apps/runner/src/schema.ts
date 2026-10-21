export const checks = [
  "catalogue",
  "product",
  "cart",
  "api-contract",
  "accessibility",
  "snapshot",
] as const;
export type CheckId = (typeof checks)[number];
export type BrowserId = "chromium" | "firefox" | "webkit";
export type DeviceId = "desktop" | "mobile";
export interface Job {
  version: 1;
  runId: string;
  environment: "staging" | "uat" | "preprod" | "prod";
  targetId: "threadline";
  checks: CheckId[];
  matrix: { browser: BrowserId; device: DeviceId }[];
  retries: number;
}
export function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected object");
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key))) throw new Error("Unknown field");
  return result;
}
export function parseJob(value: unknown): Job {
  const j = record(value, [
    "version",
    "runId",
    "environment",
    "targetId",
    "checks",
    "matrix",
    "retries",
  ]);
  if (
    j.version !== 1 ||
    typeof j.runId !== "string" ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(j.runId) ||
    j.targetId !== "threadline" ||
    !["staging", "uat", "preprod", "prod"].includes(String(j.environment))
  )
    throw new Error("Invalid job identity");
  if (
    !Array.isArray(j.checks) ||
    !j.checks.length ||
    j.checks.length > checks.length ||
    new Set(j.checks).size !== j.checks.length ||
    j.checks.some((c) => !checks.includes(c))
  )
    throw new Error("Invalid checks");
  if (!Array.isArray(j.matrix) || !j.matrix.length || j.matrix.length > 9)
    throw new Error("Invalid matrix");
  for (const cell of j.matrix) {
    const c = record(cell, ["browser", "device"]);
    if (
      !["chromium", "firefox", "webkit"].includes(String(c.browser)) ||
      !["desktop", "mobile"].includes(String(c.device))
    )
      throw new Error("Invalid matrix cell");
  }
  if (
    new Set(j.matrix.map((c: { browser: string; device: string }) => `${c.browser}-${c.device}`))
      .size !== j.matrix.length
  )
    throw new Error("Duplicate matrix cell");
  if (!Number.isInteger(j.retries) || Number(j.retries) < 0 || Number(j.retries) > 2)
    throw new Error("Invalid retries");
  return j as unknown as Job;
}
export interface Evidence {
  kind: "screenshot" | "video" | "trace";
  key: string;
  contentType: string;
  size: number;
}
export interface Attempt {
  attempt: number;
  status: "passed" | "failed";
  durationMs: number;
  error?: string;
  evidence: Evidence[];
}
export function resultStatus(attempts: Attempt[]): "passed" | "failed" | "flaky" {
  if (!attempts.length) throw new Error("Missing attempts");
  return attempts.at(-1)?.status === "failed"
    ? "failed"
    : attempts.some((a) => a.status === "failed")
      ? "flaky"
      : "passed";
}
