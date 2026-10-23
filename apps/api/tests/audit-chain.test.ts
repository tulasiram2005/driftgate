import { expect, it } from "vitest";
import { appendAuditRecord, verifyAuditChain, type AuditPayload } from "../src/audit-chain.js";

const payload: AuditPayload = {
  projectId: "demo-project",
  releaseId: "demo-release",
  gateId: "demo-gate",
  actorId: "demo-approver",
  actorName: "Demo Approver",
  action: "APPROVED",
  comment: "Reviewed evidence",
  timestamp: "2026-10-23T12:00:00Z",
  policyVersion: "mvp-1",
  evidenceHash: "a".repeat(64),
  gateRevision: 1,
};
function fixture() {
  const first = appendAuditRecord(payload, null);
  const second = appendAuditRecord(
    { ...payload, action: "REVOKED", comment: "New defect", timestamp: "2026-10-23T13:00:00Z" },
    first,
  );
  return {
    rows: [first, second],
    head: {
      projectId: payload.projectId,
      releaseId: payload.releaseId,
      count: 2,
      headHash: second.hash,
    },
  };
}
it("verifies approvals and revocations with an anchored head", () => {
  const { rows, head } = fixture();
  expect(verifyAuditChain(rows, head)).toMatchObject({ valid: true, count: 2 });
  expect(rows[1]!.previousHash).toBe(rows[0]!.hash);
});
it("detects each signed payload field changing", () => {
  const replacements = {
    projectId: "other",
    releaseId: "other",
    gateId: "other",
    actorId: "other",
    actorName: "Other",
    action: "REVOKED",
    comment: "Changed",
    timestamp: "2026-10-23T12:01:00Z",
    policyVersion: "other",
    evidenceHash: "b".repeat(64),
    gateRevision: 2,
  };
  for (const [key, value] of Object.entries(replacements)) {
    const { rows, head } = fixture();
    Object.assign(rows[0]!.payload, { [key]: value });
    expect(verifyAuditChain(rows, head).valid).toBe(false);
  }
});
it("detects deletion, reordering, duplication and tail truncation", () => {
  const { rows, head } = fixture();
  for (const changed of [
    [],
    rows.slice(0, 1),
    rows.slice(1),
    [...rows].reverse(),
    [rows[0], rows[0]],
  ])
    expect(verifyAuditChain(changed, head).valid).toBe(false);
});
it("rejects tampered predecessors, cross-release append and backwards time", () => {
  const { rows } = fixture();
  expect(() => appendAuditRecord(payload, { ...rows[0]!, hash: "b".repeat(64) })).toThrow();
  expect(() => appendAuditRecord({ ...payload, releaseId: "other" }, rows[0]!)).toThrow();
  expect(() =>
    appendAuditRecord({ ...payload, timestamp: "2026-10-22T12:00:00Z" }, rows[0]!),
  ).toThrow();
});
it("rejects malformed evidence, empty comments and unrecognized payload fields", () => {
  for (const changed of [
    { evidenceHash: "bad" },
    { comment: " " },
    { actorName: "" },
    { extra: true },
    { gateRevision: -1 },
  ])
    expect(() => appendAuditRecord({ ...payload, ...changed }, null)).toThrow();
});
it("verifies an explicitly empty chain but not a missing nonempty chain", () => {
  const { head } = fixture();
  expect(verifyAuditChain([], { ...head, count: 0, headHash: null }).valid).toBe(true);
  expect(verifyAuditChain([], head).valid).toBe(false);
  expect(verifyAuditChain("not a chain", head).valid).toBe(false);
});
it("uses deterministic hashing independent of object field insertion order", () => {
  expect(appendAuditRecord(Object.fromEntries(Object.entries(payload).reverse()), null)).toEqual(
    appendAuditRecord(payload, null),
  );
});
