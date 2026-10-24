"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { api, list, page, projectPath } from "../../lib/qa-api";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  OpenButton,
  SectionHeading,
  Submit,
  useWrite,
} from "./ui";

type Gate = { id: string; environment: string; revision: number; runIds: string[] };
type Release = { id: string; name: string; createdAt: string; gates: Gate[] };
type Candidate = {
  id: string;
  environment: string;
  createdAt: string;
  browser?: string;
  device?: string;
};

export function ReleasesView({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useInfiniteQuery({
    queryKey: ["project", projectId, "releases"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => page<Release>(projectPath(projectId, "/releases"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  if (selected)
    return (
      <ReleaseDetail
        projectId={projectId}
        id={selected}
        canWrite={canWrite}
        onBack={() => setSelected(null)}
      />
    );
  const rows = query.data?.pages.flatMap((part) => part.data) ?? [];
  return (
    <>
      <SectionHeading title="Releases">
        {canWrite && (
          <button className="qa-button qa-primary" type="button" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New release
          </button>
        )}
      </SectionHeading>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? (
        <Loading label="Loading releases" />
      ) : (
        <>
          {!query.isError && !rows.length && <Empty title="No releases" />}
          <div className="qa-record-list">
            {rows.map((release) => (
              <article key={release.id}>
                <h2>
                  <OpenButton onClick={() => setSelected(release.id)}>{release.name}</OpenButton>
                </h2>
                <p>{new Date(release.createdAt).toLocaleString()}</p>
                <p>
                  {release.gates.reduce((total, gate) => total + gate.runIds.length, 0)} linked runs
                  · Readiness not evaluated
                </p>
              </article>
            ))}
          </div>
          {query.hasNextPage && (
            <button
              className="qa-button"
              type="button"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              Load more releases
            </button>
          )}
        </>
      )}
      {creating && (
        <CreateRelease
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(release) => {
            setCreating(false);
            setSelected(release.id);
          }}
        />
      )}
    </>
  );
}

function CreateRelease({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (release: Release) => void;
}) {
  const [name, setName] = useState("");
  const write = useWrite<Release>(projectId, onCreated);
  return (
    <Modal title="New release" onClose={onClose} busy={write.isPending}>
      <form
        className="qa-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !write.isPending)
            write.mutate({
              path: projectPath(projectId, "/releases"),
              body: { name: name.trim() },
            });
        }}
      >
        <Field label="Release name">
          <input
            required
            maxLength={120}
            value={name}
            disabled={write.isPending}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <ErrorNotice error={write.error} />
        <Submit pending={write.isPending}>Create release</Submit>
      </form>
    </Modal>
  );
}

function ReleaseDetail({
  projectId,
  id,
  canWrite,
  onBack,
}: {
  projectId: string;
  id: string;
  canWrite: boolean;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["project", projectId, "release", id],
    queryFn: () => api<Release>(projectPath(projectId, `/releases/${id}`)),
  });
  const gate = query.data?.gates.find((item) => item.environment === editing);
  return (
    <>
      <button type="button" className="qa-button qa-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        All releases
      </button>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? (
        <Loading label="Loading release" />
      ) : (
        query.data && (
          <>
            <SectionHeading title={query.data.name} />
            <p className="muted">Readiness not evaluated · No sign-off recorded</p>
            <div className="qa-record-list">
              {query.data.gates.map((item) => (
                <section
                  key={item.id}
                  aria-label={`${item.environment} gate`}
                  className="qa-release-gate"
                >
                  <h2>{item.environment}</h2>
                  <p>{item.runIds.length} linked runs</p>
                  <GateReadiness projectId={projectId} releaseId={id} gate={item} />
                  {item.runIds.length > 0 && (
                    <ul>
                      {item.runIds.map((runId) => (
                        <li key={runId}>
                          <code>{runId}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canWrite && (
                    <button
                      type="button"
                      className="qa-button"
                      onClick={() => setEditing(item.environment)}
                    >
                      Select runs<span className="sr-only"> for {item.environment}</span>
                    </button>
                  )}
                </section>
              ))}
            </div>
            {canWrite && gate && (
              <GateRuns
                key={`${gate.id}-${gate.revision}`}
                projectId={projectId}
                releaseId={id}
                gate={gate}
                onClose={() => setEditing(null)}
                refresh={() => void query.refetch()}
              />
            )}
          </>
        )
      )}
    </>
  );
}

function GateReadiness({
  projectId,
  releaseId,
  gate,
}: {
  projectId: string;
  releaseId: string;
  gate: Gate;
}) {
  const query = useQuery({
    queryKey: ["project", projectId, "readiness", releaseId, gate.environment, gate.revision],
    queryFn: () =>
      api<{
        assessedAt: string;
        score: number | null;
        eligible: boolean;
        components: {
          name: string;
          points: number | null;
          weight: number;
          reason: string | null;
        }[];
        sourceProblems: string[];
      }>(projectPath(projectId, `/releases/${releaseId}/gates/${gate.environment}/readiness`)),
    enabled: false,
  });
  const labels: Record<string, string> = {
    criticalTests: "High-priority tests",
    defects: "Defects",
    drift: "Environment differences",
    visual: "Visual reviews",
    accessibility: "Accessibility",
  };
  return (
    <div>
      <button
        className="qa-button"
        type="button"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        {query.isFetching ? "Checking readiness..." : "Check readiness"}
        <span className="sr-only"> for {gate.environment}</span>
      </button>
      <ErrorNotice error={query.error} />
      {query.data && !query.isFetching && (
        <>
          <p role="status">
            {query.data.score === null
              ? "Incomplete evidence"
              : `Readiness: ${query.data.score}/100`}{" "}
            · {query.data.eligible ? "Criteria met" : "Not ready for sign-off"}
          </p>
          <p>
            Checked {new Date(query.data.assessedAt).toLocaleString()}. This is not an approval.
          </p>
          <ul>
            {query.data.components.map((part) => (
              <li key={part.name}>
                {labels[part.name] ?? part.name}:{" "}
                {part.reason
                  ? part.reason.toLowerCase().replaceAll("_", " ")
                  : `${part.points}/${part.weight}`}
              </li>
            ))}
          </ul>
          {query.data.sourceProblems.length > 0 && (
            <p>
              Some linked evidence is unavailable or exceeds supported limits. Review the run
              selection.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function GateRuns({
  projectId,
  releaseId,
  gate,
  onClose,
  refresh,
}: {
  projectId: string;
  releaseId: string;
  gate: Gate;
  onClose: () => void;
  refresh: () => void;
}) {
  const [selected, setSelected] = useState(gate.runIds);
  const candidates = useQuery({
    queryKey: ["project", projectId, "release-run-candidates"],
    queryFn: async () => {
      const manual = await list<Candidate>(projectPath(projectId, "/runs"));
      const automated = await list<Candidate>(projectPath(projectId, "/automated-runs"));
      return [
        ...manual.map((run) => ({ ...run, mode: "Manual" })),
        ...automated.map((run) => ({ ...run, mode: "Automated" })),
      ];
    },
  });
  const write = useWrite(projectId, onClose);
  const rows =
    candidates.data?.filter((run) => run.environment.toUpperCase() === gate.environment) ?? [];
  const missing = selected.filter((id) => !rows.some((run) => run.id === id));
  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  }
  return (
    <Modal title={`${gate.environment} runs`} onClose={onClose} busy={write.isPending}>
      <ErrorNotice error={candidates.error} retry={() => void candidates.refetch()} />
      {candidates.isPending ? (
        <Loading label="Loading runs" />
      ) : (
        !candidates.isError && (
          <form
            className="qa-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!write.isPending && selected.length <= 100)
                write.mutate({
                  path: projectPath(
                    projectId,
                    `/releases/${releaseId}/gates/${gate.environment}/runs`,
                  ),
                  method: "PUT",
                  body: { revision: gate.revision, runIds: selected },
                });
            }}
          >
            <fieldset disabled={write.isPending} className="qa-release-selection">
              <legend>Linked runs ({selected.length}/100)</legend>
              {!rows.length && <p>No matching runs</p>}
              <div className="qa-checkbox-list">
                {rows.map((run) => (
                  <label key={run.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(run.id)}
                      disabled={selected.length >= 100 && !selected.includes(run.id)}
                      onChange={(event) => toggle(run.id, event.target.checked)}
                    />
                    <span>
                      {run.mode} · {new Date(run.createdAt).toLocaleString()}
                      <small>
                        {run.browser} {run.device}
                      </small>
                      <small>{run.id}</small>
                    </span>
                  </label>
                ))}
                {missing.map((id) => (
                  <label key={id}>
                    <input type="checkbox" checked onChange={() => toggle(id, false)} />
                    <span>
                      Unavailable run<small>{id}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <ErrorNotice error={write.error} retry={refresh} />
            <Submit pending={write.isPending}>Save run selection</Submit>
          </form>
        )
      )}
    </Modal>
  );
}
