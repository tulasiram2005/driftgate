# Jira encryption-key rotation

This is an offline operator procedure, not a routine application action. It
changes the key protecting saved Jira credentials, not the Jira API tokens.
The utility has been tested with synthetic local credentials. No real key has
been rotated, and cloud operation is NOT VERIFIED.

## Prepare

1. Back up the target database and securely retain its matching old encryption
   key. Confirm which database DATABASE_URL selects, without printing its value.
2. Generate a new 32-byte random key in a secret manager and save it securely
   before proceeding. Supply its 64-character hex value privately as
   INTEGRATION_ENCRYPTION_KEY_NEXT. INTEGRATION_ENCRYPTION_KEY remains the old key.
   Do not put either value in commands, logs, source control or chat.
3. From the repository root, run `pnpm --filter @driftgate/api jira:rotate-key`.
   This defaults to a dry run. It verifies every connected credential with both
   keys and reports only a count and applied:false. Disconnected rows are skipped.
4. Schedule a maintenance window. Stop all API instances, workers and other
   settings writers, and allow in-flight requests to finish. The table lock used
   by the utility does not replace this step: running processes retain old keys.

## Apply and resume

1. Set JIRA_ROTATION_MAINTENANCE=1 privately in the operator environment, then run
   `pnpm --filter @driftgate/api jira:rotate-key --apply`.
2. A successful result reports applied:true. All connected credentials and their
   KEY_ROTATED audit events commit in one transaction. Settings revisions increase
   so stale forms and checks cannot silently reuse an old revision.
3. Update INTEGRATION_ENCRYPTION_KEY to the saved new key for every API and worker
   using this database. Remove the temporary NEXT and MAINTENANCE variables.
4. Restart the API, check Jira access, and only then restart any intended workers.
   Reopen settings forms after rotation. Do not enable paid services for this.

## Failure and recovery

Credential validation or database errors inside the transaction roll back its
changes. If the connection is lost around commit, its outcome may be uncertain.
Keep services stopped; do not blindly apply again. Inspect KEY_ROTATED audit
events and use the dry run with the candidate current key to determine state.
The dry run requires two distinct keys and never persists new ciphertext.

For deliberate reversal while still offline, use the new key as the old input
and the original key as the next input, first dry-run, then apply. Restore all
service key settings consistently before restarting. Alternatively restore the
database backup with its matching original key. Never restore only one half.
Retain old keys securely according to the backup retention policy.

The operation supports at most 10,000 connected settings, has a five-second lock
timeout and a sixty-second transaction timeout, and fails rather than splitting
the operation into partially committed batches. No HTTP calls to Jira are made.
