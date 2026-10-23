# Jira integration status

The Jira software project is DriftGate (KAN), board 2:
https://ramtulasi062005.atlassian.net/jira/software/projects/KAN/boards/2

## Implemented locally

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

Configuration UI, live verification, defect export/link persistence, duplicate
prevention and ambiguous-outcome reconciliation, status polling, disconnect/key
rotation workflows and hosted migration. No live credentials are configured.
Do not treat the connector's Jira access as application authentication.

The Jira subscription plan still needs confirmation. No paid subscription should
be enabled for this project.
