# Remaining delivery work

## Current state (2026-11-27)

Seven of eight phases are complete. Phase 7 covers the hosted deployment and
end-to-end demo. Phase 6 closed after browser, accessibility, screenshot and
response-time verification. See the [phase status](STATUS.md) and
[measurements](METRICS.md).

The public web app, Render API and four Threadline storefront environments are live.
Hosted SQL checks passed for all four environments. DriftGate exported the seeded UAT
shirt-price discrepancy to KAN-2 and synced its To Do status. The clean staging
runner completed six checks on main. Its separate snapshot check reached the request
limit while prefetching product pages. The release candidate skips speculative
fetches and waits for product cards before accessibility and link checks.
The remaining release check is to verify the candidate through the deployed workflow.

### Historical checkpoint before Phase 5 closure

Verification checkpoint: 2026-10-25, local release sign-off implementation.
Update: run 40215957794 passed all browser/fixture steps (66 web and 24 demo
tests), including release creation/download and defect-board interaction. Its
final dependency audit failed; patched dependencies pass local API/web tests,
typecheck and audit, with a full CI rerun required. Browser-pending notes below
remain applicable to untested live integrations and the new dependency revision.
This is the consolidated roadmap;
older entries in STATUS.md are historical, not a current pending-work list.

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

## Phase 6: product polish (closed 2026-11-25)

The four acceptance groups below record the original scope. The [exit review](METRICS.md#phase-6-exit-review-2026-11-25) records the completed checks.

1. Finish dashboard visual review: recent activity passed all CI checks in 40257270679. Its latest screenshots still need review. Defect summaries, saved
   releases and on-demand readiness are implemented and browser-tested.
2. Complete application-wide light/dark screenshot and keyboard review across
   projects/cases, runs, comparisons/baselines, SQL, defects, releases and Jira.
   Existing browser coverage is substantial but not a completed manual review.
   Validate the latest readiness layout and refresh-recovery regression.
3. Finish workflow and report polish: review context preservation, lost edits,
   duplicate submissions and failure recovery. PDF typography now embeds Noto
   Sans and has an inspected eight-page sample; font-revision CI is pending.
   Unsupported scripts/emoji still use explicit escapes, with that limit disclosed.
4. Measure core workflow response times, record remaining limitations, and run
   the final quality gates on one fixed revision before closing Phase 6.

Phase 7 starts after these four acceptance groups are complete and evidenced.
No elapsed-time estimate has been validated; CI duration alone is not the time
needed to finish the implementation and review work.

Phase 6 is required by the latest user instruction. See POLISH_CHECKLIST.md.
Basic accessibility and correct error handling remain requirements in every phase.

## Phase 7: deployment and final demonstration

- Deploy/update the final application revision. All 24 hosted DriftGate migrations were verified on 2026-11-25.
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
