# Runbook

## Phase 0 scope

Use README for the local preview. No deployed DriftGate service exists. Do not reuse Orbit credentials, databases or deployment resources.

## Planned operations

Deployment: Phase 7 will document tested Vercel, Render, Neon and evidence-storage steps with exact project names. Run migrations with the migration role; application roles cannot perform schema changes.

Rollback: retain the previous verified deployment and use backward-compatible migrations. Never reverse a database migration blindly or restore a backup over current data without approval.

Secret rotation: add the replacement secret, deploy compatible readers, rotate producers, verify service health and revoke the previous secret. JWT signing keys, callback HMAC keys and integration encryption keys require explicit rollover behavior before production use.

Evidence retention: choose a bounded retention window and size limits before enabling video/trace collection. Retain release evidence referenced by an active sign-off according to a documented policy.

Cold starts: Render and Neon free services may sleep. Startup health/readiness checks and bounded retry behavior are required. Free-tier deployment is not an uptime guarantee.
