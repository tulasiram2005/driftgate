# Phase 6 product polish acceptance checklist

Required by the user's full-phase delivery request. This is planned work, not
completed verification. Retain Ink and Signal and the existing application stack.

## Product presentation

- Real-data project dashboard with clear release readiness, blockers and recent
  activity. Do not substitute decorative charts or invented metrics.
- Consistent typography hierarchy, spacing, alignment and semantic status colors
  across projects, tests, runs, defects, releases, integrations and reports.
- Dense, readable work surfaces rather than marketing heroes or nested cards.
- Intentional light/dark themes with verified rendered contrast and visible focus.

## Workflow quality

- Predictable navigation, back actions and preservation of useful list context.
- Search/filter states distinguish all records from the current page of results.
- Clear loading, empty, error, retry, stale-data and permission-denied states.
- Prevent duplicate submissions and accidental lost edits. Handle conflicts with
  actionable recovery without discarding user text unnecessarily.
- Evidence views and long defect details remain readable at narrow widths.

## Motion and responsiveness

- Restrained transitions that communicate state without delaying repeated actions.
- Respect reduced motion. No layout shift caused by loading labels or icons.
- Review screenshots at 360, 768, 1280 and 1920 pixels for all primary workflows.
- No unintended horizontal overflow, clipped controls or overlapping text.
  Wide data tables may scroll inside clearly bounded containers.

## Verification evidence

- Keyboard-only checks, automated accessibility checks and manual focus review.
- Chromium, Firefox and WebKit coverage; distinguish emulation from real devices.
- Inspect screenshots, not only test exit codes, in light and dark themes.
- Measure core workflow response times and identify free-tier cold-start limits.
  Do not promise instant responses or use fake delays to conceal backend failures.
- Record defects found, fixes, executed checks and remaining limitations in METRICS.
- Phase exit requires green checks and reviewed evidence, not a claim of zero bugs.
