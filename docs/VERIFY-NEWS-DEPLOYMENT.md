# News Article Deployment Verification

## Issue
News articles for August 2025 are not accessible in production despite having correct data files and indexes locally.

## Status Check Results

### Local Repository ✅
- Data files contain proper `newsById` and `newsBySlug` indexes
- Repository can find articles by slug correctly
- August 2025 articles are present and indexed

### Production API ❌
- `/api/news` returns articles up to July 2025 only
- `/api/news/recent` missing August 2025 articles
- Individual article URLs return 404 errors

### Affected Articles
- `/en/news/news-gpt-5` (GPT-5 announcement)
- `/en/news/anthropic-releases-claude-opus-4-1-improved-coding-accuracy` (Claude Opus 4.1)
- `/en/news/cerebras-introduces-cerebras-code-ultra-fast-ai-coding-assistant` (Cerebras Code)

## Next Steps
This commit triggers a fresh deployment to ensure the updated news data with proper indexes is deployed to production.

Date: 2025-08-08T04:30:00Z