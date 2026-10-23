"use client";
import { ProposeBaseline } from "./baselines";
import { CreateDefect } from "./defects";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Play, RefreshCw } from "lucide-react";
import { api, list, projectPath, runEvents } from "../../lib/qa-api";
import { Empty, ErrorNotice, Field, Loading, Modal, SectionHeading } from "./ui";
import "./automated.css";

type Evidence = { id: string; kind: string; ready: boolean; sizeBytes: number };
type Cell = {
  id: string;
  title: string;
  caseId: string;
  browser: string;
  device: string;
  status: string;
  flaky: boolean;
  attempts: {
    id: string;
    number: number;
    status: string;
    durationMs: number;
    error: string | null;
  }[];
  evidence: Evidence[];
};
type AutomatedRun = {
  id: string;
  environment: string;
  status: string;
  createdAt: string;
  dispatch: string;
  results: Cell[];
};
const browsers = ["chromium", "firefox", "webkit"] as const;
const devices = ["desktop", "mobile"] as const;
const checks = [
  "catalogue",
  "product",
  "cart",
  "api-contract",
  "broken-links",
  "accessibility",
  "snapshot",
] as const;
const active = (status: string) => ["QUEUED", "RUNNING"].includes(status);

function RunStatus({ value }: { value: string }) {
  const tone =
    value === "PASS"
      ? "pass"
      : ["FAIL", "TIMED_OUT"].includes(value)
        ? "fail"
        : value === "FLAKY"
          ? "warn"
          : "neutral";
  return <span className={`status-pill status-${tone}`}>{value.replaceAll("_", " ")}</span>;
}

export function AutomatedRuns({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState("");
  const runs = useQuery({
    queryKey: ["project", projectId, "automated-runs"],
    queryFn: () => list<AutomatedRun>(projectPath(projectId, "/automated-runs")),
    refetchInterval: (query) =>
      query.state.data?.some((run) => active(run.status)) ? 5000 : false,
  });
  if (selected)
    return (
      <AutomatedDetail
        projectId={projectId}
        runId={selected}
        canWrite={canWrite}
        onBack={() => setSelected("")}
      />
    );
  return (
    <>
      <SectionHeading title="Automated runs">
        <button
          className="icon-button"
          title="Refresh runs"
          aria-label="Refresh runs"
          onClick={() => void runs.refetch()}
        >
          <RefreshCw size={18} />
        </button>
        {canWrite && (
          <button className="qa-button qa-primary" onClick={() => setCreating(true)}>
            <Play size={16} />
            Start automated run
          </button>
        )}
      </SectionHeading>
      {runs.isPending ? (
        <Loading label="Loading automated runs" />
      ) : runs.isError ? (
        <ErrorNotice error={runs.error} retry={() => void runs.refetch()} />
      ) : !runs.data.length ? (
        <Empty title="No automated runs yet" />
      ) : (
        <div className="qa-record-list">
          {runs.data.map((run) => (
            <article className="qa-run-row" key={run.id}>
              <div>
                <h2>Threadline · {run.environment}</h2>
                <time className="muted" dateTime={run.createdAt}>
                  {new Date(run.createdAt).toLocaleString()}
                </time>
                <p className="muted">
                  {run.results.length} checks · {run.dispatch}
                </p>
              </div>
              <RunStatus value={run.status} />
              <button className="qa-link" onClick={() => setSelected(run.id)}>
                Open results
              </button>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <AutomatedForm
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(run) => {
            setCreating(false);
            setSelected(run.id);
          }}
        />
      )}
    </>
  );
}

function AutomatedForm({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (run: AutomatedRun) => void;
}) {
  const [environment, setEnvironment] = useState("STAGING");
  const [dispatch, setDispatch] = useState("LOCAL");
  const [retries, setRetries] = useState(1);
  const [selectedBrowsers, setBrowsers] = useState<string[]>(["chromium"]);
  const [selectedDevices, setDevices] = useState<string[]>(["desktop"]);
  const [selectedChecks, setChecks] = useState<string[]>(["catalogue", "product", "cart"]);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        environment,
        dispatch,
        retries,
        checks: selectedChecks,
        matrix: selectedBrowsers.flatMap((browser) =>
          selectedDevices.map((device) => ({ browser, device })),
        ),
      };
      const fingerprint = JSON.stringify(body);
      if (request.current?.fingerprint !== fingerprint)
        request.current = {
          fingerprint,
          key: Array.from(crypto.getRandomValues(new Uint8Array(24)), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join(""),
        };
      return api<AutomatedRun>(projectPath(projectId, "/automated-runs"), "POST", body, {
        "Idempotency-Key": request.current.key,
      });
    },
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: ["project", projectId] });
      onCreated(run);
    },
  });
  const toggle = (values: string[], value: string) =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  return (
    <Modal title="Start automated run" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset disabled={mutation.isPending} className="qa-automation-fields">
          <Field label="Environment">
            <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
              {["STAGING", "UAT", "PREPROD", "PROD"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Execution service">
            <select value={dispatch} onChange={(e) => setDispatch(e.target.value)}>
              <option value="LOCAL">Local worker</option>
              <option value="GITHUB">GitHub Actions</option>
            </select>
          </Field>
          <fieldset className="qa-step-fieldset">
            <legend>Browsers</legend>
            <div className="qa-checkbox-list">
              {browsers.map((v) => (
                <label key={v}>
                  <input
                    type="checkbox"
                    checked={selectedBrowsers.includes(v)}
                    onChange={() => setBrowsers(toggle(selectedBrowsers, v))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="qa-step-fieldset">
            <legend>Devices</legend>
            <div className="qa-checkbox-list">
              {devices.map((v) => (
                <label key={v}>
                  <input
                    type="checkbox"
                    checked={selectedDevices.includes(v)}
                    onChange={() => setDevices(toggle(selectedDevices, v))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="qa-step-fieldset">
            <legend>Threadline checks</legend>
            <div className="qa-checkbox-list">
              {checks.map((v) => (
                <label key={v}>
                  <input
                    type="checkbox"
                    checked={selectedChecks.includes(v)}
                    onChange={() => setChecks(toggle(selectedChecks, v))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Retries">
            <input
              type="number"
              min={0}
              max={2}
              value={retries}
              onChange={(e) => setRetries(Number(e.target.value))}
            />
          </Field>
        </fieldset>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <button
            className="qa-button qa-primary"
            disabled={
              mutation.isPending ||
              !selectedBrowsers.length ||
              !selectedDevices.length ||
              !selectedChecks.length
            }
            type="submit"
          >
            <Play size={16} />
            {mutation.isPending ? "Queuing..." : "Queue run"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AutomatedDetail({
  projectId,
  runId,
  canWrite,
  onBack,
}: {
  projectId: string;
  runId: string;
  canWrite: boolean;
  onBack: () => void;
}) {
  const client = useQueryClient();
  const key = ["project", projectId, "automated-run", runId];
  const path = projectPath(projectId, `/runs/${runId}`);
  const run = useQuery({
    queryKey: key,
    queryFn: () => api<AutomatedRun>(path),
    refetchInterval: (query) =>
      query.state.data && active(query.state.data.status) ? 10000 : false,
  });
  const running = Boolean(run.data && active(run.data.status));
  const [streamError, setStreamError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!running) return;
    const controller = new AbortController();
    let cursor = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connect = async () => {
      try {
        await runEvents(`${path}/events`, controller.signal, cursor, (event) => {
          cursor = event.id;
          setStreamError(null);
          void client.invalidateQueries({
            queryKey: ["project", projectId, "automated-run", runId],
          });
        });
      } catch {
        if (!controller.signal.aborted)
          setStreamError("Live updates disconnected. Reconnecting...");
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void connect(), 3000);
    };
    void connect();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [client, path, projectId, runId, running]);
  const result = run.data?.results.find((cell) => cell.id === selected);
  return (
    <>
      <button className="qa-button qa-back" onClick={onBack}>
        <ArrowLeft size={16} />
        All automated runs
      </button>
      <SectionHeading title="Run results">
        <button
          className="icon-button"
          aria-label="Refresh results"
          title="Refresh results"
          onClick={() => void run.refetch()}
        >
          <RefreshCw size={18} />
        </button>
      </SectionHeading>
      {run.isPending ? (
        <Loading label="Loading results" />
      ) : run.isError ? (
        <ErrorNotice error={run.error} retry={() => void run.refetch()} />
      ) : (
        <>
          <div className="qa-run-summary">
            <RunStatus value={run.data.status} />
            <span>{run.data.environment}</span>
            <span>{run.data.dispatch}</span>
          </div>
          {running && streamError && (
            <p className="muted" role="status">
              {streamError}
            </p>
          )}
          <div className="qa-device-matrix">
            {run.data.results.map((cell) => (
              <button key={cell.id} className="qa-matrix-cell" onClick={() => setSelected(cell.id)}>
                <span className="mono muted">
                  {cell.browser} · {cell.device}
                </span>
                <strong>{cell.title}</strong>
                <RunStatus value={cell.flaky ? "FLAKY" : cell.status} />
                <span className="muted">{cell.attempts?.length ?? 0} attempts</span>
              </button>
            ))}
          </div>
          {result && (
            <Modal title={result.title} onClose={() => setSelected(null)}>
              <p className="muted">
                {result.browser} · {result.device}
              </p>
              <RunStatus value={result.flaky ? "FLAKY" : result.status} />
              {canWrite && result.status === "FAIL" && (
                <CreateDefect key={result.id} projectId={projectId} resultId={result.id} />
              )}
              <h3>Attempt history</h3>
              {!result.attempts?.length ? (
                <p className="muted">No attempts recorded yet.</p>
              ) : (
                <ol className="qa-attempts">
                  {result.attempts.map((attempt) => (
                    <li key={attempt.id}>
                      <span>
                        Attempt {attempt.number} · {attempt.durationMs} ms
                      </span>
                      <RunStatus value={attempt.status} />
                      {attempt.error && <pre>{attempt.error}</pre>}
                    </li>
                  ))}
                </ol>
              )}
              <h3>Evidence</h3>
              {!result.evidence?.length ? (
                <p className="muted">No evidence available yet.</p>
              ) : (
                <div className="qa-evidence-list">
                  {result.evidence.map((item) => (
                    <div key={item.id}>
                      <EvidenceLink
                        projectId={projectId}
                        runId={runId}
                        resultId={result.id}
                        evidence={item}
                      />
                      {canWrite && item.ready && item.kind === "screenshot" && (
                        <ProposeBaseline projectId={projectId} evidenceId={item.id} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Modal>
          )}
        </>
      )}
    </>
  );
}

export function EvidenceLink({
  projectId,
  runId,
  resultId,
  evidence,
}: {
  projectId: string;
  runId: string;
  resultId: string;
  evidence: Evidence;
}) {
  const mutation = useMutation({
    mutationFn: () =>
      api<{ url: string }>(
        projectPath(projectId, `/runs/${runId}/results/${resultId}/evidence/${evidence.id}/url`),
      ),
  });
  return (
    <div>
      <button
        className="qa-button"
        disabled={!evidence.ready || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <ExternalLink size={16} />
        {evidence.kind} · {Math.ceil(evidence.sizeBytes / 1024)} KB
      </button>
      {mutation.data && (
        <a className="qa-link" href={mutation.data.url} target="_blank" rel="noopener noreferrer">
          Open {evidence.kind}
        </a>
      )}
      <ErrorNotice error={mutation.error} />
    </div>
  );
}
