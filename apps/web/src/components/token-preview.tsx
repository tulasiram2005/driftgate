"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Command,
  Contrast,
  Fingerprint,
  Layers3,
  Monitor,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Type,
  X,
  TriangleAlert,
  Clock3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Status = "pass" | "fail" | "warn" | "info" | "flaky";
const statusIcons: Record<Status, LucideIcon> = {
  pass: Check,
  fail: X,
  warn: TriangleAlert,
  info: Clock3,
  flaky: RotateCcw,
};
const sections = [
  { id: "specimens", label: "Specimens", icon: Layers3 },
  { id: "palette", label: "Color tokens", icon: Palette },
  { id: "typography", label: "Typography", icon: Type },
  { id: "foundations", label: "Foundations", icon: Fingerprint },
];
const surfaces = [
  "bg",
  "surface-1",
  "surface-2",
  "surface-3",
  "border",
  "text",
  "text-dim",
  "accent",
] as const;
const statuses: Status[] = ["pass", "fail", "warn", "info", "flaky"];

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function StatusPill({ status, children }: { status: Status; children: React.ReactNode }) {
  const Icon = statusIcons[status];
  return (
    <span className={`status-pill status-${status}`}>
      <Icon size={12} aria-hidden="true" />
      {children}
    </span>
  );
}

function ReadinessRing({ replay }: { replay: number }) {
  const reduced = useReducedMotion();
  return (
    <div className="readiness">
      <div
        className="readiness-chart"
        role="img"
        aria-label="Demo readiness ring: 84 out of 100, illustrative only"
      >
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="68" className="ring-track" />
          {[0, 1, 2, 3, 4].map((segment) => (
            <motion.circle
              key={`${replay}-${segment}`}
              cx="80"
              cy="80"
              r="68"
              className={`ring-segment ring-segment-${segment}`}
              strokeDasharray="73 428"
              transform={`rotate(${segment * 72 - 90} 80 80)`}
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : segment * 0.08 }}
            />
          ))}
        </svg>
        <div className="ring-value">
          <span>84</span>
          <small>/ 100</small>
        </div>
      </div>
      <div>
        <div className="eyebrow">
          Readiness ring <span className="demo-label">Demo</span>
        </div>
        <h3>A measured decision.</h3>
        <p className="muted">Five criteria. One release gate.</p>
        <StatusPill status="warn">Review required</StatusPill>
      </div>
    </div>
  );
}

export function TokenPreview() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.dataset.theme ?? "dark",
    () => "dark",
  );
  const [replay, setReplay] = useState(0);
  const [query, setQuery] = useState("");
  const [comparison, setComparison] = useState(50);
  const paletteRef = useRef<HTMLDialogElement>(null);
  const evidenceRef = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (paletteRef.current?.open) paletteRef.current.close();
        else {
          setQuery("");
          paletteRef.current?.showModal();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("driftgate-theme", next);
    } catch {
      /* Theme remains usable when storage is unavailable. */
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <a className="wordmark" href="#main" aria-label="DriftGate home">
          <span className="brand-icon">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          DriftGate
          <span className="wordmark-divider" />
        </a>
        <span className="header-context">
          Design system <ChevronRight size={12} aria-hidden="true" />
          <span>Phase 0</span>
        </span>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Open command palette"
            title="Open command palette"
            onClick={() => {
              setQuery("");
              paletteRef.current?.showModal();
            }}
          >
            <Command size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-top">
            <span className="eyebrow">The reference</span>
            <nav aria-label="Design system">
              {sections.map(({ id, label, icon: Icon }) => (
                <a key={id} href={`#${id}`}>
                  <Icon size={16} aria-hidden="true" />
                  {label}
                  <span className="nav-index">
                    0{sections.findIndex((section) => section.id === id) + 1}
                  </span>
                </a>
              ))}
            </nav>
          </div>
          <div className="sidebar-footer">
            <span className="edition">DG / 001</span>
            <p>Ink and Signal</p>
            <span className="muted">A release, considered.</span>
          </div>
        </aside>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="signal-tick" />
                Foundation / 001
              </div>
              <h1>
                Ink and Signal<span className="heading-period">.</span>
              </h1>
              <p className="page-description">The visual language of a considered release.</p>
            </div>
            <div className="edition-note">
              <span className="demo-label">Phase 0 preview</span>
              <p>
                Design specimens only.
                <br />
                No QA checks have been run.
              </p>
            </div>
          </div>
          <section id="specimens" className="section" aria-labelledby="specimen-title">
            <div className="section-heading">
              <h2 id="specimen-title">
                <span className="section-number">01</span>In context
              </h2>
              <button
                className="text-button"
                type="button"
                onClick={() => setReplay((value) => value + 1)}
              >
                <Play size={14} aria-hidden="true" />
                Replay motion
              </button>
            </div>
            <div className="specimen-label">
              <span>
                <span className="demo-label">Demo</span>Threadline / Spring essentials
              </span>
              <span className="mono muted">RELEASE SPECIMENS</span>
            </div>
            <div className="overview-band">
              <ReadinessRing replay={replay} />
              <div className="runway-block">
                <div className="label-row">
                  <h3>Gate runway</h3>
                  <span className="mono muted">02 / 04</span>
                </div>
                <ol className="gate-runway">
                  {["Staging", "UAT", "Pre-prod", "Production"].map((gate, index) => (
                    <li key={gate} className={index < 2 ? "gate-complete" : "gate-pending"}>
                      <span className="gate-node">
                        {index < 2 ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <Circle size={12} aria-hidden="true" />
                        )}
                      </span>
                      <span>{gate}</span>
                      <small>{index < 2 ? "Demo passed" : "Pending"}</small>
                    </li>
                  ))}
                </ol>
                <div className="specimen-footnote">
                  <TriangleAlert size={14} aria-hidden="true" />
                  <span>Sample states only. No sign-off recorded.</span>
                </div>
              </div>
            </div>
            <div className="specimen-grid">
              <div className="matrix-block">
                <div className="label-row">
                  <h3>Device matrix</h3>
                  <span className="demo-label">Demo</span>
                </div>
                <table className="matrix-table">
                  <caption className="sr-only">Demo device results, not executed tests</caption>
                  <thead>
                    <tr>
                      <th scope="col">Viewport</th>
                      <th scope="col">Chromium</th>
                      <th scope="col">Firefox</th>
                      <th scope="col">WebKit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { icon: Monitor, name: "Desktop", values: ["pass", "pass", "flaky"] },
                      { icon: Smartphone, name: "Mobile", values: ["pass", "fail", "warn"] },
                    ].map(({ icon: Icon, name, values }, row) => (
                      <tr key={name}>
                        <th scope="row">
                          <span className="device-label">
                            <Icon size={14} aria-hidden="true" />
                            {name}
                          </span>
                        </th>
                        {values.map((status, col) => {
                          const typed = status as Status;
                          const CellIcon = statusIcons[typed];
                          return (
                            <td key={col}>
                              <motion.span
                                key={`${replay}-${row}-${col}`}
                                className={`matrix-cell status-${typed}`}
                                initial={{ opacity: reduced ? 1 : 0 }}
                                animate={{ opacity: 1 }}
                                transition={{
                                  duration: reduced ? 0 : 0.2,
                                  delay: reduced ? 0 : (row * 3 + col) * 0.008,
                                }}
                              >
                                <CellIcon size={16} aria-hidden="true" />
                                <span className="sr-only">Demo {status}</span>
                              </motion.span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="drift-block">
                <div className="label-row">
                  <h3>Drift comparison</h3>
                  <span className="demo-label">Demo</span>
                </div>
                <table className="drift-table">
                  <caption className="sr-only">
                    Demonstration price comparison, not a real finding
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Attribute</th>
                      <th scope="col">Staging</th>
                      <th scope="col">Production</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">
                        Linen shirt<span className="muted row-detail">Unit price / INR</span>
                      </th>
                      <td className="mono">2,490</td>
                      <td className="mono">
                        <span className="diff-value">2,690</span>
                        <span className="row-detail fail-text">+200 demo</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button
                  type="button"
                  className="text-button evidence-button"
                  onClick={() => evidenceRef.current?.showModal()}
                >
                  Inspect specimen
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
          <section id="palette" className="section" aria-labelledby="color-title">
            <div className="section-heading">
              <h2 id="color-title">
                <span className="section-number">02</span>Color tokens
              </h2>
              <span className="theme-label">
                <Contrast size={14} aria-hidden="true" />
                {theme === "dark" ? "Ink / dark" : "Paper / light"}
              </span>
            </div>
            <div className="swatch-grid">
              {surfaces.map((token) => (
                <div className="swatch-item" key={token}>
                  <div className="swatch" style={{ background: `var(--${token})` }} />
                  <span className="mono">{token}</span>
                  <span className="swatch-role muted">
                    {
                      {
                        bg: "Canvas",
                        "surface-1": "Base",
                        "surface-2": "Raised",
                        "surface-3": "Active",
                        border: "Hairline",
                        text: "Primary",
                        "text-dim": "Secondary",
                        accent: "Signal",
                      }[token]
                    }
                  </span>
                </div>
              ))}
            </div>
            <div className="status-reference">
              <div>
                <h3>Status vocabulary</h3>
                <p className="muted">Color carries meaning. A label confirms it.</p>
              </div>
              <div className="status-list">
                {statuses.map((status) => (
                  <StatusPill key={status} status={status}>
                    {
                      {
                        pass: "Passed",
                        fail: "Failed",
                        warn: "Blocked",
                        info: "Queued",
                        flaky: "Flaky",
                      }[status]
                    }
                  </StatusPill>
                ))}
              </div>
            </div>
          </section>
          <section id="typography" className="section" aria-labelledby="type-title">
            <div className="section-heading">
              <h2 id="type-title">
                <span className="section-number">03</span>Typography
              </h2>
              <span className="mono muted">THREE VOICES. ONE SYSTEM.</span>
            </div>
            <div className="type-grid">
              <div className="type-specimen">
                <span className="eyebrow">Display / Instrument Serif</span>
                <p className="display-sample">
                  Ready for
                  <br />
                  <em>what comes next.</em>
                </p>
                <span className="mono muted">28 / 40 / 64</span>
              </div>
              <div className="type-specimen">
                <span className="eyebrow">Interface / Hanken Grotesk</span>
                <p className="ui-sample">
                  Clarity at
                  <br />
                  every checkpoint.
                </p>
                <span className="mono muted">12 / 14 / 16 / 20</span>
              </div>
              <div className="type-specimen">
                <span className="eyebrow">Data / JetBrains Mono</span>
                <p className="data-sample">
                  Aa Bb 0123
                  <br />
                  DG-0042
                  <br />
                  <span className="muted">09:41:08 UTC</span>
                </p>
                <span className="mono muted">TABULAR / PRECISE</span>
              </div>
            </div>
          </section>
          <section id="foundations" className="section" aria-labelledby="foundation-title">
            <div className="section-heading">
              <h2 id="foundation-title">
                <span className="section-number">04</span>Foundations
              </h2>
              <span className="mono muted">MEASURED, NOT DECORATED</span>
            </div>
            <div className="foundation-grid">
              <div>
                <h3>Space</h3>
                <div className="spacing-scale">
                  {[4, 8, 12, 16, 24, 32].map((value) => (
                    <div key={value}>
                      <span style={{ height: value }} />
                      <small className="mono">{value}</small>
                    </div>
                  ))}
                </div>
                <p className="muted">A four-pixel rhythm.</p>
              </div>
              <div>
                <h3>Shape</h3>
                <div className="radius-samples">
                  <span className="radius-control mono">6</span>
                  <span className="radius-dialog mono">12</span>
                </div>
                <p className="muted">Controls / dialogs.</p>
              </div>
              <div>
                <h3>Motion</h3>
                <div className="motion-times mono">
                  <span>
                    120<small>FAST</small>
                  </span>
                  <span>
                    200<small>BASE</small>
                  </span>
                  <span>
                    320<small>SLOW</small>
                  </span>
                </div>
                <p className="muted">Milliseconds. Reduced motion respected.</p>
              </div>
              <div>
                <h3>Action</h3>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    paletteRef.current?.showModal();
                  }}
                >
                  <Search size={16} aria-hidden="true" />
                  Find a token
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <p className="muted">One accent. A clear next step.</p>
              </div>
            </div>
          </section>
          <footer className="page-footer">
            <span>
              <CheckCheck size={14} aria-hidden="true" />
              DriftGate / Ink and Signal
            </span>
            <a href="#main">
              Back to top
              <ArrowDown className="arrow-up" size={14} aria-hidden="true" />
            </a>
          </footer>
        </main>
      </div>
      <dialog className="command-dialog" ref={paletteRef} aria-labelledby="command-title">
        <div className="dialog-heading">
          <h2 id="command-title">Find a section</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close command palette"
            title="Close command palette"
            onClick={() => paletteRef.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search sections</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections"
          />
        </label>
        <nav aria-label="Search results" className="command-results">
          {sections
            .filter((section) => section.label.toLowerCase().includes(query.toLowerCase()))
            .map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => {
                  paletteRef.current?.close();
                  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            ))}
        </nav>
        {!sections.some((section) => section.label.toLowerCase().includes(query.toLowerCase())) && (
          <p role="status" className="empty-search">
            No matching sections.
          </p>
        )}
      </dialog>
      <dialog className="evidence-dialog" ref={evidenceRef} aria-labelledby="evidence-title">
        <div className="dialog-heading">
          <div>
            <span className="demo-label">Synthetic demo</span>
            <h2 id="evidence-title">Evidence specimen</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close evidence specimen"
            title="Close evidence specimen"
            onClick={() => evidenceRef.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="muted">
          Illustrative price states. These are not captured storefront screenshots.
        </p>
        <div className="comparison-frame">
          <div className="comparison-image comparison-after">
            <span className="eyebrow">Production / demo</span>
            <ShirtIllustration />
            <strong>Linen shirt</strong>
            <span className="mono">INR 2,690</span>
          </div>
          <div
            className="comparison-image comparison-before"
            style={{ clipPath: `inset(0 ${100 - comparison}% 0 0)` }}
            aria-hidden="true"
          >
            <span className="eyebrow">Staging / demo</span>
            <ShirtIllustration />
            <strong>Linen shirt</strong>
            <span className="mono">INR 2,490</span>
          </div>
          <div className="comparison-divider" style={{ left: `${comparison}%` }} />
        </div>
        <label className="comparison-label" htmlFor="comparison">
          Comparison position <span className="mono">{comparison}% staging</span>
        </label>
        <input
          id="comparison"
          type="range"
          min="0"
          max="100"
          value={comparison}
          onChange={(event) => setComparison(Number(event.target.value))}
        />
        <p className="muted">Trace capture belongs to a later phase.</p>
      </dialog>
    </MotionConfig>
  );
}

function ShirtIllustration() {
  return (
    <svg
      viewBox="0 0 200 180"
      className="shirt-illustration"
      role="img"
      aria-label="Line drawing of a sample shirt"
    >
      <path d="M72 24 44 36 16 72 42 94 55 80 55 156 145 156 145 80 158 94 184 72 156 36 128 24 116 44 100 34 84 44Z" />
      <path d="m72 24 28 10 28-10M100 34v122M55 80V53m90 27V53M112 61h19v22h-19z" />
      <circle cx="104" cy="58" r="1" />
      <circle cx="104" cy="83" r="1" />
      <circle cx="104" cy="108" r="1" />
      <circle cx="104" cy="133" r="1" />
    </svg>
  );
}
