# Runbook

## Hosted demo

The QA web app and Threadline storefront run on Vercel. Render serves the API.
After a release, open the workspace, check API readiness, and load the staging catalogue.
Confirm both Vercel projects and the Render service deployed the intended Git revision.
[QA workspace](https://driftgate-web.vercel.app) · [API readiness](https://driftgate-api-s2pc.onrender.com/ready) · [Threadline staging](https://driftgate-threadline.vercel.app/staging)

New automated runs require a running DriftGate dispatch worker. The demo uses a local worker connected to the hosted queue. For a presentation, use a completed run to inspect stored evidence. For a fresh run, check the worker, submit a staging catalogue check, then verify the GitHub Actions run, its final DriftGate result and its evidence. [Hosted walkthrough](DEMO_SCRIPT.md)

Apply schema changes using the migration role. Keep the application and read-only SQL assertion credentials separate.

## Recovery and maintenance

Rollback: retain the previous verified deployment and use backward-compatible migrations. Never reverse a database migration blindly or restore a backup over current data without approval.

Secret rotation: add the replacement secret, deploy compatible readers, rotate producers, verify service health and revoke the previous secret. JWT signing keys, callback HMAC keys and integration encryption keys require explicit rollover behavior before production use.

Evidence retention: choose a bounded retention window and size limits before enabling video/trace collection. Retain release evidence referenced by an active sign-off according to a documented policy.

Cold starts: Render and Neon free services may sleep. Startup health/readiness checks and bounded retry behavior are required. Free-tier deployment is not an uptime guarantee.
