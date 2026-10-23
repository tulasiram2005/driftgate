"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { page, projectPath } from "../../lib/qa-api";
import { Empty, ErrorNotice, Field, Loading, SectionHeading, Submit, useWrite } from "./ui";

type SqlRun = {
  id: string;
  environment: string;
  status: "PASS" | "FAIL" | "ERROR";
  durationMs: number;
  createdAt: string;
  errorCode: string | null;
  results: { check: string; status: "PASS" | "FAIL"; violations: number }[];
};
const names: Record<string, string> = {
  "nonnegative-stock": "Nonnegative stock",
  "order-totals": "Order totals",
  "orphan-order-items": "Orphan order items",
};
export function SqlChecksView({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const [environment, setEnvironment] = useState("staging");
  const write = useWrite<SqlRun>(projectId);
  const query = useInfiniteQuery({
    queryKey: ["project", projectId, "sql-checks"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => page<SqlRun>(projectPath(projectId, "/sql-checks"), pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = query.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <>
      <SectionHeading title="SQL checks" />
      {canWrite && (
        <form
          className="qa-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!write.isPending)
              write.mutate({ path: projectPath(projectId, "/sql-checks"), body: { environment } });
          }}
        >
          <Field label="Environment">
            <select
              value={environment}
              disabled={write.isPending}
              onChange={(event) => setEnvironment(event.target.value)}
            >
              {["staging", "uat", "preprod", "prod"].map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <Submit pending={write.isPending}>Run SQL checks</Submit>
          <ErrorNotice error={write.error} />
        </form>
      )}
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
      {query.isPending ? (
        <Loading label="Loading SQL results" />
      ) : (
        <>
          {!query.isError && !rows.length && <Empty title="No SQL results" />}
          <div className="qa-record-list">
            {rows.map((row) => (
              <article key={row.id}>
                <h2>
                  {row.environment.toUpperCase()} · {row.status}
                </h2>
                <p>
                  {new Date(row.createdAt).toLocaleString()} · {row.durationMs} ms
                </p>
                {row.status === "ERROR" ? (
                  <p role="status">
                    Checks could not complete. Verify the read-only database configuration before
                    retrying.
                  </p>
                ) : (
                  <ul>
                    {row.results.map((result) => (
                      <li key={result.check}>
                        {names[result.check] ?? result.check}: {result.status} · {result.violations}{" "}
                        violations
                      </li>
                    ))}
                  </ul>
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
              Load more SQL results
            </button>
          )}
        </>
      )}
    </>
  );
}
