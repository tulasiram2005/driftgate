import { createHash } from "node:crypto";
import { z } from "zod";

export const READINESS_POLICY = "mvp-2";
const maxAgeMs = 24 * 60 * 60 * 1000;
const count = z.number().int().min(0).max(1000000);
const reference = z.string().min(1).max(100);
const observation = {
  sourceIds: z.array(reference).min(1).max(1000),
  observedAt: z.string().datetime(),
};
const rate = z
  .object({ ...observation, passed: count, total: count })
  .strict()
  .refine((value) => value.passed <= value.total, "Passed count exceeds total");
const defects = z
  .object({
    ...observation,
    items: z
      .array(
        z
          .object({
            id: reference,
            revision: count,
            severity: z.enum(["S1", "S2", "S3", "S4"]),
            status: z.enum(["NEW", "OPEN", "IN_PROGRESS", "FIXED", "RETEST", "CLOSED", "REOPENED"]),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict();
export const readinessEvidence = z
  .object({
    projectId: reference,
    environment: z.enum(["STAGING", "UAT", "PREPROD", "PROD"]),
    criticalTests: rate.nullable(),
    defects: defects.nullable(),
    drift: z
      .object({ ...observation, unresolved: count })
      .strict()
      .nullable(),
    visual: z
      .object({ ...observation, reviewed: count, total: count })
      .strict()
      .refine((value) => value.reviewed <= value.total, "Reviewed count exceeds total")
      .nullable(),
    accessibility: rate.nullable(),
  })
  .strict();
export type ReadinessEvidence = z.infer<typeof readinessEvidence>;
type Component = { name: string; weight: number; points: number | null; reason: string | null };

// Canonical object keys bind evidence independently of JSON property insertion order.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/** Trusted server-side evidence only. Never accept client-supplied passing counts for sign-off. */
export function evaluateReadiness(input: unknown, now = new Date()) {
  const evidence = readinessEvidence.parse(input);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid evaluation time");
  const components: Component[] = [];
  const blocks: string[] = [];
  function add(
    name: string,
    weight: number,
    sample: { observedAt: string } | null,
    fraction: number | null,
  ) {
    let reason: string | null = null;
    if (!sample) reason = "MISSING_EVIDENCE";
    else if (Date.parse(sample.observedAt) > now.getTime()) reason = "FUTURE_EVIDENCE";
    else if (now.getTime() - Date.parse(sample.observedAt) > maxAgeMs) reason = "STALE_EVIDENCE";
    else if (fraction === null) reason = "EMPTY_SAMPLE";
    components.push({ name, weight, points: reason ? null : weight * fraction!, reason });
  }
  const critical = evidence.criticalTests;
  add("criticalTests", 40, critical, critical?.total ? critical.passed / critical.total : null);
  if (critical && critical.passed < critical.total) blocks.push("CRITICAL_TEST_FAILURE");
  const open = evidence.defects?.items.filter((item) => item.status !== "CLOSED") ?? [];
  if (open.some((item) => item.severity === "S1")) blocks.push("OPEN_S1_DEFECT");
  add(
    "defects",
    25,
    evidence.defects,
    open.some((item) => ["S1", "S2"].includes(item.severity)) ? 0 : 1,
  );
  add("drift", 15, evidence.drift, evidence.drift?.unresolved === 0 ? 1 : 0);
  const visual = evidence.visual;
  if (visual && visual.reviewed < visual.total) blocks.push("UNREVIEWED_VISUAL_DIFFERENCES");
  // An executed comparison with no differences is reviewed by definition, not missing.
  add("visual", 10, visual, visual ? (visual.total ? visual.reviewed / visual.total : 1) : null);
  const accessibility = evidence.accessibility;
  add(
    "accessibility",
    10,
    accessibility,
    accessibility?.total ? accessibility.passed / accessibility.total : null,
  );
  if (accessibility && accessibility.passed < accessibility.total)
    blocks.push("ACCESSIBILITY_FAILURE");
  const unknown = components.some((component) => component.points === null);
  const earnedPoints = components.reduce((sum, component) => sum + (component.points ?? 0), 0);
  const score = unknown ? null : Math.floor(earnedPoints * 100) / 100;
  if (unknown) blocks.push("INCOMPLETE_EVIDENCE");
  if (score !== null && score < 90) blocks.push("BELOW_THRESHOLD");
  return {
    policyVersion: READINESS_POLICY,
    assessedAt: now.toISOString(),
    excluded: ["performance"] as const,
    threshold: 90,
    score,
    components,
    blockers: blocks,
    eligible: blocks.length === 0,
    evidenceHash: createHash("sha256")
      .update(canonical({ policy: READINESS_POLICY, evidence }))
      .digest("hex"),
  };
}
