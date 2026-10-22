# Visual baseline candidates

Phase 4 implementation checkpoint, not a completed visual regression workflow.

## Routes

All routes require an authenticated project member.

- `POST /api/v1/projects/:projectId/visual-baselines`: ADMIN/QA submits
  `{ "evidenceId": "...", "label": "Demo catalogue" }`. Only ready PNG
  screenshots from automated runs belonging to this project qualify. Duplicate
  evidence returns 409. Scope cannot be overridden by the request.
- `GET /api/v1/projects/:projectId/visual-baselines`: bounded cursor pagination,
  default 30 and maximum 100. Foreign or missing cursors return 404.
- `POST /api/v1/projects/:projectId/visual-baselines/:baselineId/review`:
  ADMIN/APPROVER submits `{ "status": "APPROVED", "comment": "Reviewed" }`
  or REJECTED. Nonblank comment required, maximum 1000 characters. Reviewer and
  timestamp are server-owned. Only PENDING can transition; competing or repeated
  review attempts return 409 after the first committed decision.

Candidates retain environment, browser, device and check identity from their
automated result. Viewport comes from the current fixed runner configuration:
desktop 1280x900, mobile 390x844. Changing runner viewport settings will require
versioning this mapping or adding capture-time metadata before accepting new
baseline candidates. These dimensions are not inferred from uploaded PNG bytes.
Evidence stays private and uses existing authorized download routes.

Approval records a reviewed candidate; it does not automatically activate it.
`POST /api/v1/projects/:projectId/visual-baselines/:baselineId/activate` accepts
an empty JSON object from ADMIN/APPROVER. Only an approved candidate qualifies.
A serializable transaction replaces the active candidate in the exact project,
environment, browser, device, check and viewport scope. A partial unique index
enforces one active candidate per scope. Conflicting requests may return 409;
refresh before retrying. Repeating activation of the active candidate preserves
its activation timestamp and actor. Other environment scopes remain unchanged.

The workspace supports proposing evidence, inspecting candidates, reviewing and
activating approved candidates. Its browser fixtures remain unverified.
Image comparison execution, persisted diffs and ignore-region persistence remain
pending. No cloud migration or hosted visual verification is claimed.
