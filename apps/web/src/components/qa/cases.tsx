"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  flexRender,
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useFieldArray, useForm } from "react-hook-form";
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { z } from "zod";
import { api, list, exportCases, projectPath, type TestCase } from "../../lib/qa-api";
import { useRequirements } from "./requirements";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  schemaResolver,
  SectionHeading,
  Submit,
  useWrite,
} from "./ui";

export function useCases(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId, "cases"],
    queryFn: () => list<TestCase>(projectPath(projectId, "/cases")),
  });
}

const emptyCases: TestCase[] = [];
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

export function CasesView({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const cases = useCases(projectId);
  const [editor, setEditor] = useState<TestCase | "new" | null>(null);
  const [history, setHistory] = useState<TestCase | null>(null);
  const [deleting, setDeleting] = useState<TestCase | null>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const exportMutation = useMutation({ mutationFn: () => exportCases(projectId) });
  const columns = useMemo<ColumnDef<typeof features, TestCase>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Test case",
        sortingFn: "alphanumeric",
        cell: ({ row }) => (
          <button type="button" className="qa-case-title" onClick={() => setEditor(row.original)}>
            {row.original.title}
            <span className="muted">{row.original.tags.join(" · ") || "No tags"}</span>
          </button>
        ),
      },
      {
        accessorKey: "priority",
        header: "Priority",
        filterFn: "equalsString",
        sortingFn: "alphanumeric",
        cell: ({ getValue }) => (
          <span className={`qa-priority qa-priority-${String(getValue()).toLowerCase()}`}>
            {String(getValue())}
          </span>
        ),
      },
      { accessorKey: "type", header: "Type", sortingFn: "alphanumeric" },
      {
        accessorKey: "version",
        header: "Version",
        sortingFn: "basic",
        cell: ({ getValue }) => <span className="mono">v{String(getValue())}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="qa-row-actions">
            <button
              type="button"
              className="icon-button"
              title={`Version history: ${row.original.title}`}
              aria-label={`Version history: ${row.original.title}`}
              onClick={() => setHistory(row.original)}
            >
              <History size={17} />
            </button>
            {canWrite && (
              <>
                <button
                  type="button"
                  className="icon-button"
                  title={`Edit: ${row.original.title}`}
                  aria-label={`Edit: ${row.original.title}`}
                  onClick={() => setEditor(row.original)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button qa-danger-icon"
                  title={`Delete: ${row.original.title}`}
                  aria-label={`Delete: ${row.original.title}`}
                  onClick={() => setDeleting(row.original)}
                >
                  <Trash2 size={17} />
                </button>
              </>
            )}
          </div>
        ),
      },
    ],
    [canWrite],
  );
  const table = useTable({
    features,
    data: cases.data ?? emptyCases,
    columns,
    state: {
      sorting,
      globalFilter: search,
      columnFilters: priority ? [{ id: "priority", value: priority }] : [],
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _columnId, value: string) =>
      `${row.original.title} ${row.original.tags.join(" ")} ${row.original.description}`
        .toLowerCase()
        .includes(value.toLowerCase()),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <>
      <SectionHeading title="Test cases" description="Define the steps. Keep the history.">
        <button
          className="qa-button"
          type="button"
          disabled={exportMutation.isPending || !cases.data?.length}
          onClick={() => exportMutation.mutate()}
        >
          <Download size={16} aria-hidden="true" />
          {exportMutation.isPending ? "Exporting..." : "Export CSV"}
        </button>
        {canWrite && (
          <>
            <button className="qa-button" type="button" onClick={() => setImporting(true)}>
              <Upload size={16} aria-hidden="true" />
              Import CSV
            </button>
            <button className="qa-button qa-primary" type="button" onClick={() => setEditor("new")}>
              <Plus size={16} aria-hidden="true" />
              New case
            </button>
          </>
        )}
      </SectionHeading>
      <ErrorNotice error={exportMutation.error} retry={() => exportMutation.mutate()} />
      <div className="qa-toolbar">
        <label className="qa-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search test cases</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cases or tags"
            type="search"
          />
        </label>
        <label className="qa-inline-field">
          <span className="sr-only">Filter priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">All priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </label>
      </div>
      {cases.isPending ? (
        <Loading label="Loading test cases" />
      ) : cases.isError ? (
        <ErrorNotice
          error={cases.error}
          retry={() => {
            void cases.refetch();
          }}
        />
      ) : !cases.data.length ? (
        <Empty title="No test cases yet" />
      ) : (
        <>
          <div className="qa-table-scroll" role="region" aria-label="Test cases table" tabIndex={0}>
            <table className="qa-table">
              <caption className="sr-only">Project test cases</caption>
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="qa-sort"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <ArrowDownUp size={13} aria-hidden="true" />
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!table.getFilteredRowModel().rows.length && <Empty title="No matching test cases" />}
          <div className="qa-pagination">
            <span className="muted">
              {table.getFilteredRowModel().rows.length} cases · Page{" "}
              {table.state.pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <div className="qa-actions">
              <button
                type="button"
                className="icon-button"
                title="Previous page"
                aria-label="Previous page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Next page"
                aria-label="Next page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
      {editor &&
        (canWrite ? (
          <CaseEditor
            projectId={projectId}
            record={editor === "new" ? undefined : editor}
            onClose={() => setEditor(null)}
          />
        ) : (
          editor !== "new" && (
            <Modal title={editor.title} onClose={() => setEditor(null)}>
              <CaseSnapshot record={editor} />
            </Modal>
          )
        ))}
      {history && (
        <VersionHistory projectId={projectId} record={history} onClose={() => setHistory(null)} />
      )}
      {deleting && (
        <DeleteCase projectId={projectId} record={deleting} onClose={() => setDeleting(null)} />
      )}
      {importing && <ImportCases projectId={projectId} onClose={() => setImporting(false)} />}
    </>
  );
}

const caseSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200),
  description: z.string().trim().max(10000),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  type: z.enum(["MANUAL", "AUTOMATED"]),
  tags: z
    .string()
    .max(2000)
    .refine((value) => {
      const tags = value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      return tags.length <= 20 && tags.every((tag) => tag.length <= 50);
    }, "Use at most 20 tags, each no longer than 50 characters."),
  requirementId: z.string(),
  steps: z
    .array(
      z.object({
        action: z.string().trim().min(1, "Each step needs an action.").max(2000),
        expected: z.string().trim().min(1, "Each step needs an expected result.").max(2000),
      }),
    )
    .min(1, "Add at least one step.")
    .max(50, "Use at most 50 steps."),
});
type CaseValues = z.infer<typeof caseSchema>;

function CaseEditor({
  projectId,
  record,
  onClose,
}: {
  projectId: string;
  record?: TestCase | undefined;
  onClose: () => void;
}) {
  const requirements = useRequirements(projectId);
  const form = useForm<CaseValues>({
    resolver: schemaResolver(caseSchema),
    defaultValues: record
      ? {
          ...record,
          description: record.description ?? "",
          requirementId: record.requirementId ?? "",
          tags: record.tags.join(", "),
        }
      : {
          title: "",
          description: "",
          priority: "MEDIUM",
          type: "MANUAL",
          tags: "",
          requirementId: "",
          steps: [{ action: "", expected: "" }],
        },
  });
  const steps = useFieldArray({ control: form.control, name: "steps" });
  const mutation = useWrite(projectId, onClose);
  return (
    <Modal
      title={record ? "Edit test case" : "New test case"}
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="qa-form"
        noValidate
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate({
            path: projectPath(projectId, `/cases${record ? `/${record.id}` : ""}`),
            method: record ? "PUT" : "POST",
            body: {
              ...values,
              tags: [
                ...new Set(
                  values.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                ),
              ],
              requirementId: values.requirementId || null,
            },
          }),
        )}
      >
        {record && <p className="muted mono">Editing version {record.version}</p>}
        <Field label="Title" error={form.formState.errors.title?.message}>
          <input {...form.register("title")} required />
        </Field>
        <Field label="Description" error={form.formState.errors.description?.message}>
          <textarea {...form.register("description")} rows={3} />
        </Field>
        <div className="qa-form-grid">
          <Field label="Priority">
            <select {...form.register("priority")}>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </Field>
          <Field label="Type">
            <select {...form.register("type")}>
              <option value="MANUAL">Manual</option>
              <option value="AUTOMATED">Automated</option>
            </select>
          </Field>
        </div>
        <Field label="Tags (comma separated)" error={form.formState.errors.tags?.message}>
          <input {...form.register("tags")} />
        </Field>
        <Field label="Requirement">
          <select
            {...form.register("requirementId")}
            disabled={requirements.isPending || requirements.isError}
          >
            <option value="">No requirement</option>
            {requirements.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        {requirements.isPending && <Loading label="Loading requirements" />}
        <ErrorNotice
          error={requirements.error}
          retry={() => {
            void requirements.refetch();
          }}
        />
        <fieldset className="qa-step-fieldset">
          <legend>Test steps</legend>
          <ErrorNotice
            error={
              form.formState.errors.steps?.message
                ? new Error(form.formState.errors.steps.message)
                : null
            }
          />
          {steps.fields.map((step, index) => (
            <div className="qa-step-editor" key={step.id}>
              <div className="qa-step-heading">
                <span className="mono">Step {index + 1}</span>
                <button
                  className="icon-button qa-danger-icon"
                  type="button"
                  aria-label={`Remove step ${index + 1}`}
                  title={`Remove step ${index + 1}`}
                  disabled={steps.fields.length === 1}
                  onClick={() => steps.remove(index)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <Field
                label={`Action ${index + 1}`}
                error={form.formState.errors.steps?.[index]?.action?.message}
              >
                <textarea {...form.register(`steps.${index}.action`)} required rows={2} />
              </Field>
              <Field
                label={`Expected result ${index + 1}`}
                error={form.formState.errors.steps?.[index]?.expected?.message}
              >
                <textarea {...form.register(`steps.${index}.expected`)} required rows={2} />
              </Field>
            </div>
          ))}
          <button
            className="qa-button"
            type="button"
            onClick={() => steps.append({ action: "", expected: "" })}
          >
            <Plus size={16} aria-hidden="true" />
            Add step
          </button>
        </fieldset>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending || requirements.isPending || requirements.isError}>
            {record ? "Save new version" : "Create case"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

export function CaseSnapshot({
  record,
}: {
  record: Pick<TestCase, "title" | "steps" | "version"> & Partial<TestCase>;
}) {
  return (
    <div className="qa-snapshot">
      <div className="qa-actions">
        <span className="mono">Version {record.version}</span>
        {record.priority && <span className="qa-role">{record.priority}</span>}
        {record.type && <span className="qa-role">{record.type}</span>}
      </div>
      <h3>{record.title}</h3>
      {record.description && <p className="qa-prose muted">{record.description}</p>}
      {record.tags?.length ? <p className="muted">{record.tags.join(" · ")}</p> : null}
      <ol className="qa-steps">
        {record.steps.map((step, index) => (
          <li key={index}>
            <p className="qa-prose">{step.action}</p>
            <span className="qa-step-label">Expected result</span>
            <p className="qa-prose muted">{step.expected}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VersionHistory({
  projectId,
  record,
  onClose,
}: {
  projectId: string;
  record: TestCase;
  onClose: () => void;
}) {
  const versions = useQuery({
    queryKey: ["project", projectId, "versions", record.id],
    queryFn: async () => {
      const versions = await api<Array<TestCase | { version: number; snapshot: TestCase }>>(
        projectPath(projectId, `/cases/${record.id}/versions`),
      );
      return versions.map((version) =>
        "snapshot" in version ? { ...version.snapshot, version: version.version } : version,
      );
    },
  });
  return (
    <Modal title="Version history" onClose={onClose}>
      <p className="muted">{record.title}</p>
      {versions.isPending ? (
        <Loading label="Loading versions" />
      ) : versions.isError ? (
        <ErrorNotice
          error={versions.error}
          retry={() => {
            void versions.refetch();
          }}
        />
      ) : !versions.data.length ? (
        <Empty title="No saved versions" />
      ) : (
        <div className="qa-versions">
          {[...versions.data]
            .sort((a, b) => b.version - a.version)
            .map((version) => (
              <details key={version.version} open={version.version === record.version}>
                <summary>Version {version.version}</summary>
                <CaseSnapshot record={version} />
              </details>
            ))}
        </div>
      )}
    </Modal>
  );
}

function DeleteCase({
  projectId,
  record,
  onClose,
}: {
  projectId: string;
  record: TestCase;
  onClose: () => void;
}) {
  const mutation = useWrite(projectId, onClose);
  return (
    <Modal title="Delete test case?" onClose={onClose} busy={mutation.isPending}>
      <p className="qa-prose">Delete “{record.title}”? This action cannot be undone.</p>
      <ErrorNotice error={mutation.error} />
      <div className="qa-form-footer">
        <button className="qa-button" type="button" disabled={mutation.isPending} onClick={onClose}>
          Cancel
        </button>
        <button
          className="qa-button qa-danger"
          type="button"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              path: projectPath(projectId, `/cases/${record.id}`),
              method: "DELETE",
            })
          }
        >
          <Trash2 size={16} aria-hidden="true" />
          {mutation.isPending ? "Deleting..." : "Delete case"}
        </button>
      </div>
    </Modal>
  );
}

const importSchema = z.object({
  csv: z
    .string()
    .min(1, "Choose a CSV file or paste CSV content.")
    .max(900_000, "CSV must be smaller than 900 KB."),
});

function ImportCases({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const form = useForm<z.infer<typeof importSchema>>({
    resolver: schemaResolver(importSchema),
    defaultValues: { csv: "" },
  });
  const [fileError, setFileError] = useState<Error | null>(null);
  const [reading, setReading] = useState(false);
  const mutation = useWrite(projectId, onClose);
  return (
    <Modal title="Import test cases" onClose={onClose} busy={mutation.isPending || reading}>
      <form
        className="qa-form"
        noValidate
        onSubmit={form.handleSubmit((body) =>
          mutation.mutate({ path: projectPath(projectId, "/cases/import"), body }),
        )}
      >
        <Field label="CSV file">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileError(null);
              if (file.size > 900_000) {
                setFileError(new Error("CSV must be smaller than 900 KB."));
                return;
              }
              setReading(true);
              try {
                form.setValue("csv", await file.text(), { shouldValidate: true });
              } catch {
                setFileError(new Error("Could not read this file. Please try again."));
              } finally {
                setReading(false);
              }
            }}
          />
        </Field>
        <Field label="CSV content" error={form.formState.errors.csv?.message}>
          <textarea {...form.register("csv")} rows={8} spellCheck={false} />
        </Field>
        <ErrorNotice error={fileError || mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending || reading}>Import cases</Submit>
        </div>
      </form>
    </Modal>
  );
}
