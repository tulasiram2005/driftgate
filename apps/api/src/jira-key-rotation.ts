import type { PrismaClient } from "../generated/client/index.js";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "./integration-secrets.js";

/** Offline maintenance operation. Stop every API and worker before applying. */
export async function rotateJiraKey(
  db: PrismaClient,
  options: { oldKey: string; newKey: string; apply?: boolean; maintenanceConfirmed?: boolean },
) {
  const { oldKey, newKey, apply = false, maintenanceConfirmed = false } = options;
  if (
    ![oldKey, newKey].every((key) => /^[a-f0-9]{64}$/i.test(key)) ||
    oldKey.toLowerCase() === newKey.toLowerCase()
  )
    throw new Error("Two distinct valid encryption keys are required");
  if (apply && !maintenanceConfirmed)
    throw new Error("Stop API and worker processes before applying rotation");
  return db.$transaction(
    async (tx) => {
      // Prevent settings changes during this transaction; this does not stop
      // already-running processes from using an old key after commit.
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      await tx.$executeRawUnsafe('LOCK TABLE "JiraIntegration" IN SHARE ROW EXCLUSIVE MODE');
      const rows = await tx.jiraIntegration.findMany({ where: { connected: true }, take: 10001 });
      if (rows.length > 10000) throw new Error("Rotation exceeds the supported batch size");
      for (const row of rows) {
        const plaintext = decryptIntegrationSecret(
          row.encryptedCredentials,
          oldKey,
          row.projectId,
          "jira",
        );
        const encryptedCredentials = encryptIntegrationSecret(
          plaintext,
          newKey,
          row.projectId,
          "jira",
        );
        if (
          decryptIntegrationSecret(encryptedCredentials, newKey, row.projectId, "jira") !==
          plaintext
        )
          throw new Error("Rotation verification failed");
        if (apply) {
          await tx.jiraIntegration.update({
            where: { projectId: row.projectId },
            data: { encryptedCredentials, revision: { increment: 1 } },
          });
          await tx.jiraIntegrationEvent.create({
            data: {
              projectId: row.projectId,
              actorId: "system:key-rotation",
              revision: row.revision + 1,
              action: "KEY_ROTATED",
            },
          });
        }
      }
      return { checked: rows.length, applied: apply };
    },
    { timeout: 60000, maxWait: 5000 },
  );
}
