# Remaining delivery work

Current verification checkpoint: 2026-10-24, following code revision 6730f9d.
This is the consolidated roadmap;
older entries in STATUS.md are historical, not a current pending-work list.

## Phase count

There are eight phases, numbered 0 through 7. Phases 0-4 are recorded complete
within the approved MVP scope. Phase 5 is in progress. The user has explicitly
requested every phase and a highly polished result: Phase 6 must not be skipped.
Three phases remain unfinished: finish 5, complete 6, then complete 7.
The MVP is an intermediate milestone, not the final delivery.

## Phase 5: remaining implementation and verification

- Defects: board remains pending. Creation, list/detail, project-wide search and
  filters, aging and mean-time-to-closure metrics, reproduction snapshots,
  role-restricted transitions and event history are built. Hosted browser checks
  passed in Quality Gates 39998074072; final product polish remains Phase 6 work.
- Jira Cloud: encrypted settings, access checks, duplicate-resistant export,
  saved ticket links and manual status sync are implemented. Live local export
  and sync passed with synthetic ticket KAN-1. Bounded opt-in scheduled polling is
  implemented and locally tested. Remaining: live scheduled-polling verification,
  reconciliation/disconnect browser verification, hosted migration and
  hosted verification. Evidence files are not uploaded to Jira. A connected
  assistant plugin is not application integration.
  REVIEW_REQUIRED and stale PENDING reconciliation have an admin-only tested API and recovery dialog
  with exact defect reference validation and a transactional audit event; browser
  and live recovery are unverified.
- Releases: saved-release UI and environment gate run selection are built,
  including persistence and same-project/environment validation. New browser
  checks and screenshot review remain pending.
- Readiness: API/UI now collect selected runs, high-priority case versions and
  project defects, preserving source dates and rejecting missing/changed runs.
  Drift comparison collection is implemented. Visual-review and accessibility collectors remain pending. The partial
  collector cannot pass a gate. Browser verification remains pending.
- Gates: enforce exit criteria and environment sequence. Saving a run binding
  is not equivalent to passing or approving a gate.
- Sign-off: named Approver authorization, required comment/timestamp, evidence
  binding, stale-approval detection, concurrent-write protection, hash-chained
  audit persistence and chain-verification API/screen.
- Reports: export the release PDF with readiness, evidence, defects, exclusions
  and sign-off/audit details, using the established design tokens.
- Verification: tests for these workflows and failure cases, browser screenshots
  at all four widths, accessibility/role checks, CI and documentation. Review the
  existing defect-screen screenshots from successful hosted CI.

Notifications, AI assistance and performance budgets remain excluded from MVP.
No complete Phase 5 or production-readiness claim is justified yet.

## Phase 6: required product polish

- Dashboard summaries connected to actual project/release data.
- Motion and reduced-motion polish.
- Application-wide accessibility, keyboard navigation, responsive layout and
  empty/loading/error/recovery-state review.

Phase 6 is required by the latest user instruction. See POLISH_CHECKLIST.md.
Basic accessibility and correct error handling remain requirements in every phase.

## Phase 7: deployment and final demonstration

- Deploy/update all required services and apply outstanding application migrations.
  Some infrastructure already exists; that does not establish whole-app completion.
- Set up the separate hosted Threadline database, a restricted read-only SQL role
  and project binding, then verify live SQL execution through the hosted API.
- Verify GitHub execution, callbacks, private evidence access and expiry against
  the final application revision, including failure paths.
- Resolve worker availability within free-only limits. The temporary computer
  worker is stopped; do not imply jobs will process continuously without a worker.
- Verify actual Jira integration with the selected site/project and minimal access.
- Run the full deliberately seeded bug-bank demonstration and publish measured
  detection results rather than estimates or a promised zero-bug result.
- Finish screenshots, README, architecture/ER/API docs, operational runbook,
  deployment/rollback/secret-rotation instructions and five-minute demo script.
- Confirm public repository access, working reviewer URLs and documented free-tier
  cold-start/availability limits. The user records the final video.

## User input

No action is required for local implementation now. The user has configured Jira
privately and the local happy path is verified; never paste tokens into chat.
Before final deployment, agree on a free-only worker
operating model and any account-level consent that tools cannot complete.
