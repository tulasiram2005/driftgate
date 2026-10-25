"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Check, Inbox, Moon, RefreshCw, Sun, X } from "lucide-react";
import type { FieldValues, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { api, type ResultStatus } from "../../lib/qa-api";

export function schemaResolver<T extends FieldValues>(schema: z.ZodType<T, T>): Resolver<T> {
  return zodResolver(schema);
}

export function useWrite<T = unknown>(projectId: string, onSuccess?: (data: T) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => api<T>(path, method, body),
    onSuccess: async (data) => {
      await client.invalidateQueries({ queryKey: ["project", projectId] });
      await client.invalidateQueries({ queryKey: ["projects"] });
      onSuccess?.(data);
    },
  });
}

export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: (() => void) | undefined;
}) {
  if (!error) return null;
  return (
    <div className="qa-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>
        {error instanceof Error ? error.message : "Something went wrong. Please try again."}
      </span>
      {retry && (
        <button type="button" className="qa-button" onClick={retry}>
          <RefreshCw size={16} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export function Loading({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="qa-loading" role="status">
      <RefreshCw size={18} aria-hidden="true" />
      {label}...
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="qa-empty">
      <Inbox size={28} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="qa-field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>(
          child,
        ) &&
        typeof child.type === "string" &&
        ["input", "textarea", "select"].includes(child.type)
          ? cloneElement(child, {
              id,
              "aria-invalid": Boolean(error),
              ...(error ? { "aria-describedby": `${id}-error` } : {}),
            })
          : child,
      )}
      {error && (
        <span id={`${id}-error`} role="alert" className="qa-field-error">
          {error}
        </span>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="qa-modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="qa-modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="Close dialog"
          title="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Submit({ pending, children = "Save" }: { pending: boolean; children?: ReactNode }) {
  return (
    <button className="qa-button qa-primary" type="submit" disabled={pending}>
      {pending ? (
        <RefreshCw size={16} aria-hidden="true" />
      ) : (
        <Check size={16} aria-hidden="true" />
      )}
      {pending ? "Saving..." : children}
    </button>
  );
}

export function SectionHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="qa-section-heading">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="qa-actions">{children}</div>
    </div>
  );
}

export function OpenButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="qa-link" type="button" onClick={onClick}>
      {children}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

export function Status({ status }: { status: ResultStatus }) {
  const style = {
    PASS: "pass",
    FAIL: "fail",
    BLOCKED: "warn",
    SKIPPED: "info",
    NOT_RUN: "neutral",
  }[status];
  return <span className={`status-pill status-${style}`}>{status.replaceAll("_", " ")}</span>;
}

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeButton() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.dataset.theme,
    () => "dark",
  );
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("driftgate-theme", next);
        } catch {
          /* Theme remains available without storage. */
        }
      }}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
