#!/bin/sh
set -eu
cd "$(dirname "$0")"
: "${RUNNER_JOB_BASE64:?Supply a base64 v1 job}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-driftgate-runner-$$}"
export RUNNER_LOCAL_OUTPUT="${RUNNER_LOCAL_OUTPUT:-$(mktemp -d)}"
mkdir -p "$RUNNER_LOCAL_OUTPUT/evidence" "$RUNNER_LOCAL_OUTPUT/spool"
if [ -n "$(ls -A "$RUNNER_LOCAL_OUTPUT/spool")" ]; then
  echo "Spool directory must be empty" >&2
  exit 1
fi
# Bind mount directories need to be writable by the unprivileged browser user.
chmod 777 "$RUNNER_LOCAL_OUTPUT/evidence" "$RUNNER_LOCAL_OUTPUT/spool"
trap 'docker compose -f compose.yml --profile control down --volumes --remove-orphans' EXIT HUP INT TERM
docker compose -f compose.yml build threadline runner
docker compose -f compose.yml up -d --wait threadline
docker compose -f compose.yml run --rm --no-deps runner
# Browser has exited before this network-connected process starts. Never attach
# the relay to the browser namespace or mount its credentials into that namespace.
if [ -n "${RUNNER_CALLBACK_URL:-}" ]; then
  docker compose -f compose.yml --profile control build relay
  docker compose -f compose.yml --profile control run --rm --no-deps relay
fi
echo "Private local evidence and callback spool: $RUNNER_LOCAL_OUTPUT"
