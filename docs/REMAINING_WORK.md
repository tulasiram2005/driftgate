# Remaining delivery work

## Current state: 2026-10-26

Phase 5 MVP is closed: see PHASE5_EXIT.md. Phase 6 is active, starting with a
real-data overview using project-wide defect metrics and a bounded release list.
Overview browser checks passed in runs 40223355251 and 40255495102, including
light/dark accessibility and keyboard recovery. Dark overview screenshots were
reviewed at four widths. Later readiness layout/recovery changes await CI.
Two phases remain: Phase 6 product polish and Phase 7 deployment/demo. The older
Phase 5 implementation checklist below is retained as history; hosted migrations,
continuous worker operation and live recovery/disconnect checks belong to Phase 7.

### Historical checkpoint before Phase 5 closure

Verification checkpoint: 2026-10-25, local release sign-off implementation.
Update: run 40215957794 passed all browser/fixture steps (66 web and 24 demo
tests), including release creation/download and defect-board interaction. Its
final dependency audit failed; patched dependencies pass local API/web tests,
typecheck and audit, with a full CI rerun required. Browser-pending notes below
remain applicable to untested live integrations and the new dependency revision.
This is the consolidated roadmap;
older entries in STATUS.md are historical, not a current pending-work list.

## Phase count

There are eight phases, numbered 0 through 7. Phases 0-4 are recorded complete
within the approved MVP scope. Phase 5 MVP is closed. The user has explicitly
requested every phase and a highly polished result: Phase 6 must not be skipped.
Two phases remain unfinished: complete 6, then complete 7.
The MVP is an intermediate milestone, not the final delivery.

## Historical Phase 5 checklist (superseded by PHASE5_EXIT.md)

- Defects: status board is implemented with list/board switching, shared filters,
  loaded-result counts and accessible card navigation to the existing transition
  form. New browser verification is pending. Creation, list/detail, project-wide search and
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
  Drift, visual comparison and automated accessibility collectors are implemented.
  Admin/Approver acceptance of visual differences is implemented; zero-difference
  comparisons require approved active baselines. Browser verification remains pending.
- Gates: exit criteria and environment sequence are implemented and tested.
  Saving a run binding is not equivalent to passing or approving a gate.
- Sign-off: named Approver authorization, required comment/timestamp, evidence
  binding, stale-approval detection, concurrent-write protection, hash-chained
  history and chain-verification API/screen are implemented. Local test and demo
  migration applied. Browser screenshots, hosted migration and CI verification
  remain pending. Audit hashes detect altered/deleted records against the stored
  count; they do not protect against an administrator rewriting the entire database.
- Reports: authenticated PDF export is implemented with readiness, evidence
  references, project defects, exclusions and sign-off/audit details from one
  database snapshot. Synthetic populated report rendered and inspected locally.
  Browser download and hosted verification remain pending. Non-ASCII text is
  preserved as explicit Unicode escapes with portable fonts; native multilingual
  typography remains a Phase 6 polish item.
- Verification: tests for these workflows and failure cases, browser screenshots
  at all four widths, accessibility/role checks, CI and documentation. Review the
  existing defect-screen screenshots from successful hosted CI.

Notifications, AI assistance and performance budgets remain excluded from MVP.
The above list records pre-closure gaps. PHASE5_EXIT.md records the completed MVP
verification and the operational work explicitly assigned to Phase 7.

## Phase 6: required product polish

1. Finish dashboard scope: recent activity is still missing. Defect summaries,
   saved releases and on-demand readiness are implemented and tested.
2. Complete application-wide light/dark screenshot and keyboard review across
   projects/cases, runs, comparisons/baselines, SQL, defects, releases and Jira.
   Existing browser coverage is substantial but not a completed manual review.
   Validate the latest readiness layout and refresh-recovery regression.
3. Finish workflow and report polish: review context preservation, lost edits,
   duplicate submissions and failure recovery; resolve native multilingual PDF
   typography instead of treating Unicode escape output as finished polish.
4. Measure core workflow response times, record remaining limitations, and run
   the final quality gates on one fixed revision before closing Phase 6.

Phase 7 starts after these four acceptance groups are complete and evidenced.
No elapsed-time estimate has been validated; CI duration alone is not the time
needed to finish the implementation and review work.

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
