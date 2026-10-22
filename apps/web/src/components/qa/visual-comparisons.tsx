"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Scan, Download } from "lucide-react";
import { api, page, projectPath } from "../../lib/qa-api";
import { Empty, ErrorNotice, Loading, useWrite } from "./ui";

type Comparison = {
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

export function VisualComparisons({ projectId }: { projectId: string }) {
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
                  {row.changedPixels.toLocaleString()} changed pixels (
                  {((row.changedPixels / row.comparedPixels) * 100).toFixed(2)}%)
                </p>
                <DifferenceDownload projectId={projectId} comparisonId={row.id} />
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
    </section>
  );
}
