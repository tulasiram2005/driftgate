"use client";

import { useQuery } from "@tanstack/react-query";
import { api, page, projectPath } from "../../lib/qa-api";
import { Empty, ErrorNotice, Loading, SectionHeading } from "./ui";
import { GateReadiness } from "./releases";

type Metrics = { open: number; closed: number; openS1: number; oldestOpenHours: number | null };
type Activity = { id: string; occurredAt: string; title: string; detail: string };
type Release = {
  id: string;
  name: string;
  createdAt: string;
  gates: { id: string; environment: string; revision: number; runIds: string[] }[];
};

export function Overview({
  projectId,
  onNavigate,
}: {
  projectId: string;
  onNavigate: (view: "defects" | "releases" | "cases") => void;
}) {
  const metrics = useQuery({
    queryKey: ["project", projectId, "defect-metrics"],
    queryFn: () => api<Metrics>(projectPath(projectId, "/defects/metrics")),
  });
  const releases = useQuery({
    queryKey: ["project", projectId, "overview-releases"],
    queryFn: () => page<Release>(projectPath(projectId, "/releases"), null),
  });
  const activity = useQuery({
    queryKey: ["project", projectId, "overview-activity"],
    queryFn: () => api<Activity[]>(projectPath(projectId, "/activity")),
  });
  return (
    <>
      <SectionHeading title="Overview" description="Your project’s quality signals and next steps.">
        <button
          className="qa-button"
          type="button"
          disabled={metrics.isFetching || releases.isFetching || activity.isFetching}
          onClick={() => {
            void metrics.refetch();
            void releases.refetch();
            void activity.refetch();
          }}
        >
          Refresh overview
        </button>
      </SectionHeading>
      <section aria-label="Project quality signals">
        <h2>What needs attention</h2>
        <ErrorNotice error={metrics.error} retry={() => void metrics.refetch()} />
        {metrics.isPending ? (
          <Loading label="Loading quality signals" />
        ) : !metrics.isError && metrics.data ? (
          <>
            <dl className="qa-defect-metrics">
              <div>
                <dt>Open defects</dt>
                <dd>{metrics.data.open}</dd>
              </div>
              <div>
                <dt>Open S1 blockers</dt>
                <dd>{metrics.data.openS1}</dd>
              </div>
              <div>
                <dt>Closed defects</dt>
                <dd>{metrics.data.closed}</dd>
              </div>
              <div>
                <dt>Oldest open defect</dt>
                <dd>
                  {metrics.data.oldestOpenHours === null
                    ? "None"
                    : `${metrics.data.oldestOpenHours.toFixed(1)} h`}
                </dd>
              </div>
            </dl>
            <p>
              {metrics.data.openS1 > 0
                ? "Open S1 defects block release approval. Review these first."
                : "No open S1 defects. Other release checks may still block approval."}
            </p>
            <p>
              Project-wide totals. Updated {new Date(metrics.dataUpdatedAt).toLocaleTimeString()}.
            </p>
          </>
        ) : null}
        <button type="button" className="qa-button" onClick={() => onNavigate("defects")}>
          Review defects
        </button>
      </section>
      <section className="qa-overview-releases" aria-label="Saved releases">
        <h2>Release work</h2>
        <p>Open Releases to evaluate current evidence and review approvals.</p>
        <ErrorNotice error={releases.error} retry={() => void releases.refetch()} />
        {releases.isPending ? (
          <Loading label="Loading release work" />
        ) : !releases.isError && releases.data ? (
          <>
            {!releases.data.data.length && (
              <Empty title="No releases yet">
                Create test cases and runs, then collect them into a release.
              </Empty>
            )}
            <div className="qa-record-list">
              {releases.data.data.slice(0, 5).map((release) => (
                <article key={release.id}>
                  <h3>{release.name}</h3>
                  <p>
                    Created {new Date(release.createdAt).toLocaleDateString()} ·{" "}
                    {release.gates.reduce((n, gate) => n + gate.runIds.length, 0)} linked runs
                  </p>
                  <details className="qa-overview-gates">
                    <summary>Inspect readiness for {release.name}</summary>
                    <p>
                      Check each environment against its current evidence. Checks do not approve a
                      release.
                    </p>
                    {release.gates.map((gate) => (
                      <section
                        key={gate.id}
                        aria-label={`${release.name} ${gate.environment} readiness`}
                      >
                        <h4>{gate.environment}</h4>
                        <GateReadiness projectId={projectId} releaseId={release.id} gate={gate} />
                      </section>
                    ))}
                  </details>
                </article>
              ))}
            </div>
            {(releases.data.nextCursor || releases.data.data.length > 5) && (
              <p>Showing five saved releases. Open Releases for the full list.</p>
            )}
          </>
        ) : null}
        <div className="qa-actions">
          <button
            type="button"
            className="qa-button qa-primary"
            onClick={() => onNavigate("releases")}
          >
            Review releases
          </button>
          <button type="button" className="qa-button" onClick={() => onNavigate("cases")}>
            Manage test cases
          </button>
        </div>
      </section>
      <section className="qa-overview-releases" aria-label="Recent activity">
        <h2>Recent activity</h2>
        <p>Latest ten run creations, release creations and defect status events in this project.</p>
        <ErrorNotice error={activity.error} retry={() => void activity.refetch()} />
        {activity.isPending ? (
          <Loading label="Loading recent activity" />
        ) : !activity.isError && activity.data ? (
          activity.data.length ? (
            <ol className="qa-activity-list">
              {activity.data.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <time dateTime={item.occurredAt}>
                    {new Date(item.occurredAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <Empty title="No activity yet">
              Create a run or release to begin recording activity.
            </Empty>
          )
        ) : null}
      </section>
    </>
  );
}
