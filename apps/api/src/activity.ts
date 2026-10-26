import type { PrismaClient } from "../generated/client/index.js";

/** Bounded summaries only: never include evidence, credentials or event comments. */
export async function recentActivity(db: PrismaClient, projectId: string) {
  const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
  const [runs, releases, defects] = await Promise.all([
    db.run.findMany({
      where: { projectId },
      orderBy,
      take: 10,
      select: { id: true, createdAt: true, mode: true, environment: true },
    }),
    db.release.findMany({
      where: { projectId },
      orderBy,
      take: 10,
      select: { id: true, createdAt: true, name: true },
    }),
    db.defectEvent.findMany({
      where: { defect: { projectId } },
      orderBy,
      take: 10,
      select: { id: true, createdAt: true, toStatus: true, defect: { select: { title: true } } },
    }),
  ]);
  return [
    ...runs.map((r) => ({
      id: `run:${r.id}`,
      occurredAt: r.createdAt,
      title: `${r.mode === "MANUAL" ? "Manual" : "Automated"} run created`,
      detail: r.environment,
    })),
    ...releases.map((r) => ({
      id: `release:${r.id}`,
      occurredAt: r.createdAt,
      title: "Release created",
      detail: r.name,
    })),
    ...defects.map((r) => ({
      id: `defect:${r.id}`,
      occurredAt: r.createdAt,
      title: `Defect ${r.toStatus.toLowerCase().replaceAll("_", " ")}`,
      detail: r.defect.title,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, 10);
}
