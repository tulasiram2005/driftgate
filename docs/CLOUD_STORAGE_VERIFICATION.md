# Private cloud storage verification

Executed on 2026-10-20 against Supabase project `driftgate-evidence`,
reference `zlcdlokljlcmhcigxdpr`, region `us-west-1`, on organization
`tulasiram` (Free). The bucket is `driftgate-evidence`, with public access off.

From `apps/api`, with private credentials in the ignored root `.env.storage`:

```sh
node --env-file=../../.env.storage --import tsx integration/storage-cloud.ts
```

Actual output (exit 0):

```text
PASS: signed PUT/GET, 300s expiry, exact bytes, metadata validation
PASS: unsigned request rejected with 403
PASS: tampered request rejected with 403
PASS: verification object removed
```

The test uses the application's storage implementation and a unique object
under `verification/`. It never deletes the bucket or existing objects.
Expiry is checked in the signed URL; elapsed-time expiration was not tested.
This verifies storage directly, not the hosted API or GitHub runner workflow.

The S3 key has full project-storage access and bypasses RLS. Keep it server-side,
out of public clients, logs and commits. Deployment and GitHub secret setup
remain pending. `git check-ignore .env.storage` returned `.env.storage`.
