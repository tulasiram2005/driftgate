"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { page, projectPath } from "../../lib/qa-api";
import { Empty, ErrorNotice, Field, Loading, Modal, SectionHeading, Submit, useWrite } from "./ui";
import { EvidenceLink } from "./automated";
import { CompareScreenshot, VisualComparisons } from "./visual-comparisons";

type Baseline = {
  id: string;
  label: string;
  environment: string;
  browser: string;
  device: string;
  viewportWidth: number;
  viewportHeight: number;
  status: string;
  active: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  evidence: {
    id: string;
    kind: string;
    ready: boolean;
    sizeBytes: number;
    resultId: string;
    result: { runId: string };
  };
};

export function BaselinesView({ projectId, canReview }: { projectId: string; canReview: boolean }) {
  const [selected, setSelected] = useState<Baseline | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["project", projectId, "visual-baselines"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      page<Baseline>(projectPath(projectId, "/visual-baselines"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <>
      <SectionHeading title="Visual baselines" />
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
      {query.isPending ? (
        <Loading label="Loading baselines" />
      ) : (
        <>
          {!query.isError && !rows.length && <Empty title="No baseline candidates" />}
          <div className="qa-record-list">
            {rows.map((row) => (
              <article key={row.id}>
                <h2>{row.label}</h2>
                <p>
                  {row.environment} · {row.browser} · {row.viewportWidth} × {row.viewportHeight}
                </p>
                <p>
                  {row.status}
                  {row.active ? " · Active" : ""}
                </p>
                <button type="button" className="qa-link" onClick={() => setSelected(row)}>
                  Inspect baseline
                </button>
              </article>
            ))}
          </div>
          {query.hasNextPage && (
            <button
              className="qa-button"
              disabled={query.isFetching}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              Load more baselines
            </button>
          )}
        </>
      )}
      {selected && (
        <BaselineReview
          key={selected.id}
          projectId={projectId}
          baseline={selected}
          canReview={canReview}
          onClose={() => setSelected(null)}
        />
      )}
      <VisualComparisons projectId={projectId} />
    </>
  );
}

function BaselineReview({
  projectId,
  baseline,
  canReview,
  onClose,
}: {
  projectId: string;
  baseline: Baseline;
  canReview: boolean;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState("APPROVED");
  const [comment, setComment] = useState("");
  const write = useWrite(projectId, onClose);
  return (
    <Modal title="Inspect baseline" onClose={onClose} busy={write.isPending}>
      <h3>{baseline.label}</h3>
      <p>
        {baseline.environment} · {baseline.browser} · {baseline.viewportWidth} ×{" "}
        {baseline.viewportHeight}
      </p>
      <EvidenceLink
        projectId={projectId}
        runId={baseline.evidence.result.runId}
        resultId={baseline.evidence.resultId}
        evidence={baseline.evidence}
      />
      {baseline.status === "APPROVED" && canReview && !baseline.active && (
        <div>
          <button
            type="button"
            className="qa-button"
            disabled={write.isPending}
            onClick={() =>
              write.mutate({
                path: projectPath(projectId, `/visual-baselines/${baseline.id}/activate`),
                body: {},
              })
            }
          >
            Use as active baseline
          </button>
          <ErrorNotice error={write.error} />
        </div>
      )}
      {baseline.status === "PENDING" && canReview ? (
        <form
          className="qa-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!write.isPending && comment.trim())
              write.mutate({
                path: projectPath(projectId, `/visual-baselines/${baseline.id}/review`),
                body: { status: decision, comment: comment.trim() },
              });
          }}
        >
          <Field label="Decision">
            <select
              value={decision}
              disabled={write.isPending}
              onChange={(e) => setDecision(e.target.value)}
            >
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </select>
          </Field>
          <Field label="Review comment">
            <textarea
              required
              maxLength={1000}
              value={comment}
              disabled={write.isPending}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <ErrorNotice error={write.error} />
          <Submit pending={write.isPending}>Save decision</Submit>
        </form>
      ) : (
        <>
          <p>{baseline.status}</p>
          <p>{baseline.reviewComment}</p>
          {baseline.reviewedAt && (
            <p>
              Reviewed {new Date(baseline.reviewedAt).toLocaleString()} · {baseline.reviewedBy}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

export function ProposeBaseline({
  projectId,
  evidenceId,
}: {
  projectId: string;
  evidenceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const write = useWrite(projectId, () => setOpen(false));
  return (
    <>
      <CompareScreenshot projectId={projectId} evidenceId={evidenceId} />
      <button
        type="button"
        className="qa-button"
        disabled={write.isSuccess}
        onClick={() => setOpen(true)}
      >
        {write.isSuccess ? "Baseline proposed" : "Propose baseline"}
      </button>
      {open && (
        <form
          className="qa-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!write.isPending && label.trim())
              write.mutate({
                path: projectPath(projectId, "/visual-baselines"),
                body: { evidenceId, label: label.trim() },
              });
          }}
        >
          <Field label="Baseline label">
            <input
              required
              maxLength={100}
              value={label}
              disabled={write.isPending}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <ErrorNotice error={write.error} />
          <Submit pending={write.isPending}>Submit candidate</Submit>
          <button
            type="button"
            className="qa-button"
            disabled={write.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </form>
      )}
    </>
  );
}
