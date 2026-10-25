"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Scan, Download } from "lucide-react";
import { api, page, projectPath } from "../../lib/qa-api";
import { Empty, ErrorNotice, Field, Loading, Modal, Submit, useWrite } from "./ui";

type Comparison = {
  reviewDecision?: string | null;
  reviewComment?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  ignoredPixels?: number;
  ignoreRevision?: number;
  id: string;
  changedPixels: number;
  comparedPixels: number;
  createdAt: string;
  baseline: { label: string; browser: string; environment: string };
};

export function CompareScreenshot({
  projectId,
  evidenceId,
}: {
  projectId: string;
  evidenceId: string;
}) {
  const [result, setResult] = useState<Comparison | null>(null);
  const write = useWrite<Comparison>(projectId, setResult);
  return (
    <div>
      <button
        type="button"
        className="qa-button"
        disabled={write.isPending}
        onClick={() =>
          write.mutate({
            path: projectPath(projectId, "/visual-comparisons"),
            body: { evidenceId },
          })
        }
      >
        <Scan size={16} aria-hidden="true" />
        {write.isPending ? "Comparing..." : "Compare with baseline"}
      </button>
      <ErrorNotice error={write.error} />
      {result && (
        <p role="status">
          {result.changedPixels.toLocaleString()} changed pixels (
          {((result.changedPixels / result.comparedPixels) * 100).toFixed(2)}%)
        </p>
      )}
    </div>
  );
}

function DifferenceDownload({
  projectId,
  comparisonId,
}: {
  projectId: string;
  comparisonId: string;
}) {
  const download = useMutation({
    mutationFn: () =>
      api<{ url: string }>(projectPath(projectId, `/visual-comparisons/${comparisonId}/url`)),
  });
  return (
    <div>
      <button
        type="button"
        className="qa-button"
        disabled={download.isPending}
        onClick={() => download.mutate()}
      >
        <Download size={16} aria-hidden="true" />
        {download.isPending ? "Preparing..." : "Get difference image"}
      </button>
      {download.data && (
        <figure>
          <img
            src={download.data.url}
            alt="Changed pixels highlighted against a transparent background"
            style={{ maxWidth: "100%", height: "auto", background: "#ffffff" }}
          />
          <figcaption>
            <a className="qa-link" href={download.data.url} target="_blank" rel="noreferrer">
              Download difference PNG
            </a>
          </figcaption>
        </figure>
      )}
      <ErrorNotice error={download.error} />
    </div>
  );
}

export function VisualComparisons({
  projectId,
  canReview = false,
}: {
  projectId: string;
  canReview?: boolean;
}) {
  const [reviewing, setReviewing] = useState<string | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["project", projectId, "visual-comparisons"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      page<Comparison>(projectPath(projectId, "/visual-comparisons"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <section aria-label="Visual comparison results">
      <h2>Comparison results</h2>
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
      {query.isPending ? (
        <Loading label="Loading comparisons" />
      ) : (
        <>
          {!query.isError && !rows.length && <Empty title="No visual comparisons" />}
          <div className="qa-record-list">
            {rows.map((row) => (
              <article key={row.id}>
                <h3>{row.baseline.label}</h3>
                <p>
                  {row.baseline.environment} · {row.baseline.browser} ·{" "}
                  {new Date(row.createdAt).toLocaleString()}
                </p>
                <p>{row.changedPixels === 0 ? "No visual changes" : "Visual changes detected"}</p>
                <p>
                  {(row.ignoredPixels ?? 0).toLocaleString()} ignored pixels · Region revision{" "}
                  {row.ignoreRevision ?? 0}
                </p>
                <p>
                  {row.changedPixels.toLocaleString()} changed pixels (
                  {((row.changedPixels / row.comparedPixels) * 100).toFixed(2)}%)
                </p>
                <DifferenceDownload projectId={projectId} comparisonId={row.id} />
                {row.reviewDecision ? (
                  <div>
                    <p>
                      {row.reviewDecision === "ACCEPTED"
                        ? "Accepted difference"
                        : "Rejected difference"}{" "}
                      · {row.reviewedAt ? new Date(row.reviewedAt).toLocaleString() : ""}
                    </p>
                    <p>{row.reviewComment}</p>
                    <small>Reviewer: {row.reviewedBy}</small>
                  </div>
                ) : (
                  canReview && (
                    <button
                      className="qa-button"
                      type="button"
                      onClick={() => setReviewing(row.id)}
                    >
                      Review difference
                    </button>
                  )
                )}
              </article>
            ))}
          </div>
          {query.hasNextPage && (
            <button
              type="button"
              className="qa-button"
              disabled={query.isFetching}
              onClick={() => {
                void query.fetchNextPage();
              }}
            >
              Load more comparisons
            </button>
          )}
        </>
      )}
      {reviewing && (
        <ReviewDifference projectId={projectId} id={reviewing} close={() => setReviewing(null)} />
      )}
    </section>
  );
}

function ReviewDifference({
  projectId,
  id,
  close,
}: {
  projectId: string;
  id: string;
  close: () => void;
}) {
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState("REJECTED");
  const write = useWrite(projectId, close);
  return (
    <Modal title="Review visual difference" onClose={close} busy={write.isPending}>
      <p>
        Inspect the difference image before deciding. This decision is permanent for this
        comparison. Create a new comparison to review again.
      </p>
      <form
        className="qa-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!write.isPending && comment.trim())
            write.mutate({
              path: projectPath(projectId, `/visual-comparisons/${id}/review`),
              body: { decision, comment: comment.trim() },
            });
        }}
      >
        <Field label="Decision">
          <select
            value={decision}
            disabled={write.isPending}
            onChange={(event) => setDecision(event.target.value)}
          >
            <option value="REJECTED">Reject difference</option>
            <option value="ACCEPTED">Accept intentional difference</option>
          </select>
        </Field>
        <Field label="Review reason">
          <textarea
            required
            maxLength={2000}
            value={comment}
            disabled={write.isPending}
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>
        <ErrorNotice error={write.error} />
        <Submit pending={write.isPending}>Record review</Submit>
      </form>
    </Modal>
  );
}
