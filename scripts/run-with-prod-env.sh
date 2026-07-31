#!/usr/bin/env bash
#
# Why: This script used to call `vercel env pull "$TEMP_ENV" --environment=production
#   --yes` to fetch production credentials at runtime. A prior agent run of that exact
#   command overwrote .env.local with live production secrets (Clerk, OpenAI,
#   DATABASE_URL) with no rollback path. `vercel env pull` is now HARD-FORBIDDEN in
#   this repo, which left the documented gated-publish path unrunnable by any agent
#   that follows the safety rule. This script now never fetches credentials itself:
#   the operator supplies DATABASE_URL up front, either exported or via
#   .env.production.local, and the script only ever reads what's already there.
# What: Resolves DATABASE_URL in strict precedence — (a) an already-exported
#   $DATABASE_URL, else (b) a non-empty DATABASE_URL line in .env.production.local at
#   the repo root — treating an empty string as "not set" either way (the repo's
#   .env.production.local ships with DATABASE_URL="" as a placeholder, which must NOT
#   be mistaken for a real value). On success it exports DATABASE_URL, sources the
#   rest of .env.production.local when present (mirroring the old contract of
#   forwarding the full prod env, e.g. Clerk/OpenAI keys), forces
#   NODE_ENV=production, and execs `npx tsx "$1"` exactly as before. On failure it
#   prints an actionable message to stderr and exits non-zero without ever fetching
#   or printing a credential.
# Test: (a) With DATABASE_URL unset and only the empty placeholder in
#   .env.production.local, running this script must fail fast with the actionable
#   message and a non-zero exit. (b) With a fake
#   DATABASE_URL='postgres://fake:fake@localhost:5432/fake' exported, running
#   `scripts/run-with-prod-env.sh <script>` must resolve from the environment, run
#   the script, and propagate its exit code — with the fake value never appearing in
#   the wrapper's own output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

ENV_FILE="${REPO_ROOT}/.env.production.local"

fail() {
  cat >&2 <<EOF
❌ DATABASE_URL is not set.

This script will NOT fetch production credentials itself, and running
'vercel env pull' is forbidden in this repo: a prior run of it overwrote
.env.local with live production secrets (Clerk, OpenAI, DATABASE_URL) with
no rollback path.

Supply the pooled production connection string yourself, one of two ways:

  1. Export it in your shell before running this script:
       export DATABASE_URL='<pooled prod connection string>'

  2. Set a non-empty value in ${ENV_FILE}:
       DATABASE_URL="<pooled prod connection string>"

An empty DATABASE_URL="" placeholder in .env.production.local does not
count as set.
EOF
  exit 1
}

# Case (a): already exported in the environment. Treat empty string as absent.
DATABASE_URL_SOURCE=""
if [[ -n "${DATABASE_URL:-}" ]]; then
  DATABASE_URL_SOURCE="already-exported environment variable"
fi

# Load .env.production.local when present so other prod vars the wrapped script
# expects (Clerk, OpenAI, etc.) get forwarded too, mirroring the script's old
# contract of sourcing the full prod env. Preserve an already-exported
# DATABASE_URL's precedence: don't let the file's placeholder clobber it.
if [[ -f "${ENV_FILE}" ]]; then
  PRESERVED_DATABASE_URL="${DATABASE_URL:-}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  if [[ -n "${PRESERVED_DATABASE_URL}" ]]; then
    export DATABASE_URL="${PRESERVED_DATABASE_URL}"
  elif [[ -z "${DATABASE_URL_SOURCE}" && -n "${DATABASE_URL:-}" ]]; then
    DATABASE_URL_SOURCE=".env.production.local"
  fi
fi

# Case (b) resolution failed too (or the file doesn't exist): fail fast.
if [[ -z "${DATABASE_URL:-}" ]]; then
  fail
fi

export DATABASE_URL
export NODE_ENV=production

# Confirmation only states the source, never the value.
echo "✅ DATABASE_URL resolved from: ${DATABASE_URL_SOURCE}"
echo ""
echo "🚀 Running script: $1"
echo ""

# Execute the provided script, preserving the original argument-forwarding
# contract (a single ts/js entry-script path) and exit-code propagation via exec.
exec npx tsx "$1"
