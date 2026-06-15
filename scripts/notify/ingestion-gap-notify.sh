#!/usr/bin/env bash
#
# Why: Server-side GitHub alerts only reach you by email; this gives the maintainer a
#   loud, local macOS notification when the daily scraper goes silent — the same
#   25h ingestion-gap signal, surfaced on the desktop. It is the awake-only local
#   complement to the always-on GitHub-issue alert.
# What: Loads DATABASE_URL from .env.local (same env the GitHub job sets), runs
#   scripts/check-ingestion-gap.mjs, and on a NON-zero exit fires a macOS
#   notification (terminal-notifier if present, else osascript). Zero exit is quiet.
# Test: With a healthy DB, run `bash scripts/notify/ingestion-gap-notify.sh` — it logs
#   an OK line and shows no notification. To force the alert path, point DATABASE_URL
#   at a DB with no recent automated_ingestion_runs rows (or temporarily lower the
#   threshold in check-ingestion-gap.mjs) and re-run — a notification should appear and
#   the log should contain an ALERT line.

set -euo pipefail

# Resolve the repo root from this script's location so the job is portable regardless
# of where launchd invokes it from. Script lives at <repo>/scripts/notify/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

# Log to the gitignored repo tmp/ dir; fall back to /tmp if it cannot be created.
LOG_DIR="${REPO_ROOT}/tmp"
if ! mkdir -p "${LOG_DIR}" 2>/dev/null; then
  LOG_DIR="/tmp"
fi
LOG_FILE="${LOG_DIR}/aipr-ingestion-gap.log"

log() {
  # Timestamped line to both stdout (captured by launchd StandardOutPath) and the log file.
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" | tee -a "${LOG_FILE}"
}

# Load .env.local if present so DATABASE_URL is available, mirroring the GitHub job env.
# `set -a` exports every var assigned while sourcing.
if [[ -f "${REPO_ROOT}/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env.local"
  set +a
fi

notify() {
  # Fire a macOS notification, preferring terminal-notifier; fall back to osascript.
  local title="🚨 AIPR ingestion stalled"
  local message="No AIPR ingestion run in 25h+ — daily scraper may be down"
  if command -v terminal-notifier >/dev/null 2>&1; then
    terminal-notifier -title "${title}" -message "${message}" -sound Sosumi || true
  else
    osascript -e "display notification \"${message}\" with title \"${title}\" sound name \"Sosumi\"" || true
  fi
}

# Run the gating check without tripping `set -e`; we want to branch on its exit code.
set +e
CHECK_OUTPUT="$(node scripts/check-ingestion-gap.mjs 2>&1)"
EXIT_CODE=$?
set -e

# Echo the check's own output into the log for post-mortem context.
if [[ -n "${CHECK_OUTPUT}" ]]; then
  printf '%s\n' "${CHECK_OUTPUT}" | tee -a "${LOG_FILE}"
fi

if [[ "${EXIT_CODE}" -ne 0 ]]; then
  log "ALERT: ingestion gap check exited ${EXIT_CODE} — firing macOS notification"
  notify
  exit "${EXIT_CODE}"
fi

log "OK: ingestion gap check passed (exit 0); no notification"
exit 0
