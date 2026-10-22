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

Approval records a reviewed candidate; it does not yet replace or select an
active baseline automatically. Image comparison execution, active-baseline
selection, persisted diffs, ignore-region persistence and review UI remain
pending. No cloud migration or hosted verification is claimed.
