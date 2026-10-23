import { describe, expect, it } from "vitest";
import { evaluateReadiness, type ReadinessEvidence } from "../src/readiness.js";

const now = new Date("2026-10-23T12:00:00Z");
function fixture(): ReadinessEvidence {
  const observed = { sourceIds: ["demo-run-1"], observedAt: "2026-10-23T11:00:00Z" };
  return {
    projectId: "demo-project",
    environment: "UAT",
    criticalTests: { ...observed, passed: 10, total: 10 },
    defects: { ...observed, items: [] },
    drift: { ...observed, unresolved: 0 },
    visual: { ...observed, reviewed: 2, total: 2 },
    accessibility: { ...observed, passed: 3, total: 3 },
  };
}
describe("versioned MVP readiness", () => {
  it("awards 100 only for complete passing evidence and explicitly excludes performance", () => {
    const result = evaluateReadiness(fixture(), now);
    expect(result).toMatchObject({
      score: 100,
      eligible: true,
      policyVersion: "mvp-1",
      excluded: ["performance"],
      blockers: [],
    });
    expect(result.components.map((item) => item.weight)).toEqual([40, 25, 15, 10, 10]);
  });
  for (const field of ["criticalTests", "defects", "drift", "visual", "accessibility"] as const) {
    it(`never passes missing, stale or future ${field}`, () => {
      for (const observedAt of [null, "2026-10-22T11:59:59Z", "2026-10-23T12:00:01Z"]) {
        const input = fixture();
        if (observedAt === null) input[field] = null;
        else input[field]!.observedAt = observedAt;
        const result = evaluateReadiness(input, now);
        expect(result.score).toBeNull();
        expect(result.eligible).toBe(false);
        expect(result.blockers).toContain("INCOMPLETE_EVIDENCE");
      }
    });
  }
  it("treats fixed and retest S1 defects as open until QA closes them", () => {
    for (const status of ["NEW", "OPEN", "IN_PROGRESS", "FIXED", "RETEST", "REOPENED"] as const) {
      const input = fixture();
      input.defects!.items = [{ id: "demo-defect", revision: 1, severity: "S1", status }];
      expect(evaluateReadiness(input, now).blockers).toContain("OPEN_S1_DEFECT");
      input.defects!.items[0]!.status = "CLOSED";
      expect(evaluateReadiness(input, now).eligible).toBe(true);
    }
  });
  it("deducts S2 and unresolved drift weights", () => {
    const input = fixture();
    input.defects!.items = [{ id: "demo-defect", revision: 0, severity: "S2", status: "OPEN" }];
    input.drift!.unresolved = 1;
    expect(evaluateReadiness(input, now)).toMatchObject({ score: 60, eligible: false });
  });
  it("blocks critical and accessibility failures even above the score threshold", () => {
    for (const field of ["criticalTests", "accessibility"] as const) {
      const input = fixture();
      input[field] = { ...input[field]!, passed: 99, total: 100 };
      expect(evaluateReadiness(input, now).score).toBeGreaterThan(90);
      expect(evaluateReadiness(input, now).eligible).toBe(false);
    }
  });
  it("distinguishes empty tests from an executed visual comparison with zero differences", () => {
    const input = fixture();
    input.visual = { ...input.visual!, reviewed: 0, total: 0 };
    expect(evaluateReadiness(input, now).eligible).toBe(true);
    input.criticalTests = { ...input.criticalTests!, passed: 0, total: 0 };
    expect(evaluateReadiness(input, now).score).toBeNull();
  });
  it("binds project, environment, revisions and sources without depending on object key order", () => {
    const input = fixture();
    const hash = evaluateReadiness(input, now).evidenceHash;
    expect(
      evaluateReadiness(Object.fromEntries(Object.entries(input).reverse()), now).evidenceHash,
    ).toBe(hash);
    const mutations = [
      { ...input, projectId: "other" },
      { ...input, environment: "PROD" },
      { ...input, criticalTests: { ...input.criticalTests!, sourceIds: ["other-run"] } },
      {
        ...input,
        defects: {
          ...input.defects!,
          items: [{ id: "d", revision: 1, severity: "S1", status: "CLOSED" }],
        },
      },
    ];
    for (const changed of mutations)
      expect(evaluateReadiness(changed, now).evidenceHash).not.toBe(hash);
  });
  it("rejects impossible counts and arbitrary policy overrides", () => {
    const input = fixture();
    expect(() => evaluateReadiness({ ...input, threshold: 0 }, now)).toThrow();
    for (const passed of [-1, 11, 0.5, Infinity])
      expect(() =>
        evaluateReadiness({ ...input, criticalTests: { ...input.criticalTests!, passed } }, now),
      ).toThrow();
    expect(() => evaluateReadiness(input, new Date(NaN))).toThrow();
  });
});
