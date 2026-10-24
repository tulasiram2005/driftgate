import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "../generated/client/index.js";
import { evaluateReadiness, type ReadinessEvidence } from "./readiness.js";

/** Called inside a repeatable-read transaction so bindings and sources agree. */
export async function collectReleaseReadiness(
  db: Prisma.TransactionClient,
  projectId: string,
  releaseId: string,
  environment: ReadinessEvidence["environment"],
) {
  const gate = await db.releaseGate.findFirst({
    where: { releaseId, environment, release: { projectId } },
  });
  if (!gate) return null;
  const now = new Date();
  const runs = await db.run.findMany({
    where: { projectId, id: { in: gate.runIds } },
    orderBy: { id: "asc" },
  });
  const validRuns =
    runs.length === gate.runIds.length &&
    runs.every((run) => run.environment.toUpperCase() === environment);
  const cases = await db.testCase.findMany({
    where: { projectId, archived: false, priority: "HIGH" },
    orderBy: { id: "asc" },
    take: 501,
  });
  const results = await db.result.findMany({
    where: { runId: { in: runs.map((run) => run.id) } },
    orderBy: { id: "asc" },
    take: 10001,
  });
  const defects = await db.defect.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
    take: 10001,
  });
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { createdAt: true, expectedRulesRevision: true },
  });
  const complete = cases.length <= 500 && results.length <= 10000 && defects.length <= 10000;
  const sourceProblems: string[] = [];
  if (!validRuns) sourceProblems.push("RUN_MISSING_OR_ENVIRONMENT_CHANGED");
  if (!complete) sourceProblems.push("EVIDENCE_LIMIT_EXCEEDED");
  const evidence: ReadinessEvidence = {
    projectId,
    environment,
    criticalTests: null,
    defects: null,
    drift: null,
    visual: null,
    accessibility: null,
  };
  if (complete && validRuns && runs.length) {
    const passed = cases.filter((testCase) => {
      const samples = results.filter((result) => result.caseId === testCase.id);
      return (
        samples.length > 0 &&
        samples.every((sample) => {
          const run = runs.find((item) => item.id === sample.runId)!;
          return (
            sample.version === testCase.version &&
            sample.status === "PASS" &&
            !sample.flaky &&
            (run.mode === "MANUAL" || run.status === "PASS")
          );
        })
      );
    }).length;
    evidence.criticalTests = {
      sourceIds: [
        ...runs.map((run) => run.id),
        ...cases.map((item) => `${item.id}:${item.version}`),
      ],
      // Run creation is a conservative source timestamp, never evaluation time.
      observedAt: new Date(Math.min(...runs.map((run) => run.createdAt.getTime()))).toISOString(),
      passed,
      total: cases.length,
    };
  }
  if (complete)
    evidence.defects = {
      sourceIds: [projectId],
      observedAt: new Date(
        Math.max(project.createdAt.getTime(), ...defects.map((item) => item.updatedAt.getTime())),
      ).toISOString(),
      items: defects.map(({ id, revision, severity, status }) => ({
        id,
        revision,
        severity,
        status,
      })) as NonNullable<ReadinessEvidence["defects"]>["items"],
    };
  const snapshots = await db.environmentSnapshot.findMany({
    where: { projectId, runId: { in: runs.map((run) => run.id) } },
    orderBy: { id: "asc" },
    take: 301,
  });
  const comparisons = await db.environmentComparison.findMany({
    where: { projectId, afterId: { in: snapshots.map((snapshot) => snapshot.id) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1001,
  });
  const before = await db.environmentSnapshot.findMany({
    where: { projectId, id: { in: comparisons.map((comparison) => comparison.beforeId) } },
  });
  const driftSources: unknown[] = [];
  if (
    validRuns &&
    runs.length &&
    snapshots.length > 0 &&
    snapshots.length <= 300 &&
    comparisons.length <= 1000 &&
    runs.every((run) => snapshots.some((snapshot) => snapshot.runId === run.id))
  ) {
    let unresolved = 0;
    const dates: number[] = [];
    const sources: string[] = [];
    let valid = true;
    for (const snapshot of snapshots) {
      const comparison = comparisons.find((item) => item.afterId === snapshot.id);
      const baseline = before.find((item) => item.id === comparison?.beforeId);
      const findings = z
        .array(z.object({ expected: z.boolean() }).passthrough())
        .max(10000)
        .safeParse(comparison?.findings);
      if (
        !comparison ||
        !baseline ||
        snapshot.environment.toUpperCase() !== environment ||
        baseline.environment.toUpperCase() === environment ||
        comparison.rulesRevision !== project.expectedRulesRevision ||
        !findings.success ||
        comparison.findingCount !== findings.data.length
      ) {
        valid = false;
        break;
      }
      unresolved += findings.data.filter((finding) => !finding.expected).length;
      dates.push(
        snapshot.createdAt.getTime(),
        baseline.createdAt.getTime(),
        comparison.createdAt.getTime(),
      );
      sources.push(comparison.id);
      driftSources.push({ comparison, snapshot, baseline });
    }
    if (valid)
      evidence.drift = {
        sourceIds: sources,
        observedAt: new Date(Math.min(...dates)).toISOString(),
        unresolved,
      };
    else sourceProblems.push("DRIFT_SOURCE_MISSING_OR_CHANGED");
  }
  const assessment = evaluateReadiness(evidence, now);
  return {
    gateId: gate.id,
    gateRevision: gate.revision,
    evidence,
    sourceProblems,
    ...assessment,
    // Bind the release and selection revision, not just aggregate component scores.
    evidenceHash: createHash("sha256")
      .update(
        JSON.stringify({
          releaseId,
          gateId: gate.id,
          revision: gate.revision,
          driftSources,
          runIds: [...gate.runIds].sort(),
          results: results.map(
            ({ id, runId, caseId, version, status, flaky, browser, device }) => ({
              id,
              runId,
              caseId,
              version,
              status,
              flaky,
              browser,
              device,
            }),
          ),
          runs: runs.map(({ id, status, createdAt, environment }) => ({
            id,
            status,
            createdAt,
            environment,
          })),
          evidenceHash: assessment.evidenceHash,
        }),
      )
      .digest("hex"),
    notCollected: ["visual", "accessibility"],
  };
}
