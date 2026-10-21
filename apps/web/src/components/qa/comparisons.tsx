"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitCompareArrows, Upload } from "lucide-react";
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
} from "./ui";
import "./comparisons.css";

type Snapshot = {
  id: string;
  label: string;
  environment: string;
  source: string;
  createdAt: string;
};
type Comparison = {
  id: string;
  beforeId: string;
  afterId: string;
  source: string;
  findingCount: number;
  createdAt: string;
};
type Finding = {
  field: string;
  productId?: string | null;
  size?: string | null;
  severity: string;
  before: unknown;
  after: unknown;
  expected: unknown;
};
type Detail = Comparison & { findings: Finding[] };

function provenance(source: string) {
  return source === "MANUAL_IMPORT" ? "Manual import" : source;
}

function valueText(value: unknown): string {
  return value === undefined
    ? "Not provided"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
}

export function ComparisonsView({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const client = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const snapshots = useInfiniteQuery({
    queryKey: ["project", projectId, "snapshots"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => page<Snapshot>(projectPath(projectId, "/snapshots"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const comparisons = useInfiniteQuery({
    queryKey: ["project", projectId, "comparisons"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => page<Comparison>(projectPath(projectId, "/comparisons"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = snapshots.data?.pages.flatMap((item) => item.data) ?? [];
  const history = comparisons.data?.pages.flatMap((item) => item.data) ?? [];
  const before = rows.find((row) => row.id === beforeId);
  const after = rows.find((row) => row.id === afterId);
  const validPair = Boolean(before && after && before.environment !== after.environment);
  const compare = useMutation({
    mutationFn: () => {
      if (!canWrite || !validPair) throw new Error("Choose snapshots from distinct environments.");
      return api<Detail>(projectPath(projectId, "/comparisons"), "POST", { beforeId, afterId });
    },
    onSuccess: (detail) => {
      client.setQueryData(["project", projectId, "comparison", detail.id], detail);
      setDetailId(detail.id);
      void client.invalidateQueries({ queryKey: ["project", projectId, "comparisons"] });
    },
  });
  const snapshotName = (id: string) => {
    const row = rows.find((item) => item.id === id);
    return row ? `${row.label} (${row.environment})` : id;
  };
  return (
    <>
      <SectionHeading
        title="Comparisons"
        description="Environment snapshots and comparison findings."
      >
        {canWrite && (
          <button
            className="qa-button qa-primary"
            type="button"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={16} aria-hidden="true" />
            Import snapshot
          </button>
        )}
      </SectionHeading>
      {!canWrite && (
        <p className="muted">
          Read only. Snapshot imports and comparisons require an Admin or QA role.
        </p>
      )}
      <section className="qa-comparison-section" aria-labelledby="snapshot-heading">
        <h2 id="snapshot-heading">Snapshots</h2>
        {snapshots.isPending ? (
          <Loading label="Loading snapshots" />
        ) : (
          <>
            <ErrorNotice
              error={snapshots.error}
              retry={() => {
                void (snapshots.isFetchNextPageError
                  ? snapshots.fetchNextPage()
                  : snapshots.refetch());
              }}
            />
            {!snapshots.isError && rows.length === 0 && (
              <Empty title="No snapshots yet">
                Import snapshots from two environments to compare them.
              </Empty>
            )}
            {rows.length > 0 && (
              <>
                <ul className="qa-comparison-snapshots">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <strong>{row.label}</strong>
                      <span>
                        {row.environment} · {provenance(row.source)}
                      </span>
                      <time dateTime={row.createdAt}>
                        {new Date(row.createdAt).toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ul>
                <form
                  className="qa-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canWrite && validPair && !compare.isPending) compare.mutate();
                  }}
                >
                  <div className="qa-form-grid">
                    <Field label="Before snapshot">
                      <select
                        value={beforeId}
                        disabled={!canWrite || compare.isPending}
                        onChange={(event) => {
                          setBeforeId(event.target.value);
                          setAfterId("");
                          compare.reset();
                        }}
                      >
                        <option value="">Select a snapshot</option>
                        {rows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.label} ({row.environment})
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="After snapshot">
                      <select
                        value={afterId}
                        disabled={!canWrite || compare.isPending}
                        onChange={(event) => {
                          setAfterId(event.target.value);
                          compare.reset();
                        }}
                      >
                        <option value="">Select a snapshot</option>
                        {rows.map((row) => (
                          <option
                            key={row.id}
                            value={row.id}
                            disabled={row.environment === before?.environment}
                          >
                            {row.label} ({row.environment})
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {canWrite && (
                    <>
                      <p className="muted">Choose snapshots from distinct environments.</p>
                      <ErrorNotice error={compare.error} />
                      <div className="qa-form-footer">
                        <button
                          type="submit"
                          className="qa-button qa-primary"
                          disabled={!validPair || compare.isPending}
                        >
                          <GitCompareArrows size={16} aria-hidden="true" />
                          {compare.isPending ? "Comparing..." : "Compare snapshots"}
                        </button>
                      </div>
                    </>
                  )}
                </form>
              </>
            )}
            {snapshots.hasNextPage && (
              <button
                type="button"
                className="qa-button"
                disabled={snapshots.isFetching}
                onClick={() => {
                  void snapshots.fetchNextPage();
                }}
              >
                {snapshots.isFetchingNextPage ? "Loading snapshots..." : "Load more snapshots"}
              </button>
            )}
          </>
        )}
      </section>
      <section className="qa-comparison-section" aria-labelledby="comparison-heading">
        <h2 id="comparison-heading">Comparison history</h2>
        {comparisons.isPending ? (
          <Loading label="Loading comparisons" />
        ) : (
          <>
            <ErrorNotice
              error={comparisons.error}
              retry={() => {
                void (comparisons.isFetchNextPageError
                  ? comparisons.fetchNextPage()
                  : comparisons.refetch());
              }}
            />
            {!comparisons.isError && history.length === 0 && <Empty title="No comparisons yet" />}
            <div className="qa-record-list">
              {history.map((row) => (
                <article key={row.id} className="qa-run-row">
                  <div>
                    <h3 className="qa-prose">
                      {snapshotName(row.beforeId)} → {snapshotName(row.afterId)}
                    </h3>
                    <p>
                      {row.findingCount} findings · {provenance(row.source)}
                    </p>
                    <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time>
                  </div>
                  <OpenButton onClick={() => setDetailId(row.id)}>View findings</OpenButton>
                </article>
              ))}
            </div>
            {comparisons.hasNextPage && (
              <button
                type="button"
                className="qa-button"
                disabled={comparisons.isFetching}
                onClick={() => {
                  void comparisons.fetchNextPage();
                }}
              >
                {comparisons.isFetchingNextPage
                  ? "Loading comparisons..."
                  : "Load more comparisons"}
              </button>
            )}
          </>
        )}
      </section>
      {importOpen && canWrite && (
        <ImportSnapshot projectId={projectId} onClose={() => setImportOpen(false)} />
      )}
      {detailId && (
        <ComparisonFindings projectId={projectId} id={detailId} onClose={() => setDetailId(null)} />
      )}
    </>
  );
}

function ImportSnapshot({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const client = useQueryClient();
  const [label, setLabel] = useState("");
  const [json, setJson] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      if (!label.trim() || label.trim().length > 120)
        throw new Error("Enter a snapshot label of 1 to 120 characters.");
      if (new TextEncoder().encode(json).byteLength > 1024 * 1024)
        throw new Error("Snapshot JSON must be at most 1 MiB.");
      let snapshot: unknown;
      try {
        snapshot = JSON.parse(json);
      } catch {
        throw new Error("Enter valid snapshot JSON.");
      }
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
        throw new Error("Snapshot JSON must be an object.");
      const body = { label: label.trim(), snapshot };
      if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 1024 * 1024)
        throw new Error("The snapshot import must be at most 1 MiB including its label.");
      return api<Snapshot>(projectPath(projectId, "/snapshots"), "POST", body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["project", projectId, "snapshots"] });
      onClose();
    },
  });
  return (
    <Modal title="Import snapshot" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending) mutation.mutate();
        }}
      >
        <p className="muted">Manual import · Maximum 1 MiB</p>
        <Field label="Snapshot label">
          <input
            value={label}
            maxLength={120}
            required
            disabled={mutation.isPending}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        <Field label="Snapshot JSON">
          <textarea
            className="mono"
            value={json}
            rows={12}
            required
            disabled={mutation.isPending}
            spellCheck={false}
            onChange={(event) => setJson(event.target.value)}
          />
        </Field>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending}>Save snapshot</Submit>
        </div>
      </form>
    </Modal>
  );
}

function ComparisonFindings({
  projectId,
  id,
  onClose,
}: {
  projectId: string;
  id: string;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: ["project", projectId, "comparison", id],
    queryFn: () => api<Detail>(projectPath(projectId, `/comparisons/${encodeURIComponent(id)}`)),
  });
  return (
    <Modal title="Comparison findings" onClose={onClose}>
      {detail.isPending ? (
        <Loading label="Loading findings" />
      ) : detail.isError ? (
        <ErrorNotice
          error={detail.error}
          retry={() => {
            void detail.refetch();
          }}
        />
      ) : (
        <>
          <p className="qa-prose">
            {provenance(detail.data.source)} · {detail.data.findingCount} findings
          </p>
          <p className="qa-prose">
            Before: {detail.data.beforeId}
            <br />
            After: {detail.data.afterId}
          </p>
          {detail.data.findings.length === 0 ? (
            <Empty title="No differences found" />
          ) : (
            <div
              className="qa-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Comparison findings table"
            >
              <table className="qa-comparison-table">
                <thead>
                  <tr>
                    {["Field", "Product", "Size", "Severity", "Before", "After", "Expected"].map(
                      (heading) => (
                        <th key={heading} scope="col">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {detail.data.findings.map((finding, index) => (
                    <tr key={index}>
                      {[
                        finding.field,
                        finding.productId,
                        finding.size,
                        finding.severity,
                        finding.before,
                        finding.after,
                        finding.expected,
                      ].map((value, cell) => (
                        <td key={cell}>{valueText(value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
