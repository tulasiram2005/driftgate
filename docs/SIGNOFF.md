# Sign-off integrity

Status: Phase 5 hashing/verification primitives implemented and tested. Sign-off
persistence, authorization endpoint, release evidence collection and UI are pending.

## Record format

Version 1 records bind project, release, gate, actor ID and name, action
(APPROVED/REVOKED), comment, timestamp, readiness policy, evidence hash and gate
revision. Each SHA-256 digest includes a format domain, sequence and previous hash.
The first record uses a null predecessor; sequence starts at one.

Verification requires the expected project/release, record count and head hash.
It rejects malformed records, scope mismatches, reordered/missing/duplicated links,
modified payloads, decreasing timestamps and mismatched retained heads. An empty
chain can be structurally valid but is never proof of an approval.

## Required integration safeguards

- Authorize the named Approver server-side and use server timestamps.
- Recompute readiness from trusted records and reject stale evidence/revisions.
- Serialize append and head update in a database transaction; enforce sequence
  uniqueness. Never accept a caller-supplied predecessor or actor identity.
- Store the record count/head with the release and verify the complete chain.
- Bind approvals to exact evidence; changed evidence requires fresh review.
- Preserve revocations as appended records, not edits to old approvals.

## Limits

These are tamper-evident hashes, not digital signatures. The primitives do not
grant permissions, enforce release order, prove evidence authenticity or make
storage immutable. A privileged attacker able to rewrite both the full chain
and its retained head could recompute valid hashes. Independent retained heads
would be needed for stronger protection against that threat. Deleting a tail is
detectable only when verification uses an independently retained expected head/count.

The append helper checks the immediate predecessor; the integrating service must
verify the whole chain before use. Do not call this a completed sign-off workflow.
