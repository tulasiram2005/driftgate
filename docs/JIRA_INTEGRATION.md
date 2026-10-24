# Jira integration status

The Jira software project is DriftGate (KAN), board 2:
https://ramtulasi062005.atlassian.net/jira/software/projects/KAN/boards/2

## Implemented locally

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
  Process interruption can leave PENDING; manual reconciliation is not implemented
  yet. No exactly-once delivery claim is made. UI requires export confirmation.
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

Live verification, browser verification of export, ambiguous-outcome reconciliation,
status polling, disconnect/key
rotation workflows and hosted migration. No live credentials are configured.
Do not treat the connector's Jira access as application authentication.

The Jira subscription plan still needs confirmation. No paid subscription should
be enabled for this project.
