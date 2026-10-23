import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { EnvironmentSnapshot } from "../../runner/src/drift.js";

const url = process.env.TEST_API_DATABASE_URL;
if (
  !url ||
  new URL(url).pathname !== "/driftgate_test" ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname)
) {
  throw new Error(
    "Use TEST_API_DATABASE_URL pointing to an isolated local /driftgate_test database. Refusing other databases.",
  );
}
const db = new PrismaClient({ datasources: { db: { url } } });
const config = readConfig({
  NODE_ENV: "test",
  DATABASE_URL: url,
  JWT_SECRET: "test-only-not-a-production-secret-".repeat(3),
  API_CORS_ORIGINS: "http://127.0.0.1:3100",
});
let app = createApp(db, config);
const suffix = randomUUID();
const users: Record<string, { id: string; token: string; email: string }> = {};
const projects: string[] = [];
let project = "";
const auth = (role = "admin") => ({ Authorization: `Bearer ${users[role]!.token}` });
const path = (projectId = project) => `/api/v1/projects/${projectId}/comparisons`;
const snapshot = (
  environment: EnvironmentSnapshot["environment"] = "staging",
  priceCents = 120000,
): EnvironmentSnapshot => ({
  environment,
  origin: "http://127.0.0.1:3201",
  locale: "en-IN",
  productCount: 1,
  products: [
    {
      id: "demo-shirt",
      priceCents,
      compareAtCents: 150000,
      currency: "INR",
      sizes: [{ label: "M", stock: 5 }],
      discountPercent: 20,
      badge: "Demo sale",
      image: { status: 200, width: 800, height: 1000 },
      title: "Demo shirt",
      canonical: "http://127.0.0.1:3201/products/demo-shirt",
      jsonLd: null,
    },
  ],
});
async function createProject() {
  const r = await request(app)
    .post("/api/v1/projects")
    .set(auth())
    .send({ name: `Demo comparison tests ${randomUUID()}` });
  expect(r.status).toBe(200);
  projects.push(r.body.data.id);
  return r.body.data.id as string;
}
async function importSnapshot(body = snapshot(), projectId = project) {
  const r = await request(app)
    .post(`/api/v1/projects/${projectId}/snapshots`)
    .set(auth())
    .send({ label: "Demo comparison fixture", snapshot: body });
  expect(r.status).toBe(200);
  return r.body.data.id as string;
}
async function pair() {
  return {
    beforeId: await importSnapshot(),
    afterId: await importSnapshot(snapshot("prod", 125000)),
  };
}
async function compare(body: { beforeId: string; afterId: string }, role = "admin") {
  const r = await request(app).post(path()).set(auth(role)).send(body);
  expect(r.status).toBe(200);
  return r.body.data as { id: string };
}
async function addMember(role: "qa" | "developer") {
  const r = await request(app)
    .post(`/api/v1/projects/${project}/members`)
    .set(auth())
    .send({ email: users[role]!.email, role: role === "qa" ? "QA" : "DEVELOPER" });
  expect(r.status).toBe(200);
}

beforeAll(async () => {
  await db.$connect();
  for (const role of ["admin", "qa", "developer", "outsider"]) {
    const email = `comparisons-${role}-${suffix}@example.test`;
    const r = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: `Demo ${role}`, email, password: "LongTestPassword123!" });
    expect(r.status).toBe(200);
    users[role] = { id: r.body.data.user.id, token: r.body.data.accessToken, email };
  }
});
beforeEach(async () => {
  app = createApp(db, config);
  project = await createProject();
});
afterAll(async () => {
  try {
    await db.project.deleteMany({ where: { id: { in: projects } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users).map((u) => u.id) } } });
  } finally {
    await db.$disconnect();
  }
});

describe("manual comparison API with isolated local database", () => {
  it("reuses pair-scoped rules with conflict protection and immutable historical results", async () => {
    const route = `/api/v1/projects/${project}/expected-rules`;
    const rule = { field: "price", productId: "demo-shirt", reason: "Approved demo pricing" };
    const body = { revision: 0, environments: ["staging", "prod"], rules: [rule] };
    await addMember("qa");
    await addMember("developer");
    expect((await request(app).put(route).set(auth("developer")).send(body)).status).toBe(403);
    expect((await request(app).get(route).set(auth("outsider"))).status).toBe(404);
    expect((await request(app).put(route).set(auth("qa")).send(body)).status).toBe(200);
    expect((await request(app).put(route).set(auth()).send(body)).status).toBe(409);
    const ids = await pair();
    const result = await request(app).post(path()).set(auth()).send(ids);
    expect(result.body.data.expectedRules).toEqual([rule]);
    expect(result.body.data.rulesRevision).toBe(1);
    expect(result.body.data.findings[0].expected).toBe(true);
    const reverse = await request(app)
      .post(path())
      .set(auth())
      .send({ beforeId: ids.afterId, afterId: ids.beforeId });
    expect(reverse.body.data.findings[0].expected).toBe(true);
    const other = await importSnapshot(snapshot("uat", 125000));
    expect(
      (await request(app).post(path()).set(auth()).send({ beforeId: ids.beforeId, afterId: other }))
        .body.data.findings[0].expected,
    ).toBe(false);
    expect(
      (
        await request(app)
          .put(route)
          .set(auth())
          .send({ ...body, revision: 1, rules: [] })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).post(path()).set(auth()).send(ids)).body.data.findings[0].expected,
    ).toBe(false);
    expect(
      (await request(app).get(`${path()}/${result.body.data.id}`).set(auth())).body.data.findings[0]
        .expected,
    ).toBe(true);
    for (const invalid of [
      { ...body, environments: ["prod", "prod"] },
      { ...body, rules: [rule, rule] },
      { ...body, revision: -1 },
    ])
      expect((await request(app).put(route).set(auth()).send(invalid)).status).toBe(400);
  });
  it("retains findings and records explicit scoped expectations without changing older comparisons", async () => {
    const ids = await pair();
    const rule = { field: "price", productId: "demo-shirt", reason: "Demo regional pricing" };
    const original = await request(app).post(path()).set(auth()).send(ids);
    const expected = await request(app)
      .post(path())
      .set(auth())
      .send({ ...ids, expectedRules: [rule] });
    expect(expected.status).toBe(200);
    expect(expected.body.data.findingCount).toBe(original.body.data.findingCount);
    expect(
      expected.body.data.findings.find((f: { field: string }) => f.field === "price").expected,
    ).toBe(true);
    expect(expected.body.data.expectedRules).toEqual([rule]);
    const older = await request(app).get(`${path()}/${original.body.data.id}`).set(auth());
    expect(
      older.body.data.findings.find((f: { field: string }) => f.field === "price").expected,
    ).toBe(false);
    const unmatched = await request(app)
      .post(path())
      .set(auth())
      .send({ ...ids, expectedRules: [{ ...rule, productId: "other" }] });
    expect(unmatched.body.data.findings.every((f: { expected: boolean }) => !f.expected)).toBe(
      true,
    );
  });
  it("rejects wildcard, duplicate, unreasoned and incorrectly scoped expectations", async () => {
    const ids = await pair();
    const rule = { field: "price", productId: "demo-shirt", reason: "Demo" };
    for (const expectedRules of [
      [{ ...rule, field: "*" }],
      [rule, rule],
      [{ ...rule, reason: " " }],
      [{ ...rule, productId: null }],
      [{ ...rule, field: "productCount" }],
      [{ ...rule, environments: ["staging", "uat"] }],
      Array(101).fill(rule),
    ])
      expect(
        (
          await request(app)
            .post(path())
            .set(auth())
            .send({ ...ids, expectedRules })
        ).status,
      ).toBe(400);
  });
  it("computes an S1 price finding and records server-owned provenance", async () => {
    const body = await pair();
    const created = await compare(body);
    const detail = await request(app).get(`${path()}/${created.id}`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: created.id,
      projectId: project,
      ...body,
      source: "MANUAL_IMPORT",
      createdBy: users.admin!.id,
      createdAt: expect.any(String),
      findingCount: 1,
      findings: [
        {
          field: "price",
          productId: "demo-shirt",
          size: null,
          environments: ["staging", "prod"],
          severity: "S1",
          before: 120000,
          after: 125000,
          expected: false,
        },
      ],
    });
    expect(Number.isNaN(Date.parse(detail.body.data.createdAt))).toBe(false);
    const stored = await db.environmentComparison.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.findings).toEqual(detail.body.data.findings);
    expect(stored.findingCount).toBe(1);
  });

  it("rejects distinct snapshots in the same environment and identical snapshot IDs", async () => {
    const beforeId = await importSnapshot();
    const afterId = await importSnapshot(snapshot("staging", 125000));
    for (const id of [afterId, beforeId]) {
      expect(
        (await request(app).post(path()).set(auth()).send({ beforeId, afterId: id })).status,
      ).toBe(400);
    }
    expect(await db.environmentComparison.count({ where: { projectId: project } })).toBe(0);
  });

  it("enforces authentication and membership for creation, collection and detail", async () => {
    const body = await pair();
    const created = await compare(body);
    for (const [method, route] of [
      ["post", path()],
      ["get", path()],
      ["get", `${path()}/${created.id}`],
    ] as const) {
      for (const role of [null, "outsider"] as const) {
        const call = request(app)[method](route);
        if (role) call.set(auth(role));
        if (method === "post") call.send(body);
        expect((await call).status, `${role ?? "unauthenticated"} ${method} ${route}`).toBe(
          role ? 404 : 401,
        );
      }
    }
    expect(await db.environmentComparison.count({ where: { projectId: project } })).toBe(1);
  });

  it("permits QA writes and member reads but rejects developer writes", async () => {
    const body = await pair();
    await addMember("qa");
    await addMember("developer");
    const created = await compare(body, "qa");
    for (const role of ["qa", "developer"]) {
      expect((await request(app).get(path()).set(auth(role))).status).toBe(200);
      const detail = await request(app).get(`${path()}/${created.id}`).set(auth(role));
      expect(detail.status).toBe(200);
      expect(detail.body.data.createdBy).toBe(users.qa!.id);
    }
    expect((await request(app).post(path()).set(auth("developer")).send(body)).status).toBe(403);
    expect(await db.environmentComparison.count({ where: { projectId: project } })).toBe(1);
  });

  it("rejects either snapshot from another project, including two foreign snapshots", async () => {
    const body = await pair();
    const other = await createProject();
    const beforeId = await importSnapshot(snapshot(), other);
    const afterId = await importSnapshot(snapshot("prod", 125000), other);
    for (const invalid of [
      { ...body, beforeId },
      { ...body, afterId },
      { beforeId, afterId },
      { ...body, beforeId: randomUUID() },
      { ...body, afterId: randomUUID() },
    ]) {
      expect((await request(app).post(path()).set(auth()).send(invalid)).status).toBe(404);
    }
    expect(await db.environmentComparison.count({ where: { projectId: project } })).toBe(0);
  });

  it("accepts only beforeId and afterId and persists no rejected requests", async () => {
    const body = await pair();
    for (const invalid of [
      {},
      { beforeId: body.beforeId },
      { afterId: body.afterId },
      { ...body, beforeId: null },
      { ...body, afterId: 123 },
      { ...body, findings: [] },
      { ...body, source: "MANUAL_IMPORT" },
      { ...body, createdBy: users.outsider!.id },
      { ...body, findingCount: 0 },
      { ...body, projectId: project },
      { ...body, unknown: true },
    ]) {
      expect(
        (await request(app).post(path()).set(auth()).send(invalid)).status,
        JSON.stringify(invalid),
      ).toBe(400);
    }
    expect(await db.environmentComparison.count({ where: { projectId: project } })).toBe(0);
  });

  it("rejects an invalid stored price on either side without persisting a comparison", async () => {
    const body = await pair();
    for (const id of [body.beforeId, body.afterId]) {
      const original = id === body.beforeId ? snapshot() : snapshot("prod", 125000);
      const invalid = {
        ...original,
        products: [{ ...original.products[0]!, priceCents: "invalid" }],
      };
      await db.environmentSnapshot.update({ where: { id }, data: { snapshot: invalid } });
      expect((await request(app).post(path()).set(auth()).send(body)).status).toBe(400);
      expect(await db.environmentComparison.count({ where: { projectId: project } })).toBe(0);
      await db.environmentSnapshot.update({
        where: { id },
        data: { snapshot: JSON.parse(JSON.stringify(original)) },
      });
    }
  });

  it("defaults to 30 metadata rows and paginates without omissions or duplicates", async () => {
    const body = await pair();
    const created = await compare(body);
    const seed = await db.environmentComparison.findUniqueOrThrow({ where: { id: created.id } });
    const ids = [created.id];
    for (let i = 0; i < 30; i++) {
      const row = await db.environmentComparison.create({
        data: {
          projectId: project,
          ...body,
          source: "MANUAL_IMPORT",
          createdBy: users.admin!.id,
          findingCount: seed.findingCount,
          findings: JSON.parse(JSON.stringify(seed.findings)),
        },
      });
      ids.push(row.id);
    }
    const first = await request(app).get(path()).set(auth());
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(30);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const last = await request(app)
      .get(path())
      .query({ cursor: first.body.nextCursor })
      .set(auth());
    expect(last.status).toBe(200);
    expect(last.body.data).toHaveLength(1);
    expect(last.body.nextCursor).toBeNull();
    const rows = [...first.body.data, ...last.body.data] as { id: string }[];
    expect(rows.map((row) => row.id).sort()).toEqual(ids.sort());
    for (const row of rows) {
      expect(row).toMatchObject({
        projectId: project,
        ...body,
        source: "MANUAL_IMPORT",
        createdBy: users.admin!.id,
        createdAt: expect.any(String),
        findingCount: 1,
      });
      expect(row).not.toHaveProperty("findings");
    }
    const single = await request(app).get(path()).query({ limit: 1 }).set(auth());
    expect(single.status).toBe(200);
    expect(single.body.data).toHaveLength(1);
    const maximum = await request(app).get(path()).query({ limit: 100 }).set(auth());
    expect(maximum.status).toBe(200);
    expect(maximum.body.data).toHaveLength(31);
    expect(maximum.body.nextCursor).toBeNull();
  });

  it.each(["0", "101", "-1", "1.5", "invalid"])("rejects invalid list limit %s", async (limit) => {
    expect((await request(app).get(path()).query({ limit }).set(auth())).status).toBe(400);
  });

  it("scopes lists, detail and cursors to the requested project and rejects unknown IDs", async () => {
    const created = await compare(await pair());
    const other = await createProject();
    const list = await request(app).get(path(other)).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([]);
    expect(list.body.nextCursor).toBeNull();
    expect(
      (
        await request(app)
          .get(`${path(other)}/${created.id}`)
          .set(auth())
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get(path(other)).query({ cursor: created.id }).set(auth())).status,
    ).toBe(404);
    expect((await request(app).get(`${path()}/${randomUUID()}`).set(auth())).status).toBe(404);
  });

  it("preserves immutable detail and metadata even when source snapshot data changes", async () => {
    const body = await pair();
    const created = await compare(body);
    const detail = await request(app).get(`${path()}/${created.id}`).set(auth());
    const list = await request(app).get(path()).set(auth());
    expect(detail.status).toBe(200);
    expect(list.status).toBe(200);
    for (const route of [path(), `${path()}/${created.id}`]) {
      for (const method of ["put", "patch", "delete"] as const) {
        expect((await request(app)[method](route).set(auth()).send({ findings: [] })).status).toBe(
          404,
        );
      }
    }
    await db.environmentSnapshot.update({
      where: { id: body.afterId },
      data: { snapshot: JSON.parse(JSON.stringify(snapshot("prod", 120000))) },
    });
    const unchangedDetail = await request(app).get(`${path()}/${created.id}`).set(auth());
    const unchangedList = await request(app).get(path()).set(auth());
    expect(unchangedDetail.status).toBe(200);
    expect(unchangedList.status).toBe(200);
    expect(unchangedDetail.body).toEqual(detail.body);
    expect(unchangedList.body).toEqual(list.body);
  });
});
