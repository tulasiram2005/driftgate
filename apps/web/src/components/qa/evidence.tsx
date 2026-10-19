"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { api, projectPath } from "../../lib/qa-api";
import { EvidenceLink } from "./automated";
import { ErrorNotice, Field } from "./ui";

type Evidence = { id: string; kind: string; ready: boolean; sizeBytes: number };

export function ManualEvidence({
  projectId,
  runId,
  resultId,
  canWrite,
}: {
  projectId: string;
  runId: string;
  resultId: string;
  canWrite: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const path = projectPath(projectId, `/runs/${runId}/results/${resultId}/evidence`);
  const detail = useQuery({
    queryKey: ["project", projectId, "evidence", runId, resultId],
    queryFn: () =>
      api<{ results: { id: string; evidence: Evidence[] }[] }>(
        projectPath(projectId, `/runs/${runId}`),
      ),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (
        !file ||
        !["image/png", "image/jpeg"].includes(file.type) ||
        !file.size ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Choose a PNG or JPEG screenshot up to 5 MB.");
      const reservation = await api<{ evidence: Evidence; uploadUrl: string }>(path, "POST", {
        contentType: file.type,
        sizeBytes: file.size,
      });
      const response = await fetch(reservation.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error("Screenshot upload failed. Please retry.");
      await api(`${path}/${reservation.evidence.id}/complete`, "POST");
    },
    onSuccess: () => {
      setFile(null);
      void detail.refetch();
    },
  });
  const evidence = detail.data?.results.find((result) => result.id === resultId)?.evidence ?? [];
  return (
    <section aria-label="Screenshots" className="qa-form">
      <h3>Screenshots</h3>
      <ErrorNotice error={detail.error} retry={() => void detail.refetch()} />
      {evidence
        .filter((item) => item.ready)
        .map((item) => (
          <EvidenceLink
            key={item.id}
            projectId={projectId}
            runId={runId}
            resultId={resultId}
            evidence={item}
          />
        ))}
      {canWrite && (
        <form
          className="qa-form"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <Field label="Attach screenshot">
            <input
              key={upload.isSuccess ? "uploaded" : "select"}
              type="file"
              accept="image/png,image/jpeg"
              disabled={upload.isPending}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <ErrorNotice error={upload.error} />
          {upload.isSuccess && <p role="status">Screenshot attached.</p>}
          <button type="submit" className="qa-button" disabled={!file || upload.isPending}>
            <Upload size={16} />
            {upload.isPending ? "Uploading..." : "Attach screenshot"}
          </button>
        </form>
      )}
    </section>
  );
}
