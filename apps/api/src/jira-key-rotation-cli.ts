import { PrismaClient } from "../generated/client/index.js";
import { rotateJiraKey } from "./jira-key-rotation.js";

const db = new PrismaClient();
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply") || args.length > 1)
    throw new Error("Unsupported arguments");
  const result = await rotateJiraKey(db, {
    oldKey: process.env.INTEGRATION_ENCRYPTION_KEY ?? "",
    newKey: process.env.INTEGRATION_ENCRYPTION_KEY_NEXT ?? "",
    apply: args.includes("--apply"),
    maintenanceConfirmed: process.env.JIRA_ROTATION_MAINTENANCE === "1",
  });
  console.log(JSON.stringify(result));
} catch {
  console.error(
    "Jira key rotation could not be confirmed. Keep services stopped and verify database state before retrying. Check keys, maintenance confirmation, database access and credential integrity privately.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
