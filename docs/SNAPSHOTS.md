# Environment snapshot storage

This Phase 4 checkpoint stores immutable manual imports. It does not yet
automatically attach collector output to a run, calculate saved comparisons or
provide a comparison screen. An imported snapshot is not verified runner evidence.

## API

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

Authenticated automated snapshot ingestion, saved comparison computation,
expected-difference management, comparison screens and visual baseline review
remain pending. Manual imports must remain distinguishable from automated runs.
