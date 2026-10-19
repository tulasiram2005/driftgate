import { PrismaClient } from "@prisma/client";

const globalDb = globalThis as unknown as { threadlineDb?: PrismaClient };
export function getDb(): PrismaClient {
  if (!globalDb.threadlineDb) globalDb.threadlineDb = new PrismaClient();
  return globalDb.threadlineDb;
}
