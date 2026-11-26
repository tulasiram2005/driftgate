"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RefreshCw } from "lucide-react";
import { api, ApiError, getJiraSettings, projectPath, type JiraSettings } from "../../lib/qa-api";
import { Empty, ErrorNotice, Field, Loading, Modal, SectionHeading, Submit } from "./ui";

export function IntegrationsView({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const client = useQueryClient();
  const queryKey = ["project", projectId, "jira-settings"];
  const settings = useQuery({
    queryKey,
    queryFn: () => getJiraSettings(projectId),
    enabled: isAdmin,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (!isAdmin) return <Empty title="Project administrator access required" />;
  return (
    <>
      <SectionHeading title="Integrations" />
      <h2>Jira</h2>
      {settings.isPending ? (
        <Loading label="Loading Jira settings" />
      ) : settings.isError ? (
        <ErrorNotice
          error={settings.error}
          retry={() => {
            void settings.refetch();
          }}
        />
      ) : (
        <>
          {settings.data.data &&
          settings.data.data.connected !== false &&
          settings.data.available === true ? (
            <JiraAccessCheck
              key={`jira-access-${projectId}-${settings.data.data.revision}`}
              projectId={projectId}
              revision={settings.data.data.revision}
            />
          ) : (
            <p role="status">
              {settings.data.data?.connected === false
                ? "Jira disconnected. Saved credentials removed."
                : settings.data.data
                  ? "Settings saved. Connection not verified."
                  : "Not configured"}
            </p>
          )}
          {settings.data.available !== true ? (
            <ErrorNotice
              error={
                new Error("Jira settings are unavailable until server encryption is configured.")
              }
            />
          ) : (
            <JiraForm
              key={`jira-form-${projectId}-${settings.data.data?.revision ?? 0}`}
              projectId={projectId}
              initial={settings.data.data}
              onSaved={(data) => client.setQueryData(queryKey, { data, available: true })}
              onReload={() => {
                void settings.refetch();
              }}
            />
          )}
          {settings.data.data && settings.data.data.connected !== false && (
            <JiraDisconnect
              projectId={projectId}
              revision={settings.data.data.revision}
              onSaved={(data) => {
                client.setQueryData(queryKey, { data, available: settings.data.available });
                void client.invalidateQueries({ queryKey: ["project", projectId] });
              }}
              onReload={() => {
                void settings.refetch();
              }}
            />
          )}
        </>
      )}
    </>
  );
}

function JiraDisconnect({
  projectId,
  revision,
  onSaved,
  onReload,
}: {
  projectId: string;
  revision: number;
  onSaved: (data: JiraSettings) => void;
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const disconnect = useMutation({
    mutationFn: () =>
      api<JiraSettings>(projectPath(projectId, "/integrations/jira/disconnect"), "POST", {
        revision,
      }),
    retry: false,
    onSuccess: onSaved,
  });
  return (
    <>
      <button
        className="qa-button"
        type="button"
        onClick={() => {
          disconnect.reset();
          setOpen(true);
        }}
      >
        Disconnect Jira
      </button>
      {open && (
        <Modal title="Disconnect Jira?" busy={disconnect.isPending} onClose={() => setOpen(false)}>
          <p>
            This removes saved Jira credentials and stops future Jira checks and exports. Existing
            ticket links and QA history stay available. Requests already sent may still finish. Your
            Atlassian token is not revoked.
          </p>
          <ErrorNotice error={disconnect.error} retry={onReload} />
          <button
            className="qa-button"
            type="button"
            disabled={disconnect.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            className="qa-button"
            type="button"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {disconnect.isPending ? "Disconnecting..." : "Confirm disconnect"}
          </button>
        </Modal>
      )}
    </>
  );
}

function JiraAccessCheck({ projectId, revision }: { projectId: string; revision: number }) {
  const check = useMutation({
    mutationFn: () =>
      api<{ revision: number; checkedAt: string; status: string }>(
        projectPath(projectId, "/integrations/jira/verify"),
        "POST",
        { revision },
      ),
    retry: false,
  });
  return (
    <div>
      <p role="status">
        {check.isSuccess && check.data.revision === revision
          ? `Jira access confirmed at ${new Date(check.data.checkedAt).toLocaleTimeString()}. Issue creation not tested.`
          : "Settings saved. Connection not verified."}
      </p>
      <ErrorNotice error={check.error} />
      <button
        type="button"
        className="qa-button"
        disabled={check.isPending}
        onClick={() => check.mutate()}
      >
        <RefreshCw size={16} aria-hidden="true" />
        {check.isPending ? "Checking access..." : "Check Jira access"}
      </button>
    </div>
  );
}

function JiraForm({
  projectId,
  initial,
  onSaved,
  onReload,
}: {
  projectId: string;
  initial: JiraSettings | null;
  onSaved: (settings: JiraSettings) => void;
  onReload: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(!initial || initial.connected === false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false);
  const conflict = error instanceof ApiError && error.status === 409;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || conflict) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      // Credentials never enter the query/mutation cache or browser storage.
      const saved = await api<JiraSettings>(projectPath(projectId, "/integrations/jira"), "PUT", {
        site: String(fields.get("site")).trim(),
        jiraProjectKey: String(fields.get("jiraProjectKey")).trim(),
        issueTypeId: String(fields.get("issueTypeId")).trim(),
        email: String(fields.get("email")).trim(),
        token: String(fields.get("token")),
        revision: initial?.revision ?? 0,
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("Unable to save Jira settings."));
    } finally {
      for (const name of ["email", "token"]) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = "";
        fields.delete(name);
      }
      inFlight.current = false;
      setPending(false);
    }
  }
  if (initial && !editing) {
    return (
      <section className="qa-integration-summary" aria-label="Saved Jira settings">
        <dl>
          <dt>Site URL</dt>
          <dd>{initial.site}</dd>
          <dt>Project key</dt>
          <dd>{initial.jiraProjectKey}</dd>
          <dt>Issue type ID</dt>
          <dd>{initial.issueTypeId}</dd>
        </dl>
        <button type="button" className="qa-button" onClick={() => setEditing(true)}>
          <Pencil size={16} aria-hidden="true" />
          Edit Jira settings
        </button>
      </section>
    );
  }
  return (
    <form
      className="qa-form qa-integration-form"
      onSubmit={(event) => {
        void save(event);
      }}
      autoComplete="off"
    >
      <ErrorNotice error={error} />
      <Field label="Site URL">
        <input
          name="site"
          type="url"
          required
          maxLength={100}
          defaultValue={initial?.site ?? ""}
          placeholder="https://your-team.atlassian.net"
          disabled={pending}
        />
      </Field>
      <div className="qa-form-grid">
        <Field label="Project key">
          <input
            name="jiraProjectKey"
            required
            pattern="[A-Z][A-Z0-9_]{1,19}"
            maxLength={20}
            defaultValue={initial?.jiraProjectKey ?? ""}
            disabled={pending}
          />
        </Field>
        <Field label="Issue type ID">
          <input
            name="issueTypeId"
            required
            pattern="[0-9]+"
            inputMode="numeric"
            maxLength={30}
            defaultValue={initial?.issueTypeId ?? ""}
            disabled={pending}
          />
        </Field>
      </div>
      <Field label="Atlassian email">
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          disabled={pending}
        />
      </Field>
      <Field label="API token">
        <input
          name="token"
          type="password"
          required
          maxLength={12000}
          autoComplete="new-password"
          disabled={pending}
        />
      </Field>
      <div className="qa-form-footer">
        {initial && (
          <button
            type="button"
            className="qa-button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        )}
        {conflict ? (
          <button type="button" className="qa-button" onClick={onReload}>
            <RefreshCw size={16} aria-hidden="true" />
            Reload saved settings
          </button>
        ) : (
          <Submit pending={pending}>{initial ? "Replace settings" : "Save settings"}</Submit>
        )}
      </div>
    </form>
  );
}
