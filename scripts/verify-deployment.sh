#!/usr/bin/env bash
# Verify production deployment is healthy after a release.
# Usage: ./scripts/verify-deployment.sh [base-url]
# Default base-url: https://aipowerranking.com

set -euo pipefail

BASE_URL="${1:-https://aipowerranking.com}"
VERSION=$(node -p "require('./package.json').version")
MAX_WAIT=180   # seconds to wait for Vercel to deploy
POLL=10        # seconds between checks
PASS=0
FAIL=0

# ── Colour helpers ────────────────────────────────────────────────────────────
green()  { echo "  ✅  $*"; }
red()    { echo "  ❌  $*"; }
yellow() { echo "  ⏳  $*"; }

check() {
  local label="$1" url="$2" expected_status="${3:-200}" grep_for="${4:-}"
  local status
  status=$(curl -s -o /tmp/verify_body -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$status" != "$expected_status" ]]; then
    red "$label — HTTP $status (expected $expected_status) → $url"
    FAIL=$((FAIL+1))
    return
  fi
  if [[ -n "$grep_for" ]] && ! grep -q "$grep_for" /tmp/verify_body 2>/dev/null; then
    red "$label — response missing \"$grep_for\" → $url"
    FAIL=$((FAIL+1))
    return
  fi
  green "$label"
  PASS=$((PASS+1))
}

# ── Wait for Vercel to finish deploying ──────────────────────────────────────
echo ""
echo "🚀  Verifying v$VERSION at $BASE_URL"
echo "    Waiting up to ${MAX_WAIT}s for deployment..."
echo ""

ELAPSED=0
while true; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL" || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    break
  fi
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    echo "❌  Timed out waiting for $BASE_URL to return 200 (got $STATUS)"
    exit 1
  fi
  yellow "Site returned $STATUS — retrying in ${POLL}s (${ELAPSED}s elapsed)"
  sleep $POLL
  ELAPSED=$((ELAPSED+POLL))
done

echo "    Site is up. Running checks..."
echo ""

# ── Health checks ─────────────────────────────────────────────────────────────
check "Homepage loads"                   "$BASE_URL"                          200  "AI Power Ranking"
check "Rankings page"                    "$BASE_URL/en/rankings"              200  "ranking"
check "Tools directory"                  "$BASE_URL/en/tools"                 200
check "News page"                        "$BASE_URL/en/news"                  200
check "Methodology page"                 "$BASE_URL/en/methodology"           200
check "About page"                       "$BASE_URL/en/about"                 200
check "API: rankings"                    "$BASE_URL/api/rankings/current"     200
check "API: tools"                       "$BASE_URL/api/tools"                200
check "Sitemap accessible"               "$BASE_URL/sitemap.xml"              200  "<urlset"
check "robots.txt accessible"            "$BASE_URL/robots.txt"               200
check "Japanese locale"                  "$BASE_URL/ja"                       200
check "Spanish locale"                   "$BASE_URL/es"                       200

# ── Report ────────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────"
echo "  Results: $PASS passed, $FAIL failed"
echo "──────────────────────────────────────"

if [[ $FAIL -gt 0 ]]; then
  echo "❌  Deployment verification FAILED for v$VERSION"
  exit 1
else
  echo "✅  Deployment v$VERSION verified successfully"
fi
