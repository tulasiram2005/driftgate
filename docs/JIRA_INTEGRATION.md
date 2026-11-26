# Jira integration status

The Jira software project is DriftGate (KAN), board 2:
https://ramtulasi062005.atlassian.net/jira/software/projects/KAN/boards/2

## Implemented locally

- Offline encryption-key rotation supports dry-run checks and atomic apply.
  See [the operator runbook](JIRA_KEY_ROTATION.md). It requires maintenance;
  changing an environment key alone does not re-encrypt saved credentials.

- Admin-only `POST /api/v1/projects/:projectId/integrations/jira/disconnect`
  takes `{ "revision": 1 }`. It clears encrypted credentials and sets connected
  false while incrementing revision and recording DISCONNECTED. Existing ticket
  links, snapshots and audit events remain. New operations stop; already-sent
  requests cannot be recalled. It does not revoke the token at Atlassian.
  Reconnect via the settings form with fresh credentials and the retained revision.
  Apply migration 20261025020000_jira_disconnect before deploying this version.

- Optional worker polling: `JIRA_POLLING_ENABLED=1` enables bounded read-only
  status checks. Default is `0`. Apply migration 20261025010000_jira_polling before
  deploying this code. The worker needs the same persistent encryption key and
  database as the API, plus its existing Redis/runner configuration. Never
  generate a replacement encryption key for existing credentials.
  Up to five due links are checked per minute, each successful link at most once
  per 15 minutes. Errors back off up to six hours; pollError contains only a safe
  code. Leases expire after 60 seconds if a worker stops. Polling does not export
  tickets, reconcile uncertain exports, or change QA decisions. Status refresh
  stops when the worker is off. This option has not been enabled or live-tested.

- Admin-only `POST /api/v1/projects/:projectId/defects/:defectId/jira/reconcile`
  accepts `{ "revision": 0, "issueKey": "KAN-123" }`. Revision is syncRevision.
  REVIEW_REQUIRED exports and PENDING exports at least five minutes old qualify.
  Age is checked server-side; GET returns canReconcile for the UI, refreshed by
  Refresh status. The server reads the candidate ticket
  from the original configured site/project and verifies the exact first-line
  DriftGate defect reference in its plain-text ADF description. Edited/incompatible
  descriptions fail closed. This is provenance checking, not a cryptographic proof.
  Success atomically saves LINKED, status, incremented revision and an administrator
  integration-audit event. Concurrent attempts cannot replace a recovered link.
  No remote issue is created, no automatic retry occurs and QA history is untouched.
  Late completion of the original export cannot overwrite a recovered record.
  The admin-only recovery dialog is implemented; browser verification remains pending.

- Admin-only `POST /api/v1/projects/:projectId/defects/:defectId/jira/sync`
  accepts `{ "revision": 0 }`, using the export record's `syncRevision` (not the
  defect revision). Requires a confirmed link and matching configured Jira target.
  Saves Jira status ID/name/category and statusSyncedAt. Concurrent saves reject
  stale revisions. Network errors leave the previous snapshot unchanged.
  This is manual sync, not automatic polling, and never changes QA approval.

- Admin-only `POST /api/v1/projects/:projectId/defects/:defectId/jira` takes the
  defect revision. Member-readable GET returns the export record. A unique durable
  reservation precedes the external create, so repeats never create again. The
  target site/revision are retained with the link even after integration changes.
- Failed or uncertain exports are marked REVIEW_REQUIRED without automatic retry.
  Process interruption can leave PENDING; verified recovery is allowed after five minutes.
  REVIEW_REQUIRED has a reconciliation API and admin dialog. No exactly-once delivery
  claim is made. UI requires export confirmation.
- `POST /api/v1/projects/:projectId/integrations/jira/verify` accepts the saved
  revision and is admin-only. Checks active identity, configured project/type,
  and browse/create permissions with read-only requests. A successful timestamped
  result is a point-in-time access check, not an issue creation guarantee. Custom
  required fields can still prevent export. No persistent verification flag exists.
- Reference: [Jira project details](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-projectidorkey-get)
  and [project-scoped permissions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-permissions/#api-rest-api-3-mypermissions-get).
- Project-admin Integrations screen loads public metadata, saves full replacement
  credentials and reloads on revision conflicts. Email/token inputs clear after
  save attempts. Saved settings explicitly remain connection-not-verified.
- `GET /api/v1/projects/:projectId/integrations/jira`: project-admin-only
  non-secret configuration, revision and server encryption availability.
- `PUT /api/v1/projects/:projectId/integrations/jira`: project-admin-only save.
  Fields: site, jiraProjectKey, issueTypeId, email, token, revision. Initial
  revision is 0; replacements require the current revision and full credentials.
- Credentials are encrypted together using AES-256-GCM and authenticated project
  and provider context. Responses never include credentials or ciphertext.
- Saves and audit events are transactional. Revision conflicts return 409;
  missing encryption configuration returns 503. Saving is not connection verification.
- Server-only `INTEGRATION_ENCRYPTION_KEY` must be 32 random bytes encoded as hex.
  Keep it stable and backed up privately. Changing it without re-encrypting stored
  credentials makes existing records unreadable. Never use a sample key in deployment.
- The direct-site REST client currently supports unscoped personal API tokens,
  not scoped-token gateway authentication. It refuses redirects and never retries
  issue creation automatically after an ambiguous failure.

## Still pending

Reconciliation browser/live verification, status polling, disconnect/key rotation workflows,
hosted migration and hosted-app verification remain pending.
Do not treat the connector's Jira access as application authentication.

## Live local verification (2026-10-24)

The user saved real credentials privately in the local DriftGate app. A synthetic
S4 defect named DEMO - Jira export and status sync verification was exported through
the app to [KAN-1](https://ramtulasi062005.atlassian.net/browse/KAN-1). Manual sync
read To Do at 19:41:21 IST without changing the local NEW QA state or its history.
Reopening the defect retained the saved ticket link and status. No second export
was attempted, and no real product regression is claimed by this fixture.

This is live happy-path evidence from the in-app browser, not a complete failure-path
or multi-browser test. Local encrypted credentials must retain the same private
server encryption key. Cloud credential configuration is not verified.

The Jira subscription plan still needs confirmation. No paid subscription should
be enabled for this project.
