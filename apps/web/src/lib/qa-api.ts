"use client";

import { consumeEvents, type RunEvent } from "./run-stream";

export type Role = "ADMIN" | "QA" | "DEVELOPER" | "APPROVER";
export type User = { id: string; name: string; email: string };
export type Session = { accessToken: string; user: User };
export type Project = { id: string; name: string; description?: string; role: Role };
export type Requirement = { id: string; title: string; description: string };
export type Step = { action: string; expected: string };
export type TestCase = {
  id: string;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "MANUAL" | "AUTOMATED";
  tags: string[];
  requirementId: string | null;
  version: number;
  steps: Step[];
};
export type Suite = { id: string; name: string; caseIds: string[] };
export const resultStatuses = ["NOT_RUN", "PASS", "FAIL", "BLOCKED", "SKIPPED"] as const;
export type ResultStatus = (typeof resultStatuses)[number];
export type RunResult = {
  id: string;
  caseId: string;
  title: string;
  version: number;
  steps: Step[];
  status: ResultStatus;
  notes: string;
};
export type Run = {
  id: string;
  environment: "STAGING" | "UAT" | "PREPROD" | "PROD";
  browser: string;
  device: string;
  suiteId: string;
  createdAt: string;
  results: RunResult[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// This module is client-only. Neither token is persisted in browser storage.
let accessToken: string | null = null;
let refreshRequest: Promise<User | null> | null = null;

async function readEnvelope<T>(
  response: Response,
): Promise<{ data: T; nextCursor?: string | null }> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? `Request failed (${response.status}). Please try again.`,
    );
  }
  return body as { data: T; nextCursor?: string | null };
}

async function readData<T>(response: Response): Promise<T> {
  return (await readEnvelope<T>(response)).data;
}

export function acceptSession(session: Session) {
  accessToken = session.accessToken;
  return session.user;
}

export function forgetSession() {
  accessToken = null;
}

export function refreshSession(): Promise<User | null> {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        forgetSession();
        return null;
      }
      return acceptSession(await readData<Session>(response));
    })().finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

export async function authenticate(path: "login" | "register", body: unknown) {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return acceptSession(await readData<Session>(response));
}

async function authorizedFetch(path: string, init: RequestInit = {}) {
  const tokenUsed = accessToken;
  const send = () =>
    fetch(`/api/v1${path}`, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  let response = await send();
  if (response.status === 401) {
    // A sibling request may already have refreshed this token.
    if (tokenUsed === accessToken && !(await refreshSession())) {
      window.dispatchEvent(new Event("driftgate:unauthorized"));
      throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in.");
    }
    response = await send();
    if (response.status === 401) {
      forgetSession();
      window.dispatchEvent(new Event("driftgate:unauthorized"));
    }
  }
  return response;
}

export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await authorizedFetch(path, {
    method,
    ...(headers ? { headers } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (response.ok && response.status === 204) return undefined as T;
  return readData<T>(response);
}

export async function page<T>(path: string, cursor?: string | null) {
  const separator = path.includes("?") ? "&" : "?";
  return readEnvelope<T[]>(
    await authorizedFetch(
      `${path}${separator}limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  );
}

export async function list<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null | undefined;
  const visited = new Set<string>();
  do {
    const separator = path.includes("?") ? "&" : "?";
    const response = await authorizedFetch(
      `${path}${separator}limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    const page = await readEnvelope<T[]>(response);
    rows.push(...page.data);
    cursor = page.nextCursor;
    if (cursor && visited.has(cursor))
      throw new Error("The server returned a repeated page. Please retry.");
    if (cursor) visited.add(cursor);
  } while (cursor);
  return rows;
}

export async function exportCases(projectId: string) {
  const response = await authorizedFetch(`/projects/${projectId}/cases.csv`);
  if (!response.ok) await readData(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "driftgate-test-cases.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function projectPath(projectId: string, suffix = "") {
  return `/projects/${encodeURIComponent(projectId)}${suffix}`;
}

export async function runEvents(
  path: string,
  signal: AbortSignal,
  lastEventId: string,
  receive: (event: RunEvent) => void,
) {
  const response = await authorizedFetch(path, {
    signal,
    headers: {
      Accept: "text/event-stream",
      ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
    },
  });
  if (!response.ok) await readData(response);
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream"))
    throw new Error("Live results are temporarily unavailable.");
  await consumeEvents(response.body, receive);
}
