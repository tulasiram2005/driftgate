import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../generated/client/index.js";
import { checkThreadlineDatabase } from "../src/sql-checks.js";

const raw = process.env.TEST_DATABASE_URL;
if (!raw) throw new Error("TEST_DATABASE_URL is required");
const url = new URL(raw);
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/threadline_test")
  throw new Error("Only the isolated local threadline_test database is allowed");
const admin = new PrismaClient({ datasources: { db: { url: raw } } });
const suffix = randomBytes(8).toString("hex");
const role = `dg_reader_${suffix}`;
const password = randomBytes(32).toString("hex");
const id = `demo-sql-${suffix}`;
url.username = role;
url.password = password;
const reader = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let created = false;
try {
  // Identifiers and password are generated hex, never request-controlled values.
  await admin.$executeRawUnsafe(
    `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`,
  );
  created = true;
  await admin.$executeRawUnsafe(`GRANT CONNECT ON DATABASE threadline_test TO ${role}`);
  await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await admin.$executeRawUnsafe(
    `GRANT SELECT ON public."Product", public."ProductSize", public."SandboxOrder" TO ${role}`,
  );
  await assert.rejects(checkThreadlineDatabase(admin, "staging"), /read-only role/);
  const before = await checkThreadlineDatabase(reader, "staging");
  await assert.rejects(reader.$executeRaw`DELETE FROM public."SandboxOrder" WHERE id = ${id}`);
  await assert.rejects(checkThreadlineDatabase(reader, "staging'; DROP TABLE x;--"));
  await admin.$executeRaw`INSERT INTO public."SandboxOrder" (id, environment, "idempotencyKey", "requestHash", "subtotalCents", "discountCents", "taxCents", "totalCents", items)
    VALUES (${id}, 'staging', ${id}, 'demo-only', 100, 0, 0, 100,
      ${JSON.stringify([{ productId: id, size: "S", quantity: 2, unitPriceCents: 100, lineTotalCents: 200 }])}::jsonb)`;
  const after = await checkThreadlineDatabase(reader, "staging");
  assert.equal(after[0]?.violations, before[0]?.violations);
  assert.equal(after[1]!.violations, before[1]!.violations + 1);
  assert.equal(after[2]!.violations, before[2]!.violations + 1);
  assert.equal(after[1]?.status, "FAIL");
  assert.equal(after[2]?.status, "FAIL");
  await admin.$executeRawUnsafe(`GRANT UPDATE ON public."SandboxOrder" TO ${role}`);
  await assert.rejects(checkThreadlineDatabase(reader, "staging"), /write privileges/);
  console.log(
    "PASS: read-only SQL execution, privileged/writable-role rejection, write denial, environment validation, seeded total/orphan detection",
  );
} finally {
  await reader.$disconnect();
  await admin.$executeRaw`DELETE FROM public."SandboxOrder" WHERE id = ${id}`;
  if (created) {
    await admin.$executeRawUnsafe(`DROP OWNED BY ${role}`);
    await admin.$executeRawUnsafe(`DROP ROLE ${role}`);
  }
  await admin.$disconnect();
}
