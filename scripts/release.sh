#!/usr/bin/env bash
# Usage: ./scripts/release.sh [patch|minor|major]
# Bumps version, updates CHANGELOG, commits, tags, and pushes.

set -euo pipefail

BUMP="${1:-patch}"
if [[ ! "$BUMP" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]" >&2
  exit 1
fi

# ── Preflight ────────────────────────────────────────────────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌  Working tree is dirty. Commit or stash changes first." >&2
  exit 1
fi

git pull --ff-only

# ── Bump version ─────────────────────────────────────────────────────────────
OLD_VERSION=$(node -p "require('./package.json').version")

# Compute new version without npm side-effects
IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_VERSION"
case "$BUMP" in
  major) MAJOR=$((MAJOR+1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR+1)); PATCH=0 ;;
  patch) PATCH=$((PATCH+1)) ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
TODAY=$(date +%Y-%m-%d)

echo "🔖  $OLD_VERSION → $NEW_VERSION"

# Update package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# ── Generate CHANGELOG entry ──────────────────────────────────────────────────
# Collect commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -n "$LAST_TAG" ]]; then
  COMMITS=$(git log "${LAST_TAG}..HEAD" --pretty=format:"- %s" --no-merges)
else
  COMMITS=$(git log --pretty=format:"- %s" --no-merges -20)
fi

# Prepend new section to CHANGELOG.md
ENTRY="## [$NEW_VERSION] - $TODAY

### Changed
$COMMITS

"

CHANGELOG_CONTENTS=$(cat CHANGELOG.md)
# Insert after the header (first two lines)
HEADER=$(head -4 CHANGELOG.md)
BODY=$(tail -n +5 CHANGELOG.md)
printf '%s\n\n%s\n%s' "$HEADER" "$ENTRY" "$BODY" > CHANGELOG.md

echo "📝  CHANGELOG.md updated"

# ── Commit, tag, push ────────────────────────────────────────────────────────
git add package.json CHANGELOG.md
git commit -m "chore: bump version to $NEW_VERSION

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git tag "v$NEW_VERSION" -m "Release v$NEW_VERSION"
git push && git push --tags

echo ""
echo "✅  Released v$NEW_VERSION"
echo "    Tag: v$NEW_VERSION"
echo "    Vercel will deploy automatically from main."
