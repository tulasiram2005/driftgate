import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import type { EnvironmentSnapshot, ProductSnapshot } from "../../runner/src/drift.js";

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
const path = (projectId = project) => `/api/v1/projects/${projectId}/snapshots`;
const product = (id = "demo-shirt"): ProductSnapshot => ({
  id,
  priceCents: 120000,
  compareAtCents: 150000,
  currency: "INR",
  sizes: [{ label: "M", stock: 5 }],
  discountPercent: 20,
  badge: "Demo sale",
  image: { status: 200, width: 800, height: 1000 },
  title: "Demo shirt",
  canonical: "http://127.0.0.1:3201/products/demo-shirt",
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Demo shirt",
    sku: id,
    offers: {
      "@type": "Offer",
      price: "1200.00",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: "http://127.0.0.1:3201/products/demo-shirt",
    },
  },
});
const payload = (label = "Demo manual import") => ({
  label,
  snapshot: {
    environment: "staging" as EnvironmentSnapshot["environment"],
    origin: "http://127.0.0.1:3201",
    locale: "en-IN",
    productCount: 1,
    products: [product()],
  } satisfies EnvironmentSnapshot,
});
async function createProject() {
  const r = await request(app)
    .post("/api/v1/projects")
    .set(auth())
    .send({ name: `Demo snapshot tests ${randomUUID()}` });
  expect(r.status).toBe(200);
  projects.push(r.body.data.id);
  return r.body.data.id as string;
}
async function createSnapshot(body: object = payload(), role = "admin") {
  const r = await request(app).post(path()).set(auth(role)).send(body);
  expect(r.status).toBe(200);
  return r.body.data as { id: string };
}

beforeAll(async () => {
  await db.$connect();
  for (const role of ["admin", "qa", "developer", "outsider"]) {
    const email = `snapshots-${role}-${suffix}@example.test`;
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

describe("manual snapshot API with isolated local database", () => {
  it("creates and retrieves the complete snapshot with server-owned provenance", async () => {
    const body = payload();
    const created = await createSnapshot(body);
    expect(created.id).toEqual(expect.any(String));
    const detail = await request(app).get(`${path()}/${created.id}`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id: created.id,
      projectId: project,
      label: body.label,
      source: "MANUAL_IMPORT",
      createdBy: users.admin!.id,
      snapshot: body.snapshot,
      createdAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(detail.body.data.createdAt))).toBe(false);
  });

  it("lists metadata only and scopes the collection to its project", async () => {
    const created = await createSnapshot();
    const otherProject = await createProject();
    const other = await request(app)
      .post(path(otherProject))
      .set(auth())
      .send(payload("Other demo"));
    expect(other.status).toBe(200);
    const list = await request(app).get(path()).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      id: created.id,
      label: "Demo manual import",
      source: "MANUAL_IMPORT",
      createdBy: users.admin!.id,
    });
    expect(list.body.data[0]).not.toHaveProperty("snapshot");
    expect(list.body.data[0]).not.toHaveProperty("products");
    expect(list.body.nextCursor).toBeNull();
  });

  it("defaults to 30 rows and paginates without omissions or duplicates", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 31; i++) {
      const body = payload(`Demo ${i}`);
      const row = await db.environmentSnapshot.create({
        data: {
          projectId: project,
          label: body.label,
          environment: body.snapshot.environment,
          source: "MANUAL_IMPORT",
          createdBy: users.admin!.id,
          snapshot: JSON.parse(JSON.stringify(body.snapshot)),
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
    for (const row of rows) expect(row).not.toHaveProperty("snapshot");
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

  it("enforces authentication, membership and writer roles", async () => {
    const created = await createSnapshot();
    for (const [method, route] of [
      ["post", path()],
      ["get", path()],
      ["get", `${path()}/${created.id}`],
    ] as const) {
      const unauth = request(app)[method](route);
      const outsider = request(app)[method](route).set(auth("outsider"));
      if (method === "post") {
        unauth.send(payload());
        outsider.send(payload());
      }
      expect((await unauth).status, `unauthenticated ${method} ${route}`).toBe(401);
      expect((await outsider).status, `outsider ${method} ${route}`).toBe(404);
    }
    for (const [role, membership] of [
      ["qa", "QA"],
      ["developer", "DEVELOPER"],
    ] as const) {
      const member = await request(app)
        .post(`/api/v1/projects/${project}/members`)
        .set(auth())
        .send({ email: users[role]!.email, role: membership });
      expect(member.status).toBe(200);
      expect((await request(app).get(path()).set(auth(role))).status).toBe(200);
      expect((await request(app).get(`${path()}/${created.id}`).set(auth(role))).status).toBe(200);
    }
    const qa = await createSnapshot(payload("Demo QA import"), "qa");
    const detail = await request(app).get(`${path()}/${qa.id}`).set(auth());
    expect(detail.body.data.createdBy).toBe(users.qa!.id);
    expect(detail.body.data.source).toBe("MANUAL_IMPORT");
    expect((await request(app).post(path()).set(auth("developer")).send(payload())).status).toBe(
      403,
    );
  });

  it("returns 404 for a snapshot under another accessible project or an unknown ID", async () => {
    const created = await createSnapshot();
    const otherProject = await createProject();
    expect(
      (
        await request(app)
          .get(`${path(otherProject)}/${created.id}`)
          .set(auth())
      ).status,
    ).toBe(404);
    expect((await request(app).get(`${path()}/${randomUUID()}`).set(auth())).status).toBe(404);
  });

  it("accepts every environment, empty catalogues and boundary lengths", async () => {
    for (const environment of ["staging", "uat", "preprod", "prod"] as const) {
      const body = payload(environment === "prod" ? "D".repeat(120) : "D");
      body.snapshot = { ...body.snapshot, environment, productCount: 0, products: [] };
      await createSnapshot(body);
    }
    const body = payload();
    body.snapshot.products = Array.from({ length: 20 }, (_, i) => product(`demo-${i}`));
    body.snapshot.productCount = 20;
    await createSnapshot(body);
  });

  it("rejects invalid counts, duplicate identities and normalized duplicate sizes atomically", async () => {
    const base = payload();
    const invalid = [
      { ...base.snapshot, productCount: -1 },
      { ...base.snapshot, productCount: 1.5 },
      { ...base.snapshot, productCount: 0 },
      { ...base.snapshot, productCount: 2 },
      { ...base.snapshot, productCount: "1" },
      {
        ...base.snapshot,
        productCount: 21,
        products: Array.from({ length: 21 }, (_, i) => product(`demo-${i}`)),
      },
      { ...base.snapshot, productCount: 2, products: [product(), product()] },
      {
        ...base.snapshot,
        products: [
          {
            ...product(),
            sizes: [
              { label: "M", stock: 1 },
              { label: " m ", stock: 2 },
            ],
          },
        ],
      },
    ];
    for (const snapshot of invalid) {
      const r = await request(app)
        .post(path())
        .set(auth())
        .send({ ...base, snapshot });
      expect(r.status, JSON.stringify(snapshot)).toBe(400);
    }
    const list = await request(app).get(path()).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([]);
  });

  it.each([
    "http://localhost:3201",
    "http://127.0.0.1:3202",
    "https://127.0.0.1:3201",
    "http://127.0.0.1:3201.evil.example",
    "http://127.0.0.1:3201@evil.example",
    "http://169.254.169.254",
    "https://example.com",
    "file:///etc/passwd",
  ])("rejects non-allowlisted origin %s", async (origin) => {
    const body = payload();
    const r = await request(app)
      .post(path())
      .set(auth())
      .send({
        ...body,
        snapshot: { ...body.snapshot, origin },
      });
    expect(r.status).toBe(400);
  });

  it("rejects invalid labels, environment, locale and unknown nested fields", async () => {
    const base = payload();
    const p = product();
    const invalid = [
      { ...base, label: "" },
      { ...base, label: "D".repeat(121) },
      { ...base, source: "MANUAL_IMPORT" },
      { ...base, createdBy: users.outsider!.id },
      { ...base, projectId: project },
      { ...base, snapshot: { ...base.snapshot, environment: "STAGING" } },
      { ...base, snapshot: { ...base.snapshot, locale: "en-US" } },
      { ...base, snapshot: { ...base.snapshot, unknown: true } },
      ...[
        { ...p, unknown: true },
        { ...p, sizes: [{ label: "M", stock: 1, unknown: true }] },
        { ...p, image: { ...p.image, unknown: true } },
        { ...p, jsonLd: { ...p.jsonLd, unknown: true } },
        { ...p, jsonLd: { ...p.jsonLd, offers: { ...p.jsonLd!.offers, unknown: true } } },
      ].map((entry) => ({ ...base, snapshot: { ...base.snapshot, products: [entry] } })),
    ];
    for (const body of invalid) {
      expect(
        (await request(app).post(path()).set(auth()).send(body)).status,
        JSON.stringify(body),
      ).toBe(400);
    }
  });

  it("has no update or delete endpoints and preserves imported evidence", async () => {
    const created = await createSnapshot();
    for (const method of ["put", "patch", "delete"] as const) {
      expect(
        (await request(app)[method](`${path()}/${created.id}`).set(auth()).send(payload("Changed")))
          .status,
      ).toBe(404);
    }
    const detail = await request(app).get(`${path()}/${created.id}`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.data.snapshot).toEqual(payload().snapshot);
    expect(detail.body.data.label).toBe(payload().label);
  });

  it("rate limits imports without creating records for invalid requests", async () => {
    for (let i = 0; i < 20; i++)
      expect((await request(app).post(path()).set(auth()).send({})).status).toBe(400);
    expect((await request(app).post(path()).set(auth()).send(payload())).status).toBe(429);
    expect(await db.environmentSnapshot.count({ where: { projectId: project } })).toBe(0);
  });

  it("rejects cursors belonging to another project", async () => {
    const snapshot = await createSnapshot();
    const other = await createProject();
    expect(
      (await request(app).get(path(other)).query({ cursor: snapshot.id }).set(auth())).status,
    ).toBe(404);
  });
});
