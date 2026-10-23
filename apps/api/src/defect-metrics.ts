import type { PrismaClient } from "../generated/client/index.js";

/** Project-wide aggregates, not a summary of the visible paginated rows. */
export async function defectMetrics(db: PrismaClient, projectId: string) {
  const [row] = await db.$queryRaw<
    {
      total: number;
      open: number;
      closed: number;
      openS1: number;
      oldestOpenHours: number | null;
      meanResolutionHours: number | null;
      resolvedWithHistory: number;
    }[]
  >`
    WITH defects AS (
      SELECT d.*, (
        SELECT MAX(e."createdAt") FROM "DefectEvent" e
        WHERE e."defectId" = d.id AND e."toStatus" = 'CLOSED'
      ) AS closed_at
      FROM "Defect" d WHERE d."projectId" = ${projectId}
    )
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'CLOSED')::int AS open,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
      COUNT(*) FILTER (WHERE status <> 'CLOSED' AND severity = 'S1')::int AS "openS1",
      MAX(GREATEST(0, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - "createdAt")) / 3600))
        FILTER (WHERE status <> 'CLOSED')::float8 AS "oldestOpenHours",
      AVG(EXTRACT(EPOCH FROM (closed_at - "createdAt")) / 3600)
        FILTER (WHERE status = 'CLOSED' AND closed_at >= "createdAt")::float8 AS "meanResolutionHours",
      COUNT(*) FILTER (WHERE status = 'CLOSED' AND closed_at >= "createdAt")::int AS "resolvedWithHistory"
    FROM defects
  `;
  return {
    ...row!,
    definition:
      "Creation to latest closure for currently closed defects; reopened defects excluded.",
  };
}
