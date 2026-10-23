"use client";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { api, page, projectPath } from "../../lib/qa-api";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  OpenButton,
  SectionHeading,
  Submit,
  useWrite,
} from "./ui";

type Defect = {
  id: string;
  resultId: string;
  title: string;
  severity: string;
  status: string;
  revision: number;
  createdAt: string;
  reproduction: {
    runId: string;
    environment: string;
    browser: string;
    device: string;
    actual: string;
    steps: { action: string; expected: string }[];
    evidenceIds: string[];
  };
  events: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    comment: string;
    actorId: string;
    createdAt: string;
  }[];
};
const transitions: Record<string, string[]> = {
  NEW: ["OPEN"],
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["FIXED"],
  FIXED: ["RETEST"],
  RETEST: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS"],
};
const label = (value: string) => value.replaceAll("_", " ");

export function CreateDefect({ projectId, resultId }: { projectId: string; resultId: string }) {
  const [severity, setSeverity] = useState("S2");
  const write = useWrite<Defect>(projectId);
  return (
    <form
      className="qa-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!write.isPending)
          write.mutate({ path: projectPath(projectId, "/defects"), body: { resultId, severity } });
      }}
    >
      <Field label="Defect severity">
        <select
          value={severity}
          disabled={write.isPending || write.isSuccess}
          onChange={(event) => setSeverity(event.target.value)}
        >
          {["S1", "S2", "S3", "S4"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </Field>
      {write.isSuccess ? (
        <p role="status">
          Defect saved: {write.data.severity} · {label(write.data.status)}
        </p>
      ) : (
        <Submit pending={write.isPending}>Create defect</Submit>
      )}
      <ErrorNotice error={write.error} />
    </form>
  );
}

export function DefectsView({ projectId, role }: { projectId: string; role: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["project", projectId, "defects"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => page<Defect>(projectPath(projectId, "/defects"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  if (selected)
    return (
      <DefectDetail
        projectId={projectId}
        id={selected}
        role={role}
        onBack={() => setSelected(null)}
      />
    );
  const rows = query.data?.pages.flatMap((part) => part.data) ?? [];
  return (
    <>
      <SectionHeading title="Defects" />
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? (
        <Loading label="Loading defects" />
      ) : (
        <>
          {!query.isError && !rows.length && <Empty title="No defects" />}
          <div className="qa-record-list">
            {rows.map((row) => (
              <article key={row.id}>
                <h2>
                  <OpenButton onClick={() => setSelected(row.id)}>{row.title}</OpenButton>
                </h2>
                <p>
                  {row.severity} · {label(row.status)} ·{" "}
                  {row.reproduction.environment.toUpperCase()}
                </p>
                <p>
                  {row.reproduction.browser} · {row.reproduction.device} ·{" "}
                  {new Date(row.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
          {query.hasNextPage && (
            <button
              type="button"
              className="qa-button"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              Load more defects
            </button>
          )}
        </>
      )}
    </>
  );
}

function DefectDetail({
  projectId,
  id,
  role,
  onBack,
}: {
  projectId: string;
  id: string;
  role: string;
  onBack: () => void;
}) {
  const query = useQuery({
    queryKey: ["project", projectId, "defect", id],
    queryFn: () => api<Defect>(projectPath(projectId, `/defects/${id}`)),
  });
  return (
    <>
      <button type="button" className="qa-button qa-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        All defects
      </button>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? (
        <Loading label="Loading defect" />
      ) : (
        query.data && (
          <>
            <SectionHeading title={query.data.title} />
            <p>
              {query.data.severity} · {label(query.data.status)} ·{" "}
              {query.data.reproduction.environment.toUpperCase()}
            </p>
            <p>
              {query.data.reproduction.browser} · {query.data.reproduction.device}
            </p>
            <h2>Reproduction</h2>
            <ol>
              {query.data.reproduction.steps.map((step, index) => (
                <li key={index}>
                  <p>{step.action}</p>
                  <p>Expected: {step.expected}</p>
                </li>
              ))}
            </ol>
            <h3>Actual result</h3>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {query.data.reproduction.actual}
            </p>
            <h3>Evidence</h3>
            {!query.data.reproduction.evidenceIds.length ? (
              <p>No evidence attached</p>
            ) : (
              query.data.reproduction.evidenceIds.map((evidenceId, index) => (
                <DefectEvidence
                  key={evidenceId}
                  projectId={projectId}
                  defect={query.data!}
                  evidenceId={evidenceId}
                  number={index + 1}
                />
              ))
            )}
            <TransitionForm
              key={`${id}-${query.data.revision}`}
              projectId={projectId}
              defect={query.data}
              role={role}
              refresh={() => void query.refetch()}
            />
            <h2>Status history</h2>
            <div className="qa-record-list">
              {query.data.events.map((event) => (
                <article key={event.id}>
                  <h3>{label(event.toStatus)}</h3>
                  <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {event.comment}
                  </p>
                  <p>{new Date(event.createdAt).toLocaleString()}</p>
                  <p style={{ overflowWrap: "anywhere" }}>Actor: {event.actorId}</p>
                </article>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}

function DefectEvidence({
  projectId,
  defect,
  evidenceId,
  number,
}: {
  projectId: string;
  defect: Defect;
  evidenceId: string;
  number: number;
}) {
  const query = useQuery({
    queryKey: ["project", projectId, "defect-evidence", evidenceId],
    queryFn: () =>
      api<{ url: string }>(
        projectPath(
          projectId,
          `/runs/${defect.reproduction.runId}/results/${defect.resultId}/evidence/${evidenceId}/url`,
        ),
      ),
    enabled: false,
  });
  return (
    <div>
      <button
        type="button"
        className="qa-button"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        <ExternalLink size={16} aria-hidden="true" />
        Evidence {number}
      </button>
      {query.data && (
        <a className="qa-link" href={query.data.url} target="_blank" rel="noopener noreferrer">
          Open evidence {number}
        </a>
      )}
      <ErrorNotice error={query.error} />
    </div>
  );
}

function TransitionForm({
  projectId,
  defect,
  role,
  refresh,
}: {
  projectId: string;
  defect: Defect;
  role: string;
  refresh: () => void;
}) {
  const allowed = (transitions[defect.status] ?? []).filter(
    (status) =>
      ["ADMIN", "QA"].includes(role) ||
      (role === "DEVELOPER" && ["IN_PROGRESS", "FIXED"].includes(status)),
  );
  const [status, setStatus] = useState(allowed[0] ?? "");
  const [comment, setComment] = useState("");
  const write = useWrite(projectId);
  if (!allowed.length) return null;
  return (
    <form
      className="qa-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!write.isPending && comment.trim())
          write.mutate({
            path: projectPath(projectId, `/defects/${defect.id}/transitions`),
            body: { status, comment: comment.trim(), revision: defect.revision },
          });
      }}
    >
      <Field label="Next status">
        <select
          value={status}
          disabled={write.isPending}
          onChange={(event) => setStatus(event.target.value)}
        >
          {allowed.map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Change comment">
        <textarea
          required
          maxLength={4000}
          value={comment}
          disabled={write.isPending}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
      <Submit pending={write.isPending}>Update status</Submit>
      <ErrorNotice error={write.error} retry={refresh} />
    </form>
  );
}
