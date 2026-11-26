"use client";
import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Link2, RefreshCw, Search, X } from "lucide-react";
import { api, page, projectPath } from "../../lib/qa-api";
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
  const [view, setView] = useState<"list" | "board">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", status: "", severity: "" });
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = useInfiniteQuery({
    queryKey: ["project", projectId, "defects", filters],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      page<Defect>(projectPath(projectId, `/defects?${params}`), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const metrics = useQuery({
    queryKey: ["project", projectId, "defect-metrics"],
    queryFn: () =>
      api<{
        total: number;
        open: number;
        closed: number;
        openS1: number;
        oldestOpenHours: number | null;
        meanResolutionHours: number | null;
        resolvedWithHistory: number;
      }>(projectPath(projectId, "/defects/metrics")),
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
      <SectionHeading title="Defects">
        <div className="qa-actions" role="group" aria-label="Defect view">
          {(["list", "board"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className="qa-button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode === "list" ? "List view" : "Board view"}
            </button>
          ))}
        </div>
      </SectionHeading>
      <ErrorNotice error={metrics.error} retry={() => void metrics.refetch()} />
      {metrics.data && (
        <section aria-label="Project-wide defect metrics">
          <h2>Project totals</h2>
          <dl className="qa-defect-metrics">
            <div>
              <dt>Open</dt>
              <dd>{metrics.data.open}</dd>
            </div>
            <div>
              <dt>Closed</dt>
              <dd>{metrics.data.closed}</dd>
            </div>
            <div>
              <dt>Open S1</dt>
              <dd>{metrics.data.openS1}</dd>
            </div>
            <div>
              <dt>Oldest open</dt>
              <dd>
                {metrics.data.oldestOpenHours === null
                  ? "Not available"
                  : `${metrics.data.oldestOpenHours.toFixed(1)} h`}
              </dd>
            </div>
            <div>
              <dt>Mean time to closure</dt>
              <dd>
                {metrics.data.meanResolutionHours === null
                  ? "Not available"
                  : `${metrics.data.meanResolutionHours.toFixed(1)} h`}
              </dd>
            </div>
            <div>
              <dt>Resolution sample</dt>
              <dd>{metrics.data.resolvedWithHistory}</dd>
            </div>
          </dl>
        </section>
      )}
      <form
        className="qa-form"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ ...filters, search: search.trim() });
        }}
      >
        <Field label="Search defects">
          <input
            type="search"
            maxLength={200}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field label="Filter status">
          <select
            value={filters.status}
            onChange={(event) => setFilters({ ...filters, status: event.target.value })}
          >
            <option value="">All statuses</option>
            {Object.keys(transitions).map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Filter severity">
          <select
            value={filters.severity}
            onChange={(event) => setFilters({ ...filters, severity: event.target.value })}
          >
            <option value="">All severities</option>
            {["S1", "S2", "S3", "S4"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <div className="qa-actions">
          <button type="submit" className="qa-button">
            <Search size={16} aria-hidden="true" />
            Search
          </button>
          <button
            type="button"
            className="qa-button"
            onClick={() => {
              setSearch("");
              setFilters({ search: "", status: "", severity: "" });
            }}
          >
            <X size={16} aria-hidden="true" />
            Clear filters
          </button>
        </div>
      </form>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? (
        <Loading label="Loading defects" />
      ) : (
        <>
          {!query.isError && !rows.length && (
            <Empty
              title={Object.values(filters).some(Boolean) ? "No matching defects" : "No defects"}
            />
          )}
          {view === "board" ? (
            <>
              <p role="status">
                {rows.length} loaded matching defects
                {query.hasNextPage ? "; more available below" : ""}. Column counts reflect loaded
                results.
              </p>
              <p>Open a card to review evidence and change its status with a comment.</p>
              <div className="qa-defect-board" aria-label="Defect status board">
                {Object.keys(transitions)
                  .filter((status) => !filters.status || status === filters.status)
                  .map((status) => {
                    const cards = rows.filter((row) => row.status === status);
                    return (
                      <section
                        key={status}
                        aria-label={`${label(status)} defects`}
                        className="qa-defect-column"
                      >
                        <h2>
                          {label(status)} <span className="muted">({cards.length})</span>
                        </h2>
                        {!cards.length && <p className="muted">No loaded defects</p>}
                        {cards.map((row) => (
                          <article key={row.id} className="qa-defect-card">
                            <p>
                              {row.severity} · {row.reproduction.environment.toUpperCase()}
                            </p>
                            <h3>
                              <OpenButton onClick={() => setSelected(row.id)}>
                                {row.title}
                              </OpenButton>
                            </h3>
                            <p>
                              {row.reproduction.browser} · {row.reproduction.device}
                            </p>
                            <time dateTime={row.createdAt}>
                              {new Date(row.createdAt).toLocaleDateString()}
                            </time>
                          </article>
                        ))}
                      </section>
                    );
                  })}
              </div>
            </>
          ) : (
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
          )}
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
            <JiraExport projectId={projectId} defect={query.data} role={role} />
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

type JiraExportRecord = {
  canReconcile?: boolean;
  site: string;
  jiraProjectKey: string;
  state: "PENDING" | "LINKED" | "REVIEW_REQUIRED";
  issueKey: string | null;
  issueUrl: string | null;
  jiraStatusName: string | null;
  statusSyncedAt: string | null;
  syncRevision: number;
};

function JiraExport({
  projectId,
  defect,
  role,
}: {
  projectId: string;
  defect: Defect;
  role: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const path = projectPath(projectId, `/defects/${defect.id}/jira`);
  const query = useQuery({
    queryKey: ["project", projectId, "jira-export", defect.id],
    queryFn: () => api<JiraExportRecord | null>(path),
  });
  const write = useWrite<JiraExportRecord>(projectId, () => setConfirm(false));
  const sync = useWrite<JiraExportRecord>(projectId);
  const record = query.data;
  return (
    <section aria-label="Jira ticket">
      <h2>Jira ticket</h2>
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      {query.isPending ? (
        <Loading label="Loading Jira ticket" />
      ) : record ? (
        record.state === "LINKED" && record.issueUrl ? (
          <>
            <a
              className="qa-button"
              href={record.issueUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              {record.issueKey}
            </a>
            <p style={{ overflowWrap: "anywhere" }}>
              Jira status: {record.jiraStatusName ?? "Not synced"}
            </p>
            {record.statusSyncedAt && (
              <p>
                Last checked:{" "}
                <time dateTime={record.statusSyncedAt}>
                  {new Date(record.statusSyncedAt).toLocaleString()}
                </time>
              </p>
            )}
            <ErrorNotice error={sync.error} retry={() => void query.refetch()} />
            {role === "ADMIN" && (
              <button
                type="button"
                className="qa-button"
                disabled={sync.isPending || query.isFetching}
                onClick={() =>
                  sync.mutate({ path: `${path}/sync`, body: { revision: record.syncRevision } })
                }
              >
                <RefreshCw size={16} aria-hidden="true" />
                {sync.isPending ? "Syncing Jira status" : "Sync Jira status"}
              </button>
            )}
          </>
        ) : (
          <>
            <p role="status">
              {record.state === "PENDING"
                ? "Export started. Confirmation pending."
                : "Export needs review. A Jira ticket may already exist."}
            </p>
            <button
              type="button"
              className="qa-button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Refresh status
            </button>
            {(record.state === "REVIEW_REQUIRED" || record.canReconcile === true) &&
              role === "ADMIN" && (
                <JiraRecovery
                  key={`${defect.id}-${record.syncRevision}`}
                  projectId={projectId}
                  path={path}
                  record={record}
                  refresh={() => void query.refetch()}
                />
              )}
          </>
        )
      ) : !query.isError && role === "ADMIN" ? (
        <button type="button" className="qa-button" onClick={() => setConfirm(true)}>
          <ExternalLink size={16} aria-hidden="true" />
          Export to Jira
        </button>
      ) : !query.isError ? (
        <p>No Jira ticket linked</p>
      ) : null}
      {confirm && (
        <Modal
          title="Export defect to Jira?"
          onClose={() => setConfirm(false)}
          busy={write.isPending}
        >
          <p>
            The defect title, severity and reproduction snapshot will be sent to this project&apos;s
            configured Jira site. Evidence files are not uploaded.
          </p>
          <p>{defect.title}</p>
          <ErrorNotice error={write.error} />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!write.isPending) write.mutate({ path, body: { revision: defect.revision } });
            }}
          >
            <Submit pending={write.isPending}>Confirm export</Submit>
          </form>
        </Modal>
      )}
    </section>
  );
}

function JiraRecovery({
  projectId,
  path,
  record,
  refresh,
}: {
  projectId: string;
  path: string;
  record: JiraExportRecord;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const recover = useWrite<JiraExportRecord>(projectId, () => setOpen(false));
  return (
    <>
      <button
        type="button"
        className="qa-button"
        onClick={() => {
          recover.reset();
          setOpen(true);
        }}
      >
        <Link2 size={16} aria-hidden="true" />
        Link existing Jira ticket
      </button>
      {open && (
        <Modal title="Recover Jira link" busy={recover.isPending} onClose={() => setOpen(false)}>
          <p style={{ overflowWrap: "anywhere" }}>
            {record.site} · {record.jiraProjectKey}
          </p>
          <ErrorNotice error={recover.error} retry={refresh} />
          <form
            className="qa-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (recover.isPending) return;
              const fields = new FormData(event.currentTarget);
              recover.mutate({
                path: `${path}/reconcile`,
                body: {
                  revision: record.syncRevision,
                  issueKey: String(fields.get("issueKey")).trim(),
                },
              });
            }}
          >
            <Field label="Existing Jira ticket key">
              <input
                name="issueKey"
                required
                pattern="[A-Z][A-Z0-9_]{1,19}-[1-9][0-9]*"
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                disabled={recover.isPending}
              />
            </Field>
            <Submit pending={recover.isPending}>Verify and link ticket</Submit>
          </form>
        </Modal>
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
