import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { signoffHash, verifySignoffs } from "../src/release-signoffs.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
)
  throw new Error("Isolated local driftgate_test database required");
const db = new PrismaClient({ datasources: { db: { url } } });
const app = createApp(
  db,
  readConfig({
    NODE_ENV: "test",
    DATABASE_URL: url,
    JWT_SECRET: "test-only-secret-".repeat(5),
    API_CORS_ORIGINS: "http://127.0.0.1:3100",
  }),
);
const users: Record<string, { id: string; token: string }> = {};
const projects: string[] = [];
const runs: string[] = [];
const auth = (role = "ADMIN") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = (project = projects[0]) => `/api/v1/projects/${project}/releases`;

it("signs exact evidence in order, detects tampering and invalidates downstream approvals", async () => {
  const project = (
    await request(app).post("/api/v1/projects").set(auth()).send({ name: "Demo signoff" })
  ).body.data;
  projects.push(project.id);
  await db.member.create({
    data: { projectId: project.id, userId: users.APPROVER!.id, role: "APPROVER" },
  });
  const critical = await db.testCase.create({
    data: {
      projectId: project.id,
      title: "Demo critical",
      priority: "HIGH",
      type: "FUNCTIONAL",
      tags: [],
    },
  });
  const release = (
    await request(app).post(path(project.id)).set(auth()).send({ name: "Demo signoff release" })
  ).body.data;
  const root = `${path(project.id)}/${release.id}`;
  expect((await request(app).get(`${root}/report.pdf`)).status).toBe(401);
  expect((await request(app).get(`${root}/report.pdf`).set(auth("OUTSIDER"))).status).toBe(404);
  const report = await request(app).get(`${root}/report.pdf`).set(auth());
  expect(report.status).toBe(200);
  expect(report.headers["content-type"]).toContain("application/pdf");
  expect(report.headers["cache-control"]).toBe("no-store");
  expect(Buffer.isBuffer(report.body)).toBe(true);
  expect(report.body.subarray(0, 5).toString()).toBe("%PDF-");
  const images: string[] = [];
  for (const environment of ["STAGING", "UAT", "PREPROD", "PROD"]) {
    const run = await db.run.create({
      data: {
        projectId: project.id,
        mode: "AUTOMATED",
        status: "PASS",
        environment,
        browser: "chromium",
        device: "desktop",
      },
    });
    const sample = await db.result.create({
      data: {
        runId: run.id,
        caseId: "accessibility",
        title: "Demo accessibility",
        version: 1,
        steps: [],
        status: "PASS",
        browser: "chromium",
        device: "desktop",
      },
    });
    await db.result.create({
      data: {
        runId: run.id,
        caseId: critical.id,
        title: "Demo critical",
        version: 1,
        steps: [],
        status: "PASS",
        browser: "chromium",
        device: "desktop",
      },
    });
    const before = await db.environmentSnapshot.create({
      data: {
        projectId: project.id,
        label: "Demo reference",
        environment: environment === "STAGING" ? "uat" : "staging",
        createdBy: users.ADMIN!.id,
        snapshot: {},
      },
    });
    const after = await db.environmentSnapshot.create({
      data: {
        projectId: project.id,
        runId: run.id,
        source: "RUNNER",
        browser: "chromium",
        device: "desktop",
        label: "Demo current",
        environment: environment.toLowerCase(),
        createdBy: users.ADMIN!.id,
        snapshot: {},
      },
    });
    await db.environmentComparison.create({
      data: {
        projectId: project.id,
        beforeId: before.id,
        afterId: after.id,
        createdBy: users.ADMIN!.id,
        findingCount: 0,
        findings: [],
      },
    });
    const image = await db.evidence.create({
      data: {
        resultId: sample.id,
        key: randomUUID(),
        kind: "screenshot",
        contentType: "image/png",
        sizeBytes: 100,
        ready: true,
      },
    });
    const reference = await db.evidence.create({
      data: {
        resultId: sample.id,
        key: randomUUID(),
        kind: "baseline-fixture",
        contentType: "image/png",
        sizeBytes: 100,
        ready: true,
      },
    });
    const baseline = await db.visualBaseline.create({
      data: {
        projectId: project.id,
        evidenceId: reference.id,
        label: "Demo reference",
        environment: environment.toLowerCase(),
        browser: "chromium",
        device: "desktop",
        checkId: "accessibility",
        viewportWidth: 10,
        viewportHeight: 10,
        createdBy: users.ADMIN!.id,
        status: "APPROVED",
        active: true,
        activatedBy: users.ADMIN!.id,
        activatedAt: new Date(),
        reviewedBy: users.APPROVER!.id,
        reviewedAt: new Date(),
        reviewComment: "Demo reference",
      },
    });
    images.push(baseline.id);
    await db.visualComparison.create({
      data: {
        projectId: project.id,
        baselineId: baseline.id,
        evidenceId: image.id,
        createdBy: users.ADMIN!.id,
        width: 10,
        height: 10,
        changedPixels: 0,
        comparedPixels: 100,
        diffKey: randomUUID(),
      },
    });
    expect(
      (
        await request(app)
          .put(`${root}/gates/${environment}/runs`)
          .set(auth())
          .send({ revision: 0, runIds: [run.id] })
      ).status,
    ).toBe(200);
  }
  const read = async () =>
    (await request(app).get(`${root}/signoffs`).set(auth("APPROVER"))).body.data;
  const state = await read();
  expect(state.verification).toMatchObject({ valid: true, count: 0 });
  expect(
    state.gates.every((gate: { readiness: { eligible: boolean } }) => gate.readiness.eligible),
  ).toBe(true);
  const body = (index: number) => ({
    gateRevision: state.gates[index].readiness.gateRevision,
    evidenceHash: state.gates[index].readiness.evidenceHash,
    comment: "Demo evidence reviewed",
  });
  const sign = (environment: string, data: object, role = "APPROVER") =>
    request(app).post(`${root}/gates/${environment}/signoff`).set(auth(role)).send(data);
  expect((await sign("STAGING", body(0), "ADMIN")).status).toBe(403);
  expect((await sign("STAGING", body(0), "OUTSIDER")).status).toBe(404);
  expect((await request(app).post(`${root}/gates/STAGING/signoff`).send(body(0))).status).toBe(401);
  expect((await sign("UAT", body(1))).body.error.code).toBe("PREVIOUS_GATE");
  expect((await sign("STAGING", { ...body(0), comment: " " })).status).toBe(400);
  expect(
    (await sign("STAGING", { ...body(0), evidenceHash: "0".repeat(64) })).body.error.code,
  ).toBe("STALE_EVIDENCE");
  const concurrent = await Promise.all([sign("STAGING", body(0)), sign("STAGING", body(0))]);
  expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409]);
  expect((await sign("UAT", body(1))).status).toBe(200);
  expect((await read()).gates.slice(0, 2).every((gate: { current: boolean }) => gate.current)).toBe(
    true,
  );
  const records = await db.releaseSignoff.findMany({
    where: { releaseId: release.id },
    orderBy: { sequence: "asc" },
  });
  expect(verifySignoffs(records, 2).valid).toBe(true);
  expect(verifySignoffs(records.slice(0, 1), 2).valid).toBe(false);
  expect(signoffHash(records[0]!)).toBe(records[0]!.hash);
  await db.releaseSignoff.update({
    where: { id: records[0]!.id },
    data: { comment: "Tampered demo" },
  });
  expect((await read()).verification.valid).toBe(false);
  expect((await sign("PREPROD", body(2))).body.error.code).toBe("INVALID_CHAIN");
  await db.releaseSignoff.update({
    where: { id: records[0]!.id },
    data: { comment: records[0]!.comment },
  });
  const gate = release.gates[0];
  const savedGate = await db.releaseGate.findUniqueOrThrow({ where: { id: gate.id } });
  await request(app)
    .put(`${root}/gates/STAGING/runs`)
    .set(auth())
    .send({ revision: 1, runIds: savedGate.runIds });
  const changed = await read();
  expect(changed.gates[0].current).toBe(false);
  expect(changed.gates[1].current).toBe(false);
  expect((await sign("PREPROD", body(2))).body.error.code).toBe("PREVIOUS_GATE");
  expect(
    (
      await sign("STAGING", {
        ...body(0),
        ...{
          gateRevision: changed.gates[0].readiness.gateRevision,
          evidenceHash: changed.gates[0].readiness.evidenceHash,
        },
      })
    ).status,
  ).toBe(200);
  expect((await read()).gates[1].current).toBe(false);
  expect((await sign("UAT", body(1))).status).toBe(200);
  expect((await sign("PREPROD", body(2))).status).toBe(200);
  expect((await sign("PROD", body(3))).status).toBe(200);
  expect((await read()).gates.every((item: { current: boolean }) => item.current)).toBe(true);
  const signedReport = await request(app).get(`${root}/report.pdf`).set(auth("APPROVER"));
  expect(signedReport.status).toBe(200);
  expect(signedReport.body.subarray(0, 5).toString()).toBe("%PDF-");
  const pages = signedReport.body.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
  expect(pages.length).toBeGreaterThanOrEqual(7);
  expect(pages.length).toBeLessThan(14);
  if (process.env.PDF_VERIFICATION_PATH)
    writeFileSync(process.env.PDF_VERIFICATION_PATH, signedReport.body);
  await db.testCase.update({ where: { id: critical.id }, data: { version: 2 } });
  expect((await read()).gates.every((item: { current: boolean }) => !item.current)).toBe(true);
  expect((await sign("STAGING", body(0))).body.error.code).toBe("NOT_READY");
  await db.visualComparison.deleteMany({ where: { projectId: project.id } });
  await db.visualBaseline.deleteMany({ where: { id: { in: images } } });
});

it("collects authoritative readiness and blocks missing, stale or changed evidence", async () => {
  const release = (await request(app).post(path()).set(auth()).send({ name: "Demo readiness" }))
    .body.data;
  const target = `${path()}/${release.id}/gates/STAGING/readiness`;
  expect((await request(app).get(target)).status).toBe(401);
  expect((await request(app).get(target).set(auth("OUTSIDER"))).status).toBe(404);
  const empty = (await request(app).get(target).set(auth("APPROVER"))).body.data;
  expect(empty).toMatchObject({ eligible: false, score: null, gateRevision: 0 });
  const testCase = await db.testCase.create({
    data: {
      projectId: projects[0]!,
      title: "Demo critical",
      priority: "HIGH",
      type: "FUNCTIONAL",
      tags: [],
    },
  });
  await db.result.create({
    data: {
      runId: runs[0]!,
      caseId: testCase.id,
      title: "Demo critical",
      version: 1,
      steps: [],
      status: "PASS",
    },
  });
  await request(app)
    .put(`${path()}/${release.id}/gates/STAGING/runs`)
    .set(auth())
    .send({ revision: 0, runIds: [runs[0]] });
  const read = async () => (await request(app).get(target).set(auth())).body.data;
  const passed = await read();
  const baseline = await db.environmentSnapshot.create({
    data: {
      projectId: projects[0]!,
      label: "Demo baseline",
      environment: "uat",
      createdBy: users.ADMIN!.id,
      snapshot: {},
    },
  });
  const snapshot = await db.environmentSnapshot.create({
    data: {
      projectId: projects[0]!,
      label: "Demo current",
      source: "RUNNER",
      browser: "chromium",
      device: "desktop",
      environment: "staging",
      runId: runs[0],
      createdBy: users.ADMIN!.id,
      snapshot: {},
    },
  });
  const comparison = await db.environmentComparison.create({
    data: {
      projectId: projects[0]!,
      beforeId: baseline.id,
      afterId: snapshot.id,
      createdBy: users.ADMIN!.id,
      findingCount: 1,
      findings: [{ expected: false }],
    },
  });
  expect((await read()).evidence.drift.unresolved).toBe(1);
  await db.environmentComparison.update({
    where: { id: comparison.id },
    data: { findings: [{ expected: true }] },
  });
  expect((await read()).evidence.drift.unresolved).toBe(0);
  await db.project.update({ where: { id: projects[0] }, data: { expectedRulesRevision: 1 } });
  expect((await read()).evidence.drift).toBeNull();
  await db.project.update({ where: { id: projects[0] }, data: { expectedRulesRevision: 0 } });
  await db.environmentSnapshot.delete({ where: { id: baseline.id } });
  expect((await read()).evidence.drift).toBeNull();
  expect(passed.evidence.criticalTests).toMatchObject({ passed: 1, total: 1 });
  expect(passed).toMatchObject({
    eligible: false,
    score: null,
    notCollected: [],
  });
  await db.testCase.update({ where: { id: testCase.id }, data: { version: 2 } });
  const changed = await read();
  expect(changed.evidence.criticalTests.passed).toBe(0);
  expect(changed.evidenceHash).not.toBe(passed.evidenceHash);
  const original = await db.run.findUniqueOrThrow({ where: { id: runs[0] } });
  await db.run.update({
    where: { id: runs[0] },
    data: { createdAt: new Date(Date.now() - 86400001) },
  });
  expect((await read()).components[0].reason).toBe("STALE_EVIDENCE");
  await db.run.update({ where: { id: runs[0] }, data: { environment: "UAT" } });
  expect((await read()).sourceProblems).toContain("RUN_MISSING_OR_ENVIRONMENT_CHANGED");
  await db.run.update({
    where: { id: runs[0] },
    data: { environment: original.environment, createdAt: original.createdAt },
  });
});
it("requires complete automated accessibility coverage and rejects flaky, unfinished and failed samples", async () => {
  const release = (
    await request(app).post(path()).set(auth()).send({ name: "Demo accessibility gate" })
  ).body.data;
  const run = await db.run.create({
    data: {
      projectId: projects[0]!,
      mode: "AUTOMATED",
      status: "PASS",
      environment: "STAGING",
      browser: "chromium",
      device: "desktop",
    },
  });
  const sample = await db.result.create({
    data: {
      runId: run.id,
      caseId: "accessibility",
      title: "Demo accessibility",
      version: 1,
      steps: [],
      status: "PASS",
      browser: "chromium",
      device: "desktop",
    },
  });
  await request(app)
    .put(`${path()}/${release.id}/gates/STAGING/runs`)
    .set(auth())
    .send({ revision: 0, runIds: [run.id] });
  const read = async () =>
    (await request(app).get(`${path()}/${release.id}/gates/STAGING/readiness`).set(auth())).body
      .data;
  expect((await read()).evidence.accessibility).toMatchObject({ passed: 1, total: 1 });
  await db.result.update({ where: { id: sample.id }, data: { flaky: true } });
  expect((await read()).blockers).toContain("ACCESSIBILITY_FAILURE");
  await db.result.update({ where: { id: sample.id }, data: { flaky: false, status: "FAIL" } });
  expect((await read()).evidence.accessibility.passed).toBe(0);
  await db.result.update({ where: { id: sample.id }, data: { status: "PASS" } });
  await db.run.update({ where: { id: run.id }, data: { status: "RUNNING" } });
  expect((await read()).evidence.accessibility.passed).toBe(0);
  await db.run.update({ where: { id: run.id }, data: { status: "PASS" } });
  await db.result.create({
    data: {
      runId: run.id,
      caseId: "catalogue",
      title: "Demo second browser",
      version: 1,
      steps: [],
      status: "PASS",
      browser: "firefox",
      device: "desktop",
    },
  });
  expect((await read()).evidence.accessibility).toBeNull();
  expect((await read()).sourceProblems).toContain("ACCESSIBILITY_MATRIX_INCOMPLETE");
  const image = await db.evidence.create({
    data: {
      resultId: sample.id,
      key: randomUUID(),
      kind: "screenshot",
      contentType: "image/png",
      sizeBytes: 100,
      ready: true,
    },
  });
  const baseline = await db.visualBaseline.create({
    data: {
      projectId: projects[0]!,
      evidenceId: image.id,
      label: "Demo visual baseline",
      environment: "staging",
      browser: "chromium",
      device: "desktop",
      checkId: "accessibility",
      viewportWidth: 10,
      viewportHeight: 10,
      createdBy: users.ADMIN!.id,
      status: "APPROVED",
      active: true,
      activatedBy: users.ADMIN!.id,
      activatedAt: new Date(),
      reviewedBy: users.ADMIN!.id,
      reviewedAt: new Date(),
      reviewComment: "Demo approved",
    },
  });
  const comparison = await db.visualComparison.create({
    data: {
      projectId: projects[0]!,
      baselineId: baseline.id,
      evidenceId: image.id,
      createdBy: users.ADMIN!.id,
      width: 10,
      height: 10,
      changedPixels: 0,
      comparedPixels: 100,
      diffKey: randomUUID(),
    },
  });
  expect((await read()).evidence.visual).toMatchObject({ reviewed: 1, total: 1 });
  await db.visualComparison.update({ where: { id: comparison.id }, data: { changedPixels: 1 } });
  expect((await read()).blockers).toContain("UNREVIEWED_VISUAL_DIFFERENCES");
  const reviewPath = `/api/v1/projects/${projects[0]}/visual-comparisons/${comparison.id}/review`;
  const review = { decision: "ACCEPTED", comment: "Demo intentional change reviewed" };
  expect((await request(app).post(reviewPath).send(review)).status).toBe(401);
  expect((await request(app).post(reviewPath).set(auth("QA")).send(review)).status).toBe(403);
  expect((await request(app).post(reviewPath).set(auth("DEVELOPER")).send(review)).status).toBe(
    403,
  );
  expect((await request(app).post(reviewPath).set(auth("OUTSIDER")).send(review)).status).toBe(404);
  expect(
    (
      await request(app)
        .post(reviewPath)
        .set(auth("APPROVER"))
        .send({ ...review, comment: " " })
    ).status,
  ).toBe(400);
  const reviews = await Promise.all(
    [0, 1].map(() => request(app).post(reviewPath).set(auth("APPROVER")).send(review)),
  );
  expect(reviews.map((response) => response.status).sort()).toEqual([200, 409]);
  expect((await read()).evidence.visual.reviewed).toBe(1);
  const savedReview = await db.visualComparison.findUniqueOrThrow({ where: { id: comparison.id } });
  expect(savedReview).toMatchObject({
    reviewDecision: "ACCEPTED",
    reviewedBy: users.APPROVER!.id,
    reviewComment: review.comment,
  });
  expect(savedReview.reviewedAt).not.toBeNull();
  await db.visualBaseline.update({ where: { id: baseline.id }, data: { ignoreRevision: 1 } });
  expect((await read()).evidence.visual).toBeNull();
  await db.visualComparison.delete({ where: { id: comparison.id } });
  await db.visualBaseline.delete({ where: { id: baseline.id } });
});

beforeAll(async () => {
  for (const role of ["ADMIN", "QA", "DEVELOPER", "APPROVER", "OUTSIDER"]) {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Demo release tester",
        email: `release-${randomUUID()}@example.test`,
        password: "LongTestPassword123!",
      });
    expect(response.status).toBe(200);
    users[role] = { id: response.body.data.user.id, token: response.body.data.accessToken };
  }
  for (const name of ["Demo release project", "Demo other project"]) {
    const response = await request(app).post("/api/v1/projects").set(auth()).send({ name });
    expect(response.status).toBe(200);
    projects.push(response.body.data.id);
  }
  for (const role of ["QA", "DEVELOPER", "APPROVER"] as const)
    await db.member.create({ data: { projectId: projects[0]!, userId: users[role]!.id, role } });
  for (const [projectId, environment] of [
    [projects[0]!, "STAGING"],
    [projects[0]!, "uat"],
    [projects[1]!, "STAGING"],
  ]) {
    const run = await db.run.create({
      data: {
        projectId: projectId!,
        environment: environment!,
        browser: "Chromium",
        device: "Desktop",
      },
    });
    runs.push(run.id);
  }
});
afterAll(async () => {
  await db.project.deleteMany({ where: { id: { in: projects } } });
  await db.user.deleteMany({ where: { id: { in: Object.values(users).map((user) => user.id) } } });
  await db.$disconnect();
});
it("creates four ordered gates atomically, with strict role and project isolation", async () => {
  const body = { name: "Demo release" };
  expect((await request(app).post(path()).send(body)).status).toBe(401);
  expect((await request(app).post(path()).set(auth("OUTSIDER")).send(body)).status).toBe(404);
  for (const role of ["DEVELOPER", "APPROVER"])
    expect((await request(app).post(path()).set(auth(role)).send(body)).status).toBe(403);
  expect(
    (
      await request(app)
        .post(path())
        .set(auth())
        .send({ ...body, score: 100 })
    ).status,
  ).toBe(400);
  const response = await request(app).post(path()).set(auth("QA")).send(body);
  expect(response.status).toBe(200);
  const release = response.body.data;
  expect(release.gates.map((gate: { environment: string }) => gate.environment)).toEqual([
    "STAGING",
    "UAT",
    "PREPROD",
    "PROD",
  ]);
  expect(
    release.gates.every(
      (gate: { revision: number; runIds: string[] }) =>
        gate.revision === 0 && gate.runIds.length === 0,
    ),
  ).toBe(true);
  expect((await request(app).get(`${path()}/${release.id}`).set(auth("APPROVER"))).status).toBe(
    200,
  );
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}/${release.id}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app)
        .get(`${path(projects[1])}?cursor=${release.id}`)
        .set(auth())
    ).status,
  ).toBe(404);
  expect((await request(app).get(path()).set(auth("OUTSIDER"))).status).toBe(404);
  expect((await request(app).get(path()).set(auth())).body.data).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: release.id })]),
  );
});
it("binds only same-project/environment runs and rejects stale concurrent edits", async () => {
  const release = (await request(app).post(path()).set(auth()).send({ name: "Demo gate binding" }))
    .body.data;
  const target = `${path()}/${release.id}/gates/STAGING/runs`;
  const update = (runIds: string[], revision = 0, role = "QA") =>
    request(app).put(target).set(auth(role)).send({ runIds, revision });
  for (const ids of [[runs[1]!], [runs[2]!], ["missing"], [runs[0]!, runs[0]!]])
    expect((await update(ids)).status).toBe(400);
  expect((await update([], 0, "APPROVER")).status).toBe(403);
  expect((await update([], 0, "DEVELOPER")).status).toBe(403);
  const results = await Promise.all([update([runs[0]!]), update([runs[0]!])]);
  expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  const data = (await request(app).get(`${path()}/${release.id}`).set(auth())).body.data;
  expect(data.gates[0]).toMatchObject({ revision: 1, runIds: [runs[0]] });
  expect((await update([], 0)).status).toBe(409);
  expect((await update([], 1)).body.data).toMatchObject({ revision: 2, runIds: [] });
  const uat = await request(app)
    .put(`${path()}/${release.id}/gates/UAT/runs`)
    .set(auth())
    .send({ revision: 0, runIds: [runs[1]] });
  expect(uat.status).toBe(200);
  expect(
    (
      await request(app)
        .put(`${path(projects[1])}/${release.id}/gates/STAGING/runs`)
        .set(auth())
        .send({ revision: 0, runIds: [] })
    ).status,
  ).toBe(404);
});
