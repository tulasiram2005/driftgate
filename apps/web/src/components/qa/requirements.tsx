"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Pencil, Plus } from "lucide-react";
import { z } from "zod";
import {
  api,
  list,
  projectPath,
  type Requirement,
  type Role,
  type TestCase,
  type User,
} from "../../lib/qa-api";
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

export function useRequirements(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId, "requirements"],
    queryFn: () => list<Requirement>(projectPath(projectId, "/requirements")),
  });
}

const requirementSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200),
  description: z.string().trim().max(10000),
});

export function RequirementsView({
  projectId,
  canWrite,
}: {
  projectId: string;
  canWrite: boolean;
}) {
  const requirements = useRequirements(projectId);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState("requirements");
  return (
    <>
      <SectionHeading title="Requirements" description="The expectations behind your test cases.">
        {canWrite && (
          <button className="qa-button qa-primary" type="button" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New requirement
          </button>
        )}
      </SectionHeading>
      <div className="qa-view-tabs" aria-label="Requirement views">
        <button
          type="button"
          aria-pressed={view === "requirements"}
          onClick={() => setView("requirements")}
        >
          Requirements
        </button>
        <button
          type="button"
          aria-pressed={view === "coverage"}
          onClick={() => setView("coverage")}
        >
          Coverage (RTM)
        </button>
      </div>
      {view === "coverage" ? (
        <CoverageView projectId={projectId} />
      ) : requirements.isPending ? (
        <Loading label="Loading requirements" />
      ) : requirements.isError ? (
        <ErrorNotice
          error={requirements.error}
          retry={() => {
            void requirements.refetch();
          }}
        />
      ) : !requirements.data.length ? (
        <Empty title="No requirements yet" />
      ) : (
        <div className="qa-record-list">
          {requirements.data.map((item) => (
            <article key={item.id}>
              <h2>{item.title}</h2>
              <p className="qa-prose muted">{item.description || "No description"}</p>
            </article>
          ))}
        </div>
      )}
      {creating && <RequirementForm projectId={projectId} onClose={() => setCreating(false)} />}
    </>
  );
}

type CoverageRequirement = Requirement & {
  cases: Pick<TestCase, "id" | "title" | "priority" | "version">[];
};

function CoverageView({ projectId }: { projectId: string }) {
  const coverage = useQuery({
    queryKey: ["project", projectId, "coverage"],
    queryFn: () => api<CoverageRequirement[]>(projectPath(projectId, "/coverage")),
  });
  if (coverage.isPending) return <Loading label="Loading requirement coverage" />;
  if (coverage.isError)
    return (
      <ErrorNotice
        error={coverage.error}
        retry={() => {
          void coverage.refetch();
        }}
      />
    );
  if (!coverage.data.length) return <Empty title="No requirements to trace yet" />;
  return (
    <div
      className="qa-table-scroll"
      role="region"
      aria-label="Requirement traceability matrix"
      tabIndex={0}
    >
      <table className="qa-coverage-table">
        <caption className="sr-only">Requirement traceability matrix</caption>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">Linked test cases</th>
            <th scope="col">Coverage</th>
          </tr>
        </thead>
        <tbody>
          {coverage.data.map((requirement) => (
            <tr key={requirement.id}>
              <th scope="row">{requirement.title}</th>
              <td>
                {requirement.cases.length ? (
                  <ul>
                    {requirement.cases.map((item) => (
                      <li key={item.id}>
                        <span>{item.title}</span>
                        <span className="muted mono">
                          v{item.version} · {item.priority}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">No linked cases</span>
                )}
              </td>
              <td>
                <span
                  className={`status-pill ${requirement.cases.length ? "status-pass" : "status-warn"}`}
                >
                  {requirement.cases.length ? "Covered" : "Uncovered"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequirementForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const form = useForm<z.infer<typeof requirementSchema>>({
    resolver: schemaResolver(requirementSchema),
    defaultValues: { title: "", description: "" },
  });
  const mutation = useWrite(projectId, onClose);
  return (
    <Modal title="New requirement" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        noValidate
        onSubmit={form.handleSubmit((body) =>
          mutation.mutate({ path: projectPath(projectId, "/requirements"), body }),
        )}
      >
        <Field label="Title" error={form.formState.errors.title?.message}>
          <input {...form.register("title")} required />
        </Field>
        <Field label="Description" error={form.formState.errors.description?.message}>
          <textarea {...form.register("description")} rows={4} />
        </Field>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending}>Create requirement</Submit>
        </div>
      </form>
    </Modal>
  );
}

const memberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(["QA", "DEVELOPER", "APPROVER"]),
});

export function MembersForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const members = useQuery({
    queryKey: ["project", projectId, "members"],
    queryFn: () =>
      api<{ id: string; role: Role; user: User }[]>(projectPath(projectId, "/members")),
  });
  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: schemaResolver(memberSchema),
    defaultValues: { email: "", role: "QA" },
  });
  const mutation = useWrite(projectId);
  return (
    <Modal title="Add project member" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        noValidate
        onSubmit={form.handleSubmit((body) =>
          mutation.mutate({ path: projectPath(projectId, "/members"), body }),
        )}
      >
        <section aria-label="Current project members">
          <h3>Members</h3>
          {members.isPending ? (
            <Loading label="Loading members" />
          ) : members.isError ? (
            <ErrorNotice
              error={members.error}
              retry={() => {
                void members.refetch();
              }}
            />
          ) : (
            <ul className="qa-member-list">
              {members.data.map((member) => (
                <li key={member.id}>
                  <div>
                    <span>{member.user.name}</span>
                    <small className="muted">{member.user.email}</small>
                  </div>
                  <span className="qa-role">{member.role}</span>
                  {member.role !== "ADMIN" && (
                    <button
                      className="icon-button"
                      type="button"
                      title={`Change role: ${member.user.name}`}
                      aria-label={`Change role: ${member.user.name}`}
                      onClick={() => {
                        form.setValue("email", member.user.email);
                        form.setValue("role", member.role as "QA" | "DEVELOPER" | "APPROVER");
                        form.setFocus("role");
                        mutation.reset();
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <Field label="Member email" error={form.formState.errors.email?.message}>
          <input {...form.register("email")} type="email" autoComplete="email" required />
        </Field>
        <Field label="Role" error={form.formState.errors.role?.message}>
          <select {...form.register("role")}>
            <option value="QA">QA</option>
            <option value="DEVELOPER">Developer</option>
            <option value="APPROVER">Approver</option>
          </select>
        </Field>
        <ErrorNotice error={mutation.error} />
        {mutation.isSuccess && (
          <p className="qa-success" role="status">
            Member added.
          </p>
        )}
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending}>Save member</Submit>
        </div>
      </form>
    </Modal>
  );
}
