"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { projectPath } from "../../lib/qa-api";
import { ErrorNotice, Field, Submit, useWrite } from "./ui";

export type IgnoreRegion = { x: number; y: number; width: number; height: number };
export function IgnoreRegions({
  projectId,
  baselineId,
  regions,
  revision,
  width,
  height,
  onSaved,
}: {
  projectId: string;
  baselineId: string;
  regions: IgnoreRegion[];
  revision: number;
  width: number;
  height: number;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState(() => regions.map((region, key) => ({ ...region, key })));
  const [nextKey, setNextKey] = useState(regions.length);
  const write = useWrite(projectId, onSaved);
  return (
    <form
      className="qa-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!write.isPending)
          write.mutate({
            path: projectPath(projectId, `/visual-baselines/${baselineId}/ignore-regions`),
            method: "PUT",
            body: {
              revision,
              regions: rows.map(({ x, y, width, height }) => ({ x, y, width, height })),
            },
          });
      }}
    >
      <h3>Ignore regions</h3>
      <p>
        Revision {revision} · {width} × {height}
      </p>
      {rows.map((row, index) => (
        <fieldset key={row.key} disabled={write.isPending} style={{ minWidth: 0 }}>
          <legend>Region {index + 1}</legend>
          {(["x", "y", "width", "height"] as const).map((field) => (
            <Field key={field} label={`${field.toUpperCase()} (pixels)`}>
              <input
                type="number"
                required
                step={1}
                min={field === "x" || field === "y" ? 0 : 1}
                max={field === "x" || field === "width" ? width : height}
                value={Number.isNaN(row[field]) ? "" : row[field]}
                onChange={(event) => {
                  const value = event.target.valueAsNumber;
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key ? { ...item, [field]: value } : item,
                    ),
                  );
                }}
              />
            </Field>
          ))}
          <button
            type="button"
            className="icon-button"
            title={`Remove region ${index + 1}`}
            aria-label={`Remove region ${index + 1}`}
            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="qa-button"
        disabled={write.isPending || rows.length >= 100}
        onClick={() => {
          setRows((current) => [...current, { key: nextKey, x: 0, y: 0, width: 1, height: 1 }]);
          setNextKey((key) => key + 1);
        }}
      >
        <Plus size={18} aria-hidden="true" />
        Add region
      </button>
      <ErrorNotice error={write.error} />
      <Submit pending={write.isPending}>Save ignore regions</Submit>
    </form>
  );
}
