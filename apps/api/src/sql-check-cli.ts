import { PrismaClient } from "../generated/client/index.js";
import { checkThreadlineDatabase } from "./sql-checks.js";

const url = process.env.THREADLINE_READONLY_DATABASE_URL;
if (!url)
  throw new Error("Configure THREADLINE_READONLY_DATABASE_URL privately before running SQL checks");
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const results = await checkThreadlineDatabase(db, process.env.SQL_CHECK_ENVIRONMENT ?? "staging");
  console.log(JSON.stringify({ results }));
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
} catch {
  // Database errors may include server details or credentials. Do not print them.
  console.error(
    "SQL checks could not complete. Verify the read-only role, schema, environment and connectivity.",
  );
  process.exitCode = 2;
} finally {
  await db.$disconnect();
}
