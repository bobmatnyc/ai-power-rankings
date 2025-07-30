# News Collection Guide

This guide explains how to collect AI news for the AI Power Rankings project using the minimal news collection script.

## Overview

The news collection system gathers AI-related news from:
- HackerNews API (AI-related posts)
- RSS feeds from AI news sources (MIT AI News, AI News, VentureBeat AI)

The collected news is automatically transformed to match the AI Power Rankings format and saved to `data/incoming/` for review.

## Prerequisites

Install the minimal dependencies:

```bash
make install-news-deps
# or manually:
pip install -r requirements-news-collection.txt
```

## Usage

### Quick Start

Collect news from the last 7 days:
```bash
make collect-news
```

### Other Options

Collect news from the last 3 days:
```bash
make collect-news-3d
```

Collect news from the last 24 hours:
```bash
make collect-news-1d
```

### Advanced Usage

Run the script directly with custom options:
```bash
# Collect 14 days of news
python scripts/collect_news.py --days 14

# Save to a specific location
python scripts/collect_news.py --output data/incoming/my_news.json

# Also save raw collected data
python scripts/collect_news.py --raw
```

## Output Format

The collected news is saved in the AI Power Rankings format:

```json
{
  "articles": [
    {
      "id": "unique-uuid",
      "slug": "news-title-slug",
      "title": "Article Title",
      "content": "Article content or summary",
      "summary": "Brief summary...",
      "source": "HackerNews",
      "source_url": "https://example.com/article",
      "tags": ["industry", "ai-coding"],
      "tool_mentions": ["claude-code", "github-copilot"],
      "created_at": "2025-07-29T...",
      "updated_at": "2025-07-29T...",
      "date": "2025-07-29T..."
    }
  ],
  "metadata": {
    "collection_timestamp": "2025-07-29T...",
    "total_articles": 42,
    "sources": ["hackernews", "rss"]
  }
}
```

## Tool Mapping

The collector automatically detects mentions of AI coding tools and maps them to the correct tool IDs:

- "claude" → "claude-code"
- "gpt", "chatgpt" → "chatgpt-canvas"
- "copilot", "github copilot" → "github-copilot"
- "cursor" → "cursor"
- "devin" → "devin"
- "aider" → "aider"
- "kiro" → "kiro"
- And more...

## Integration with AI Power Rankings

After collecting news:

1. Review the collected news in `data/incoming/collected_news_*.json`
2. Verify the tool mentions are correctly identified
3. The news can be ingested into the main `data/json/news/news.json` file
4. The news will appear in the What's New section and influence rankings

## Troubleshooting

### No news collected
- The collector filters for AI-related content, so not all HackerNews posts will be included
- Try increasing the collection period with `--days`

### Missing dependencies
- Run `make install-news-deps` or `pip install requests feedparser`

### Tool mentions not detected
- The tool mapping is in `scripts/collect_news.py` in the `TOOL_ID_MAP` dictionary
- Add new mappings as needed

## Adding New Sources

To add new RSS feeds or sources, modify the minimal collector script at `scripts/collect_news_minimal.py` and add feeds to the `feeds` list in the `collect_rss_feeds` function.