#!/bin/bash
set -e

echo "🔧 Fixing commit authors for last 15 commits..."
echo ""
echo "This will change author from:"
echo "  Masa Matsuoka <masa@Masas-Studio.local>"
echo "To:"
echo "  Robert (Masa) Matsuoka <bobmatnyc@users.noreply.github.com>"
echo ""

# The last commit on production that has the correct author
LAST_GOOD_COMMIT="b02a96cf"

# Count commits to rewrite
COMMIT_COUNT=$(git rev-list ${LAST_GOOD_COMMIT}..HEAD --count)
echo "📊 Commits to rewrite: $COMMIT_COUNT"
echo ""

# Rewrite commit authors
git filter-branch -f --env-filter '
OLD_EMAIL="masa@Masas-Studio.local"
CORRECT_NAME="Robert (Masa) Matsuoka"
CORRECT_EMAIL="bobmatnyc@users.noreply.github.com"

if [ "$GIT_COMMITTER_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_COMMITTER_NAME="$CORRECT_NAME"
    export GIT_COMMITTER_EMAIL="$CORRECT_EMAIL"
fi
if [ "$GIT_AUTHOR_EMAIL" = "$OLD_EMAIL" ]
then
    export GIT_AUTHOR_NAME="$CORRECT_NAME"
    export GIT_AUTHOR_EMAIL="$CORRECT_EMAIL"
fi
' ${LAST_GOOD_COMMIT}..HEAD

echo ""
echo "✅ Authors fixed!"
echo ""
echo "📋 Verifying changes..."
git log ${LAST_GOOD_COMMIT}..HEAD --format="%h %an <%ae> %s" | head -5

echo ""
echo "⚠️  NEXT STEP: Force push to GitHub"
echo "Run: git push origin main --force-with-lease"
