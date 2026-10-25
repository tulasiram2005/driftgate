"use client";

import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { api, list, page, projectPath, exportRelease } from "../../lib/qa-api";
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

export function ReleasesView({
  projectId,
  canWrite,
  canApprove = false,
}: {
  projectId: string;
  canWrite: boolean;
  canApprove?: boolean;
}) {
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
        canApprove={canApprove}
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
  canApprove,
  onBack,
}: {
  projectId: string;
  id: string;
  canWrite: boolean;
  canApprove: boolean;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);
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
            <SectionHeading title={query.data.name}>
              <button
                type="button"
                className="qa-button"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  setExportError(null);
                  try {
                    await exportRelease(projectId, id);
                  } catch (error) {
                    setExportError(
                      error instanceof Error ? error : new Error("Report export failed"),
                    );
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? "Preparing PDF..." : "Export release PDF"}
              </button>
            </SectionHeading>
            <ErrorNotice error={exportError} />
            <p className="muted">Review evidence and approve each environment in order.</p>
            <ReleaseApprovals
              key={query.data.gates.map((item) => `${item.id}:${item.revision}`).join(",")}
              projectId={projectId}
              releaseId={id}
              canApprove={canApprove}
            />
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

type Signoff = {
  id: string;
  environment: string;
  approverName: string;
  approverId: string;
  createdAt: string;
  comment: string;
  sequence: number;
  hash: string;
};
type ApprovalState = {
  verification: { valid: boolean; count: number; firstInvalidSequence: number | null };
  records: Signoff[];
  gates: {
    environment: string;
    current: boolean;
    precedingValid: boolean;
    signoff: Signoff | null;
    readiness: { eligible: boolean; gateRevision: number; evidenceHash: string } | null;
  }[];
};

function ReleaseApprovals({
  projectId,
  releaseId,
  canApprove,
}: {
  projectId: string;
  releaseId: string;
  canApprove: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const query = useQuery({
    queryKey: ["project", projectId, "release-approvals", releaseId],
    queryFn: () => api<ApprovalState>(projectPath(projectId, `/releases/${releaseId}/signoffs`)),
    enabled: false,
  });
  const write = useWrite(projectId, () => {
    setSelected(null);
    setComment("");
    void query.refetch();
  });
  const gate = query.data?.gates.find((item) => item.environment === selected);
  return (
    <section aria-label="Release approvals" className="qa-release-gate">
      <h2>Approvals and audit trail</h2>
      <p>
        Staging, UAT, Pre-Production, then Production. Changed or expired evidence requires a new
        approval.
      </p>
      <button
        className="qa-button"
        type="button"
        disabled={query.isFetching || write.isPending}
        onClick={() => {
          setSelected(null);
          void query.refetch();
        }}
      >
        {query.isFetching ? "Verifying..." : "Verify chain and approvals"}
      </button>
      <ErrorNotice error={query.error} />
      {query.data && !query.isFetching && !query.isError && (
        <>
          <p role="status">
            {query.data.verification.valid
              ? `Audit chain verified: ${query.data.verification.count} recorded approvals`
              : "Audit verification failed. Sign-off is blocked."}
          </p>
          <p>
            Checked {new Date(query.dataUpdatedAt).toLocaleString()}. Verify again after changing
            evidence.
          </p>
          <p className="muted">
            Verification checks stored records and current evidence. It cannot prove integrity
            against an administrator who rewrites the entire database.
          </p>
          <div className="qa-record-list">
            {query.data.gates.map((item) => (
              <article key={item.environment}>
                <h3>{item.environment}</h3>
                <p>
                  {item.current
                    ? "Current approval"
                    : item.signoff
                      ? "Approval no longer current"
                      : "No approval recorded"}
                </p>
                {!item.precedingValid && <p>Waiting for current approval of earlier gates.</p>}
                {!item.readiness?.eligible && (
                  <p>Exit criteria are not met. Check readiness below for details.</p>
                )}
                {item.signoff && (
                  <p>
                    Last signed by {item.signoff.approverName} at{" "}
                    {new Date(item.signoff.createdAt).toLocaleString()}
                  </p>
                )}
                {canApprove &&
                  query.data!.verification.valid &&
                  item.precedingValid &&
                  item.readiness?.eligible &&
                  !item.current && (
                    <button
                      type="button"
                      className="qa-button"
                      onClick={() => {
                        write.reset();
                        setComment("");
                        setSelected(item.environment);
                      }}
                    >
                      Sign off {item.environment}
                    </button>
                  )}
              </article>
            ))}
          </div>
          {!canApprove && <p>A project member with the Approver role must sign off.</p>}
          {query.data.records.length > 0 && (
            <details>
              <summary>Approval history ({query.data.records.length})</summary>
              <ol>
                {query.data.records.map((record) => (
                  <li key={record.id}>
                    <p>
                      {record.environment} · {record.approverName} ·{" "}
                      {new Date(record.createdAt).toLocaleString()}
                    </p>
                    <p>{record.comment}</p>
                    <p>Reviewer: {record.approverId}</p>
                    <p style={{ overflowWrap: "anywhere" }}>Record hash: {record.hash}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
      {gate?.readiness && selected && (
        <Modal
          title={`Sign off ${selected}`}
          onClose={() => setSelected(null)}
          busy={write.isPending}
        >
          <form
            className="qa-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!write.isPending && comment.trim() && gate.readiness)
                write.mutate({
                  path: projectPath(projectId, `/releases/${releaseId}/gates/${selected}/signoff`),
                  body: {
                    comment: comment.trim(),
                    gateRevision: gate.readiness.gateRevision,
                    evidenceHash: gate.readiness.evidenceHash,
                  },
                });
            }}
          >
            <p>
              This records your name, time and reviewed evidence permanently in the release history.
              Evidence is checked again when you submit.
            </p>
            <Field label="Approval comment">
              <textarea
                required
                maxLength={2000}
                value={comment}
                disabled={write.isPending}
                onChange={(event) => setComment(event.target.value)}
              />
            </Field>
            <ErrorNotice error={write.error} />
            <Submit pending={write.isPending}>Record approval</Submit>
          </form>
        </Modal>
      )}
    </section>
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
