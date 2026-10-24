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
  const automated = runs.filter((run) => run.mode === "AUTOMATED");
  if (complete && validRuns && automated.length) {
    const samples = results.filter(
      (result) =>
        result.caseId === "accessibility" && automated.some((run) => run.id === result.runId),
    );
    const covered = automated.every((run) => {
      const cells = results.filter((result) => result.runId === run.id);
      return (
        cells.length > 0 &&
        cells.every((cell) =>
          samples.some(
            (sample) =>
              sample.runId === run.id &&
              sample.browser === cell.browser &&
              sample.device === cell.device,
          ),
        )
      );
    });
    if (covered && samples.length <= 1000) {
      evidence.accessibility = {
        sourceIds: samples.map((sample) => sample.id),
        observedAt: new Date(
          Math.min(...automated.map((run) => run.createdAt.getTime())),
        ).toISOString(),
        total: samples.length,
        passed: samples.filter(
          (sample) =>
            sample.status === "PASS" &&
            !sample.flaky &&
            automated.find((run) => run.id === sample.runId)?.status === "PASS",
        ).length,
      };
    } else sourceProblems.push("ACCESSIBILITY_MATRIX_INCOMPLETE");
  }
  const screenshots = await db.evidence.findMany({
    where: { kind: "screenshot", result: { runId: { in: runs.map((run) => run.id) } } },
    orderBy: { id: "asc" },
    take: 301,
  });
  const visualComparisons = await db.visualComparison.findMany({
    where: { projectId, evidenceId: { in: screenshots.map((image) => image.id) } },
    include: { baseline: { include: { evidence: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1001,
  });
  const visualSources: unknown[] = [];
  if (
    complete &&
    validRuns &&
    runs.length &&
    screenshots.length > 0 &&
    screenshots.length <= 300 &&
    visualComparisons.length <= 1000 &&
    runs.every((run) =>
      screenshots.some((image) =>
        results.some((result) => result.id === image.resultId && result.runId === run.id),
      ),
    )
  ) {
    let valid = true,
      reviewed = 0;
    const dates: number[] = [],
      sourceIds: string[] = [];
    for (const image of screenshots) {
      const comparison = visualComparisons.find((item) => item.evidenceId === image.id);
      const result = results.find((item) => item.id === image.resultId);
      if (
        !image.ready ||
        !comparison ||
        !comparison.baseline.evidence.ready ||
        comparison.baseline.checkId !== result?.caseId ||
        comparison.baseline.browser !== result?.browser ||
        comparison.baseline.device !== result?.device ||
        !comparison.baseline.active ||
        comparison.baseline.status !== "APPROVED" ||
        comparison.baseline.environment.toUpperCase() !== environment ||
        comparison.ignoreRevision !== comparison.baseline.ignoreRevision
      ) {
        valid = false;
        break;
      }
      // Changed pixels are not silently accepted as reviewed. Explicit review is separate work.
      if (comparison.changedPixels === 0) reviewed++;
      dates.push(image.createdAt.getTime(), comparison.createdAt.getTime());
      sourceIds.push(comparison.id);
      visualSources.push({
        image: { id: image.id, ready: image.ready, createdAt: image.createdAt },
        comparison,
      });
    }
    if (valid)
      evidence.visual = {
        sourceIds,
        observedAt: new Date(Math.min(...dates)).toISOString(),
        reviewed,
        total: screenshots.length,
      };
    else sourceProblems.push("VISUAL_SOURCE_MISSING_OR_CHANGED");
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
          visualSources,
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
    notCollected: [],
  };
}
