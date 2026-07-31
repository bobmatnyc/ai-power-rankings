#!/usr/bin/env bash
#
# Why: Server-side GitHub alerts only reach you by email; this gives the maintainer a
#   loud, local macOS notification when the daily scraper goes silent, fails outright,
#   hits OpenRouter credit exhaustion, or zero-yields for several runs in a row — the
#   same signals scripts/check-ingestion-gap.mjs gates on, surfaced on the desktop. It is
#   the awake-only local complement to the always-on GitHub-issue alert.
# What: Loads DATABASE_URL from .env.local (same env the GitHub job sets), runs
#   scripts/check-ingestion-gap.mjs, and on a NON-zero exit fires a macOS notification
#   (terminal-notifier if present, else osascript) whose title/message reflect the
#   specific ALERT[REASON] tag the check printed (STALLED / RUN_FAILED /
#   OPENROUTER_CREDITS / ZERO_YIELD_STREAK / NO_RUNS_EVER), so a stalled scraper doesn't
#   look identical to a billing problem. Zero exit is quiet.
# Test: With a healthy DB, run `bash scripts/notify/ingestion-gap-notify.sh` — it logs
#   an OK line and shows no notification. To force an alert path, point DATABASE_URL at a
#   DB whose automated_ingestion_runs rows match one of the ALERT conditions (no recent
#   row, latest status='failed', error_log containing "insufficient credits", or the last
#   few runs all at articles_ingested=0) and re-run — a notification with the matching
#   reason should appear and the log should contain the corresponding ALERT[...] line.

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
  # $1: the ALERT[REASON] tag (STALLED, RUN_FAILED, OPENROUTER_CREDITS, ZERO_YIELD_STREAK,
  # NO_RUNS_EVER, or empty/unknown) extracted from the check's output, so the desktop
  # notification names the actual problem instead of always saying "stalled" — a stalled
  # scraper and a zero-yield or billing failure need different responses.
  local reason="${1:-}"
  local title message
  case "${reason}" in
    STALLED|NO_RUNS_EVER)
      title="🚨 AIPR ingestion stalled"
      message="No AIPR ingestion run recorded recently — daily scraper may be down"
      ;;
    OPENROUTER_CREDITS)
      title="💳 AIPR ingestion: OpenRouter credits exhausted"
      message="OpenRouter insufficient-credits error in ingestion logs — top up/rotate the API key"
      ;;
    RUN_FAILED)
      title="🚨 AIPR ingestion run failed"
      message="Latest AIPR ingestion run recorded status=failed — check error_log"
      ;;
    ZERO_YIELD_STREAK)
      title="🚨 AIPR ingestion yielding 0 articles"
      message="Several consecutive AIPR ingestion runs ingested 0 articles"
      ;;
    *)
      title="🚨 AIPR ingestion check failed"
      message="scripts/check-ingestion-gap.mjs reported a failure — see ${LOG_FILE}"
      ;;
  esac
  if command -v terminal-notifier >/dev/null 2>&1; then
    terminal-notifier -title "${title}" -message "${message}" -sound Sosumi || true
  else
    # Sanitize before interpolating into the AppleScript string: escape backslashes
    # first, then double-quotes, so the literals can't break out of or inject into the
    # osascript expression (defense-in-depth even though these are static literals today).
    local safe_msg=${message//\\/\\\\}; safe_msg=${safe_msg//\"/\\\"}
    local safe_title=${title//\\/\\\\}; safe_title=${safe_title//\"/\\\"}
    osascript -e "display notification \"${safe_msg}\" with title \"${safe_title}\" sound name \"Sosumi\"" || true
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
  # Pick the ALERT[REASON] tag to headline the notification with. OPENROUTER_CREDITS is
  # preferred whenever present — it's the most specific, most actionable reason (a billing
  # fix, not a code fix) and can co-occur with a generic RUN_FAILED line for the same run;
  # otherwise fall back to whichever ALERT[...] tag appears first in the output.
  if printf '%s\n' "${CHECK_OUTPUT}" | grep -q 'ALERT\[OPENROUTER_CREDITS\]'; then
    REASON="OPENROUTER_CREDITS"
  else
    REASON="$(printf '%s\n' "${CHECK_OUTPUT}" | grep -o -m1 'ALERT\[[A-Z_]*\]' | head -n1 | sed -E 's/ALERT\[([A-Z_]+)\]/\1/')"
  fi
  log "ALERT[${REASON:-UNKNOWN}]: ingestion gap check exited ${EXIT_CODE} — firing macOS notification"
  notify "${REASON}"
  exit "${EXIT_CODE}"
fi

log "OK: ingestion gap check passed (exit 0); no notification"
exit 0
