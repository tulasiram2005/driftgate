"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, Check, Layers3, Play, Plus, Save, Search } from "lucide-react";
import { z } from "zod";
import {
  list,
  projectPath,
  resultStatuses,
  type Run,
  type RunResult,
  type Suite,
} from "../../lib/qa-api";
import { CaseSnapshot, useCases } from "./cases";
import { ManualEvidence } from "./evidence";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  OpenButton,
  schemaResolver,
  SectionHeading,
  Status,
  Submit,
  useWrite,
} from "./ui";

function useSuites(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId, "suites"],
    queryFn: () => list<Suite>(projectPath(projectId, "/suites")),
  });
}

export function SuitesView({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const suites = useSuites(projectId);
  const cases = useCases(projectId);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Suite | null>(null);
  return (
    <>
      <SectionHeading title="Suites" description="A focused set of cases for every check.">
        {canWrite && (
          <button className="qa-button qa-primary" type="button" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New suite
          </button>
        )}
      </SectionHeading>
      {suites.isPending ? (
        <Loading label="Loading suites" />
      ) : suites.isError ? (
        <ErrorNotice
          error={suites.error}
          retry={() => {
            void suites.refetch();
          }}
        />
      ) : !suites.data.length ? (
        <Empty title="No suites yet" />
      ) : (
        <div className="qa-record-list">
          {suites.data.map((suite) => (
            <article key={suite.id} className="qa-suite-row">
              <Layers3 size={20} aria-hidden="true" />
              <div>
                <h2>{suite.name}</h2>
                <p className="muted">{suite.caseIds.length} test cases</p>
              </div>
              <OpenButton onClick={() => setSelected(suite)}>View cases</OpenButton>
            </article>
          ))}
        </div>
      )}
      {creating && <SuiteForm projectId={projectId} onClose={() => setCreating(false)} />}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          {cases.isPending ? (
            <Loading label="Loading cases" />
          ) : cases.isError ? (
            <ErrorNotice
              error={cases.error}
              retry={() => {
                void cases.refetch();
              }}
            />
          ) : (
            <ul className="qa-suite-cases">
              {selected.caseIds.map((id) => (
                <li key={id}>
                  <Check size={16} aria-hidden="true" />
                  {cases.data.find((item) => item.id === id)?.title ?? "Deleted test case"}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}

const suiteSchema = z.object({
  name: z.string().trim().min(1, "Enter a suite name.").max(120),
  caseIds: z.array(z.string()).min(1, "Select at least one case."),
});

function SuiteForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const cases = useCases(projectId);
  const [search, setSearch] = useState("");
  const form = useForm<z.infer<typeof suiteSchema>>({
    resolver: schemaResolver(suiteSchema),
    defaultValues: { name: "", caseIds: [] },
  });
  const mutation = useWrite(projectId, onClose);
  const selectedIds = useWatch({ control: form.control, name: "caseIds" });
  return (
    <Modal title="New suite" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        noValidate
        onSubmit={form.handleSubmit((body) =>
          mutation.mutate({ path: projectPath(projectId, "/suites"), body }),
        )}
      >
        <Field label="Suite name" error={form.formState.errors.name?.message}>
          <input {...form.register("name")} required />
        </Field>
        <fieldset className="qa-step-fieldset">
          <legend>Test cases</legend>
          <label className="qa-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search suite cases</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cases"
            />
          </label>
          {cases.isPending ? (
            <Loading label="Loading cases" />
          ) : cases.isError ? (
            <ErrorNotice
              error={cases.error}
              retry={() => {
                void cases.refetch();
              }}
            />
          ) : !cases.data.length ? (
            <Empty title="Create test cases first" />
          ) : (
            <div className="qa-checkbox-list">
              {cases.data
                .filter((item) => item.title.toLowerCase().includes(search.toLowerCase()))
                .map((item) => (
                  <label key={item.id}>
                    <input type="checkbox" value={item.id} {...form.register("caseIds")} />
                    <span>
                      {item.title}
                      <small className="muted">
                        {item.priority} · v{item.version}
                      </small>
                    </span>
                  </label>
                ))}
              {!cases.data.some((item) =>
                item.title.toLowerCase().includes(search.toLowerCase()),
              ) && <p className="muted">No matching cases.</p>}
            </div>
          )}
          <p className="muted">{selectedIds.length} selected</p>
          {form.formState.errors.caseIds && (
            <p role="alert" className="qa-field-error">
              {form.formState.errors.caseIds.message}
            </p>
          )}
        </fieldset>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending || !cases.data?.length}>Create suite</Submit>
        </div>
      </form>
    </Modal>
  );
}

export function RunsView({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const runs = useQuery({
    queryKey: ["project", projectId, "runs"],
    queryFn: () => list<Run>(projectPath(projectId, "/runs")),
  });
  const suites = useSuites(projectId);
  const [creating, setCreating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const selected = runs.data?.find((run) => run.id === runId);
  return (
    <>
      {selected ? (
        <RunDetail
          key={selected.id}
          projectId={projectId}
          run={selected}
          suiteName={suites.data?.find((suite) => suite.id === selected.suiteId)?.name}
          canWrite={canWrite}
          onBack={() => setRunId(null)}
        />
      ) : (
        <>
          <SectionHeading
            title="Manual runs"
            description="Execute a suite against a specific environment."
          >
            {canWrite && (
              <button
                className="qa-button qa-primary"
                type="button"
                onClick={() => setCreating(true)}
              >
                <Play size={16} aria-hidden="true" />
                Start run
              </button>
            )}
          </SectionHeading>
          {runs.isPending ? (
            <Loading label="Loading runs" />
          ) : runs.isError ? (
            <ErrorNotice
              error={runs.error}
              retry={() => {
                void runs.refetch();
              }}
            />
          ) : !runs.data.length ? (
            <Empty title="No manual runs yet" />
          ) : (
            <div className="qa-record-list">
              {runs.data.map((run) => {
                const completed = run.results.filter(
                  (result) => result.status !== "NOT_RUN",
                ).length;
                return (
                  <article className="qa-run-row" key={run.id}>
                    <div>
                      <h2>
                        {suites.data?.find((suite) => suite.id === run.suiteId)?.name ??
                          "Manual run"}
                      </h2>
                      <p className="muted">
                        {run.environment} · {run.browser} · {run.device}
                      </p>
                      <time className="muted" dateTime={run.createdAt}>
                        {new Date(run.createdAt).toLocaleString()}
                      </time>
                    </div>
                    <span className="mono">
                      {completed}/{run.results.length} recorded
                    </span>
                    <OpenButton onClick={() => setRunId(run.id)}>Open run</OpenButton>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {creating && (
        <RunForm
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(run) => {
            setCreating(false);
            setRunId(run.id);
          }}
        />
      )}
    </>
  );
}

const runSchema = z.object({
  suiteId: z.string().min(1, "Select a suite."),
  environment: z.enum(["STAGING", "UAT", "PREPROD", "PROD"]),
  browser: z.string().trim().min(1, "Enter a browser.").max(80),
  device: z.string().trim().min(1, "Enter a device.").max(80),
});

function RunForm({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (run: Run) => void;
}) {
  const suites = useSuites(projectId);
  const form = useForm<z.infer<typeof runSchema>>({
    resolver: schemaResolver(runSchema),
    defaultValues: { suiteId: "", environment: "STAGING", browser: "Chromium", device: "Desktop" },
  });
  const mutation = useWrite<Run>(projectId, onCreated);
  return (
    <Modal title="Start manual run" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        noValidate
        onSubmit={form.handleSubmit((body) =>
          mutation.mutate({ path: projectPath(projectId, "/runs"), body }),
        )}
      >
        {suites.isPending ? (
          <Loading label="Loading suites" />
        ) : suites.isError ? (
          <ErrorNotice
            error={suites.error}
            retry={() => {
              void suites.refetch();
            }}
          />
        ) : !suites.data.length ? (
          <Empty title="Create a suite first" />
        ) : (
          <Field label="Suite" error={form.formState.errors.suiteId?.message}>
            <select {...form.register("suiteId")} required>
              <option value="">Select a suite</option>
              {suites.data.map((suite) => (
                <option value={suite.id} key={suite.id}>
                  {suite.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Environment">
          <select {...form.register("environment")}>
            <option value="STAGING">Staging</option>
            <option value="UAT">UAT</option>
            <option value="PREPROD">Pre-production</option>
            <option value="PROD">Production</option>
          </select>
        </Field>
        <div className="qa-form-grid">
          <Field label="Browser" error={form.formState.errors.browser?.message}>
            <input {...form.register("browser")} required list="run-browsers" />
            <datalist id="run-browsers">
              <option value="Chromium" />
              <option value="Firefox" />
              <option value="WebKit" />
            </datalist>
          </Field>
          <Field label="Device" error={form.formState.errors.device?.message}>
            <input {...form.register("device")} required list="run-devices" />
            <datalist id="run-devices">
              <option value="Desktop" />
              <option value="Mobile" />
              <option value="Tablet" />
            </datalist>
          </Field>
        </div>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending || !suites.data?.length}>Start run</Submit>
        </div>
      </form>
    </Modal>
  );
}

function RunDetail({
  projectId,
  run,
  suiteName,
  canWrite,
  onBack,
}: {
  projectId: string;
  run: Run;
  suiteName: string | undefined;
  canWrite: boolean;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState(run.results[0]?.id ?? "");
  const [dirty, setDirty] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<string | "back" | null>(null);
  const selected = run.results.find((result) => result.id === selectedId);
  function navigate(id: string | "back") {
    if (dirty) {
      setPendingSelection(id);
      return;
    }
    if (id === "back") onBack();
    else setSelectedId(id);
  }
  useBeforeUnload(dirty);
  return (
    <>
      <button type="button" className="qa-button qa-back" onClick={() => navigate("back")}>
        <ArrowLeft size={16} aria-hidden="true" />
        All runs
      </button>
      <SectionHeading
        title={suiteName ?? "Manual run"}
        description={`${run.environment} · ${run.browser} · ${run.device}`}
      />
      <div className="qa-run-summary" aria-label="Run status counts">
        {resultStatuses.map((status) => (
          <span key={status}>
            <Status status={status} />
            <span className="mono">
              {run.results.filter((result) => result.status === status).length}
            </span>
          </span>
        ))}
      </div>
      {!run.results.length ? (
        <Empty title="This run has no test results" />
      ) : (
        <div className="qa-execution">
          <nav className="qa-result-nav" aria-label="Run test cases">
            {run.results.map((result, index) => (
              <button
                type="button"
                key={result.id}
                aria-current={result.id === selectedId ? "true" : undefined}
                onClick={() => navigate(result.id)}
              >
                <span className="mono muted">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  {result.title}
                  <small className="muted">Version {result.version}</small>
                </span>
                <Status status={result.status} />
              </button>
            ))}
          </nav>
          <section className="qa-result-detail" aria-label="Selected test result">
            {selected && (
              <ResultEditor
                key={selected.id}
                projectId={projectId}
                runId={run.id}
                result={selected}
                canWrite={canWrite}
                onDirty={setDirty}
              />
            )}
          </section>
        </div>
      )}
      {pendingSelection && (
        <Modal title="Discard unsaved result?" onClose={() => setPendingSelection(null)}>
          <p>The status and notes have not been saved.</p>
          <div className="qa-form-footer">
            <button type="button" className="qa-button" onClick={() => setPendingSelection(null)}>
              Keep editing
            </button>
            <button
              type="button"
              className="qa-button qa-danger"
              onClick={() => {
                setDirty(false);
                if (pendingSelection === "back") onBack();
                else setSelectedId(pendingSelection);
                setPendingSelection(null);
              }}
            >
              Discard changes
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// Browser navigation should not silently lose a pending manual observation.
function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

const resultSchema = z.object({
  status: z.enum(resultStatuses).superRefine((status, context) => {
    if (status === "NOT_RUN")
      context.addIssue({ code: "custom", message: "Choose a result before saving." });
  }),
  notes: z.string().max(10000),
});

function ResultEditor({
  projectId,
  runId,
  result,
  canWrite,
  onDirty,
}: {
  projectId: string;
  runId: string;
  result: RunResult;
  canWrite: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const form = useForm<z.infer<typeof resultSchema>>({
    resolver: schemaResolver(resultSchema),
    defaultValues: { status: result.status, notes: result.notes ?? "" },
  });
  const mutation = useWrite(projectId, () => {
    form.reset(form.getValues());
    onDirty(false);
  });
  const isDirty = form.formState.isDirty;
  useEffect(() => {
    onDirty(isDirty);
  }, [isDirty, onDirty]);
  return (
    <>
      <CaseSnapshot record={result} />
      <ManualEvidence
        projectId={projectId}
        runId={runId}
        resultId={result.id}
        canWrite={canWrite}
      />
      {canWrite ? (
        <form
          className="qa-form qa-result-form"
          noValidate
          onSubmit={form.handleSubmit((body) =>
            mutation.mutate({
              path: projectPath(projectId, `/runs/${runId}/results/${result.id}`),
              method: "PUT",
              body,
            }),
          )}
        >
          <Field label="Result" error={form.formState.errors.status?.message}>
            <select {...form.register("status")} disabled={mutation.isPending}>
              {resultStatuses.map((status) => (
                <option value={status} key={status} disabled={status === "NOT_RUN"}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" error={form.formState.errors.notes?.message}>
            <textarea {...form.register("notes")} rows={4} disabled={mutation.isPending} />
          </Field>
          <ErrorNotice error={mutation.error} />
          <div className="qa-form-footer">
            {mutation.isSuccess && !isDirty && (
              <span className="qa-success" role="status">
                <Check size={16} aria-hidden="true" />
                Result saved
              </span>
            )}
            <button
              className="qa-button qa-primary"
              type="submit"
              disabled={mutation.isPending || !isDirty}
            >
              <Save size={16} aria-hidden="true" />
              {mutation.isPending ? "Saving..." : "Save result"}
            </button>
          </div>
        </form>
      ) : (
        <div className="qa-read-result">
          <Status status={result.status} />
          <h3>Notes</h3>
          <p className="qa-prose muted">{result.notes || "No notes recorded."}</p>
        </div>
      )}
    </>
  );
}
