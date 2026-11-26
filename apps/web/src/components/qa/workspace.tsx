"use client";

import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  ClipboardList,
  Database,
  Folder,
  GitCompareArrows,
  Layers3,
  LogOut,
  Palette,
  Play,
  Plus,
  Plug,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  api,
  list,
  authenticate,
  forgetSession,
  projectPath,
  refreshSession,
  type Project,
  type User,
} from "../../lib/qa-api";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  OpenButton,
  schemaResolver,
  SectionHeading,
  Submit,
  ThemeButton,
  useWrite,
} from "./ui";
import { RequirementsView, MembersForm } from "./requirements";
import { CasesView } from "./cases";
import { RunsView, SuitesView } from "./execution";
import { AutomatedRuns } from "./automated";
import { ComparisonsView } from "./comparisons";
import { BaselinesView } from "./baselines";
import { SqlChecksView } from "./sql-checks";
import { DefectsView } from "./defects";
import { ReleasesView } from "./releases";
import { IntegrationsView } from "./integrations";
import { Overview } from "./overview";
import "./workspace.css";

const sessionKey = ["session"] as const;
const authSchema = z.object({
  name: z.string().trim().max(100),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});
type AuthValues = z.infer<typeof authSchema>;
const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(120),
  description: z.string().trim().max(4000),
});

export function Workspace() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: false, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionGate />
    </QueryClientProvider>
  );
}

function Brand() {
  return (
    <a className="wordmark" href="/" aria-label="DriftGate home">
      <span className="brand-icon">
        <ShieldCheck size={20} aria-hidden="true" />
      </span>
      DriftGate
    </a>
  );
}

function SessionGate() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: refreshSession,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  useEffect(() => {
    const expired = () => {
      void client.cancelQueries();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(sessionKey, null);
    };
    window.addEventListener("driftgate:unauthorized", expired);
    return () => window.removeEventListener("driftgate:unauthorized", expired);
  }, [client]);
  if (session.isPending || session.isError)
    return (
      <div className="qa-root">
        <header className="qa-header">
          <Brand />
          <ThemeButton />
        </header>
        <main className="qa-main" id="content">
          {session.isPending ? (
            <Loading label="Restoring session" />
          ) : (
            <ErrorNotice
              error={session.error}
              retry={() => {
                void session.refetch();
              }}
            />
          )}
        </main>
      </div>
    );
  if (!session.data) return <AuthScreen />;
  return <SignedIn key={session.data.id} user={session.data} />;
}

function AuthScreen() {
  const client = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const form = useForm<AuthValues>({
    resolver: schemaResolver(authSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (values: AuthValues) =>
      authenticate(
        mode,
        mode === "register" ? values : { email: values.email, password: values.password },
      ),
    onSuccess: (user) => {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(sessionKey, user);
    },
  });
  return (
    <div className="qa-root">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <header className="qa-header">
        <Brand />
        <div className="qa-actions">
          <a
            className="icon-button"
            href="/design"
            title="Design system"
            aria-label="Design system"
          >
            <Palette size={18} />
          </a>
          <ThemeButton />
        </div>
      </header>
      <main id="content" tabIndex={-1} className="qa-auth-main">
        <div className="qa-auth-heading">
          <span className="eyebrow">
            <span className="signal-tick" />
            QUALITY WORKSPACE
          </span>
          <h1>{mode === "login" ? "Sign in to DriftGate." : "Create your account."}</h1>
        </div>
        <div className="qa-segmented" aria-label="Account access">
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => {
              setMode("login");
              mutation.reset();
              form.clearErrors();
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === "register"}
            onClick={() => {
              setMode("register");
              mutation.reset();
              form.clearErrors();
            }}
          >
            Register
          </button>
        </div>
        <form
          className="qa-form"
          onSubmit={form.handleSubmit((values) => {
            if (mode === "register" && !values.name.trim()) {
              form.setError("name", { message: "Enter your name." }, { shouldFocus: true });
              return;
            }
            mutation.mutate(values);
          })}
          noValidate
        >
          {mode === "register" && (
            <Field label="Name" error={form.formState.errors.name?.message}>
              <input {...form.register("name")} autoComplete="name" required />
            </Field>
          )}
          <Field label="Email" error={form.formState.errors.email?.message}>
            <input {...form.register("email")} type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <input
              {...form.register("password")}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={12}
            />
          </Field>
          <ErrorNotice error={mutation.error} />
          <button
            type="submit"
            className="qa-button qa-primary qa-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      </main>
    </div>
  );
}

type View =
  | "overview"
  | "projects"
  | "requirements"
  | "cases"
  | "suites"
  | "runs"
  | "automated"
  | "comparisons"
  | "baselines"
  | "sql-checks"
  | "defects"
  | "releases"
  | "integrations";
const navigation = [
  { id: "overview", title: "Overview", icon: ShieldCheck },
  { id: "requirements", title: "Requirements", icon: BookOpen },
  { id: "cases", title: "Test cases", icon: ClipboardList },
  { id: "suites", title: "Suites", icon: Layers3 },
  { id: "runs", title: "Manual runs", icon: Play },
  { id: "automated", title: "Automated runs", icon: CheckCheck },
  { id: "comparisons", title: "Comparisons", icon: GitCompareArrows },
  { id: "baselines", title: "Visual baselines", icon: Layers3 },
  { id: "sql-checks", title: "SQL checks", icon: Database },
  { id: "defects", title: "Defects", icon: ClipboardList },
  { id: "releases", title: "Releases", icon: Rocket },
  { id: "integrations", title: "Integrations", icon: Plug },
] as const;

function SignedIn({ user }: { user: User }) {
  const client = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => list<Project>("/projects") });
  const [projectId, setProjectId] = useState("");
  const [view, setView] = useState<View>("projects");
  const [createProject, setCreateProject] = useState(false);
  const [members, setMembers] = useState(false);
  const project = projects.data?.find((item) => item.id === projectId);
  const detail = useQuery({
    queryKey: ["project", projectId, "detail"],
    queryFn: () => api<Project>(projectPath(projectId)),
    enabled: Boolean(project),
  });
  const selected = project
    ? { ...project, ...detail.data, role: detail.data?.role ?? project.role }
    : undefined;
  const canWrite = selected?.role === "ADMIN" || selected?.role === "QA";
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", "POST"),
    onSuccess: async () => {
      forgetSession();
      await client.cancelQueries();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== "session" });
      client.setQueryData(sessionKey, null);
    },
  });
  function selectProject(id: string) {
    setProjectId(id);
    setView(id ? "cases" : "projects");
    setMembers(false);
  }
  return (
    <div className="qa-root">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <header className="qa-header">
        <Brand />
        <span className="qa-header-label">Quality workspace</span>
        <div className="qa-actions">
          <span className="qa-user" title={user.email}>
            {user.name}
          </span>
          <ThemeButton />
          <button
            className="icon-button"
            type="button"
            title="Sign out"
            aria-label="Sign out"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="qa-shell">
        <aside className="qa-sidebar" aria-label="Workspace navigation">
          <button
            type="button"
            className="qa-nav-button"
            aria-current={view === "projects" ? "page" : undefined}
            onClick={() => setView("projects")}
          >
            <Folder size={18} aria-hidden="true" />
            Projects
          </button>
          <div className="qa-project-switch">
            <label htmlFor="project-switch">Current project</label>
            <select
              id="project-switch"
              value={projectId}
              onChange={(event) => selectProject(event.target.value)}
            >
              <option value="">Select a project</option>
              {projects.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <nav aria-label="Project">
            <div className="qa-nav-items">
              {navigation.map(({ id, title, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className="qa-nav-button"
                  aria-current={view === id ? "page" : undefined}
                  disabled={!selected || (id === "integrations" && selected.role !== "ADMIN")}
                  onClick={() => setView(id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {title}
                </button>
              ))}
            </div>
          </nav>
          <div className="qa-sidebar-bottom">
            {selected && (
              <span className="qa-role">
                <ShieldCheck size={14} aria-hidden="true" />
                {selected.role}
                {selected.role === "DEVELOPER" && " · Read only"}
              </span>
            )}
            <a href="/design" className="qa-nav-button">
              <Palette size={18} aria-hidden="true" />
              Design system
            </a>
          </div>
        </aside>
        <main id="content" tabIndex={-1} className="qa-main">
          <ErrorNotice error={logout.error} retry={() => logout.mutate()} />
          {projects.isPending ? (
            <Loading label="Loading projects" />
          ) : projects.isError ? (
            <ErrorNotice
              error={projects.error}
              retry={() => {
                void projects.refetch();
              }}
            />
          ) : view === "projects" ? (
            <>
              <SectionHeading title="Projects" description="Your quality work, project by project.">
                <button
                  type="button"
                  className="qa-button qa-primary"
                  onClick={() => setCreateProject(true)}
                >
                  <Plus size={16} aria-hidden="true" />
                  New project
                </button>
              </SectionHeading>
              {projects.data.length === 0 ? (
                <Empty title="No projects yet">Create a project to begin.</Empty>
              ) : (
                <div className="qa-project-list">
                  {projects.data.map((item) => (
                    <article key={item.id} className="qa-project-row">
                      <Folder size={22} aria-hidden="true" />
                      <div>
                        <h2>{item.name}</h2>
                        <p className="muted">{item.description || "No description"}</p>
                      </div>
                      <span className="qa-role">{item.role}</span>
                      <OpenButton onClick={() => selectProject(item.id)}>
                        Open<span className="sr-only"> {item.name}</span>
                      </OpenButton>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : !selected ? (
            <Empty title="Select a project">Choose a project to view its quality workspace.</Empty>
          ) : detail.isPending ? (
            <Loading label="Loading project" />
          ) : detail.isError ? (
            <ErrorNotice
              error={detail.error}
              retry={() => {
                void detail.refetch();
              }}
            />
          ) : (
            <>
              <div className="qa-project-context">
                <span>
                  <Folder size={14} aria-hidden="true" />
                  {selected.name}
                </span>
                {selected.role === "ADMIN" && (
                  <button className="qa-button" type="button" onClick={() => setMembers(true)}>
                    <Users size={16} aria-hidden="true" />
                    Add member
                  </button>
                )}
              </div>
              <div key={projectId}>
                {view === "overview" ? (
                  <Overview projectId={projectId} onNavigate={setView} />
                ) : view === "requirements" ? (
                  <RequirementsView projectId={projectId} canWrite={canWrite} />
                ) : view === "cases" ? (
                  <CasesView projectId={projectId} canWrite={canWrite} />
                ) : view === "suites" ? (
                  <SuitesView projectId={projectId} canWrite={canWrite} />
                ) : view === "automated" ? (
                  <AutomatedRuns projectId={projectId} canWrite={canWrite} />
                ) : view === "baselines" ? (
                  <BaselinesView
                    key={projectId}
                    projectId={projectId}
                    canReview={selected.role === "ADMIN" || selected.role === "APPROVER"}
                  />
                ) : view === "sql-checks" ? (
                  <SqlChecksView projectId={projectId} canWrite={canWrite} />
                ) : view === "defects" ? (
                  <DefectsView projectId={projectId} role={selected.role} />
                ) : view === "integrations" ? (
                  <IntegrationsView projectId={projectId} isAdmin={selected.role === "ADMIN"} />
                ) : view === "releases" ? (
                  <ReleasesView
                    projectId={projectId}
                    canWrite={canWrite}
                    canApprove={selected.role === "APPROVER"}
                  />
                ) : view === "comparisons" ? (
                  <ComparisonsView key={projectId} projectId={projectId} canWrite={canWrite} />
                ) : (
                  <RunsView projectId={projectId} canWrite={canWrite} />
                )}
              </div>
            </>
          )}
          <footer className="qa-footer">
            <span>
              <CheckCheck size={14} aria-hidden="true" />
              DriftGate
            </span>
            <span>Ink and Signal</span>
          </footer>
        </main>
      </div>
      {createProject && (
        <ProjectForm
          onClose={() => setCreateProject(false)}
          onCreated={(created) => {
            setCreateProject(false);
            selectProject(created.id);
          }}
        />
      )}
      {members && selected?.role === "ADMIN" && (
        <MembersForm projectId={projectId} onClose={() => setMembers(false)} />
      )}
    </div>
  );
}

function ProjectForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: schemaResolver(projectSchema),
    defaultValues: { name: "", description: "" },
  });
  const mutation = useWrite<Project>("", onCreated);
  return (
    <Modal title="New project" onClose={onClose} busy={mutation.isPending}>
      <form
        className="qa-form"
        onSubmit={form.handleSubmit((body) => mutation.mutate({ path: "/projects", body }))}
        noValidate
      >
        <Field label="Project name" error={form.formState.errors.name?.message}>
          <input {...form.register("name")} required />
        </Field>
        <Field label="Description" error={form.formState.errors.description?.message}>
          <textarea {...form.register("description")} rows={3} />
        </Field>
        <ErrorNotice error={mutation.error} />
        <div className="qa-form-footer">
          <Submit pending={mutation.isPending}>Create project</Submit>
        </div>
      </form>
    </Modal>
  );
}
