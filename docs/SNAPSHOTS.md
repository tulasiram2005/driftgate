# Environment snapshot storage

This Phase 4 checkpoint stores immutable manual imports and server-computed
comparisons, with a comparison workspace. The optional `snapshot` runner check
collects fixed isolated Threadline data and attaches it to a signed result.
An imported snapshot is not verified runner evidence.

## Runner collection

Select `snapshot` when creating an automated run. Successful or flaky results
must contain a validated snapshot; failed results and other check types must not.
The API binds the environment to the run and derives project, creator, run,
browser/device and RUNNER provenance server-side. Result and snapshot persistence
are transactional. Replayed events do not create additional snapshots.
Runner snapshots cannot be updated. Comparisons are marked RUNNER only when
both inputs were runner-collected; any manual input retains MANUAL_IMPORT.

The collector retains the fixed origin, network restrictions and request limit.
Snapshot callback data is limited to 900 KiB, reserving space within the API's
1 MiB body limit for attempts and evidence. Collection failure emits a failed
result without partial snapshot data. No new external-target scanning is enabled.
Cloud migrations and hosted execution of this new check remain unverified.

## API

Comparison creation accepts optional `expectedRules` (maximum 100). Each rule
contains an exact `field`, `productId`, and a nonblank `reason` (maximum 500
characters). Only `productCount` uses a null product ID. Duplicate field/product
rules and unknown fields are rejected. Environment scope is derived from the
selected snapshot pair, never supplied by the caller. Rules are stored with the
comparison and do not change older results. Expected findings remain visible,
retain severity and count toward findingCount. For size/stock fields the current
engine matches all sizes of the exact product; per-size exceptions are not yet
supported. The rule-editing UI and reusable project rule library remain pending.

All routes require a valid bearer session and project membership.

- `POST /api/v1/projects/:projectId/snapshots`: ADMIN or QA only. Body contains
  `label` and `snapshot`. The server sets `source` to `MANUAL_IMPORT`, records
  the importing user's ID and creates the timestamp. These fields cannot be
  supplied by the client. Imports are limited to 20 per minute per IP.
- `GET /api/v1/projects/:projectId/snapshots`: metadata list with `limit`
  (1 to 100, default 30), optional `cursor`, and `nextCursor`. Snapshot payloads
  are excluded from list responses. Cross-project cursors are rejected.
- `GET /api/v1/projects/:projectId/snapshots/:snapshotId`: full snapshot, only
  within the requested project. Missing and cross-project IDs return 404.

The OpenAPI document includes these routes and the import schema. Snapshots use
the existing collector shape: environment, origin, locale, productCount and
products. This first adapter accepts only the fixed isolated Threadline origin
`http://127.0.0.1:3201`, INR and en-IN. It makes no outgoing network requests.
There are no snapshot update or delete routes.

## Bounds and provenance

The API enforces the existing 1 MiB request-body limit, at most 20 products,
100 sizes per product, bounded strings, valid image dimensions/status values,
unique product IDs and case-normalized size labels, and matching product counts.
Unexpected fields are rejected. Prices may preserve formatted display strings;
storage validation alone does not certify their commercial correctness.
Raw metadata must always be rendered as text, never injected as HTML in future UI.

## Migration

Migration `20261021060000_environment_snapshots` adds the project-owned table,
index and environment/source checks. Apply with the existing API `db:migrate`
script before enabling these routes on a deployment. Only the isolated local
test database has been migrated during this checkpoint. Cloud migration is
pending; existing tables and data are not rewritten by this migration.

## Remaining work

Authenticated automated snapshot ingestion,
expected-difference management, comparison screens and visual baseline review
remain pending. Manual imports must remain distinguishable from automated runs.

## Saved comparisons

`POST /api/v1/projects/:projectId/comparisons` accepts only `beforeId` and
`afterId`. Both must reference snapshots within that project with distinct
environments. ADMIN or QA membership is required. The server computes findings
with the same `@driftgate/drift` workspace package used by the runner. Invalid
stored values return 400 without saving a partial comparison. Imports and
comparisons are labelled MANUAL_IMPORT; no automated-verification claim is made.

`GET /api/v1/projects/:projectId/comparisons` lists metadata with bounded cursor
pagination (default 30, maximum 100). `GET` of `/:comparisonId` includes the
immutable findings, source snapshot IDs and creating user. All reads require
membership and are project scoped. No edit/delete routes or expected-difference
overrides are exposed in this checkpoint. Creating comparisons is limited to
20 requests per minute per IP. Findings contain severity and before/after values.

Apply migration `20261021070000_environment_comparisons` after the snapshot
migration before using these endpoints. Cloud migrations remain pending.
