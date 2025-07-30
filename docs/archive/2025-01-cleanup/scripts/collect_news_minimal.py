#!/usr/bin/env python3
"""
Minimal standalone script to collect latest AI news without heavy dependencies.

This script can be run from the ai-power-rankings project to collect fresh news data.
It avoids importing modules that depend on langchain or other heavy dependencies.

Usage:
    python collect_latest_news_minimal.py [options]

Examples:
    # Collect from available sources and save to default location
    python collect_latest_news_minimal.py
    
    # Collect last 3 days and save to specific file
    python collect_latest_news_minimal.py --days 3 --output latest_news.json
"""

import argparse
import json
import logging
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

# Handle running from different locations
SCRIPT_DIR = Path(__file__).parent.resolve()

# Find the ai-power-rankings-data directory
if SCRIPT_DIR.name == "ai-power-rankings":
    # Running from ai-power-rankings project
    DATA_PROJECT_ROOT = SCRIPT_DIR.parent / "ai-power-rankings-data"
elif SCRIPT_DIR.name == "ai-power-rankings-data":
    # Running from ai-power-rankings-data project root
    DATA_PROJECT_ROOT = SCRIPT_DIR
else:
    # Running from a subdirectory - walk up to find the root
    current = SCRIPT_DIR
    while current.parent != current:
        if current.name == "ai-power-rankings-data":
            DATA_PROJECT_ROOT = current
            break
        current = current.parent
    else:
        # Default to script directory if not found
        DATA_PROJECT_ROOT = SCRIPT_DIR

# Add the data project to Python path
sys.path.insert(0, str(DATA_PROJECT_ROOT))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def collect_hackernews(start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
    """Collect from HackerNews using simple API requests."""
    try:
        import requests
        
        logger.info("Collecting from HackerNews...")
        
        # Get top stories
        top_stories_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
        response = requests.get(top_stories_url)
        story_ids = response.json()[:50]  # Get top 50 stories
        
        articles = []
        ai_keywords = ["ai", "artificial intelligence", "machine learning", "gpt", "claude", "copilot", "llm"]
        
        for story_id in story_ids:
            # Get story details
            story_url = f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
            story_response = requests.get(story_url)
            story = story_response.json()
            
            if story and story.get("type") == "story":
                title = story.get("title", "").lower()
                # Check if AI-related
                if any(keyword in title for keyword in ai_keywords):
                    # Convert timestamp to datetime
                    timestamp = story.get("time", 0)
                    pub_date = datetime.fromtimestamp(timestamp, tz=UTC)
                    
                    # Check if within date range
                    if start_date <= pub_date <= end_date:
                        articles.append({
                            "title": story.get("title", ""),
                            "url": story.get("url", f"https://news.ycombinator.com/item?id={story_id}"),
                            "published_date": pub_date.isoformat(),
                            "source": "HackerNews",
                            "score": story.get("score", 0),
                            "comments": story.get("descendants", 0),
                            "id": f"hn-{story_id}"
                        })
        
        logger.info(f"Collected {len(articles)} AI-related articles from HackerNews")
        return articles
        
    except Exception as e:
        logger.error(f"HackerNews collection failed: {e}")
        return []


def collect_rss_feeds(start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
    """Collect from RSS feeds."""
    try:
        import feedparser
        
        logger.info("Collecting from RSS feeds...")
        
        # AI-focused RSS feeds
        feeds = [
            {"name": "MIT AI News", "url": "https://news.mit.edu/rss/topic/artificial-intelligence2"},
            {"name": "AI News", "url": "https://www.artificialintelligence-news.com/feed/"},
            {"name": "VentureBeat AI", "url": "https://venturebeat.com/ai/feed/"},
        ]
        
        all_articles = []
        
        for feed_info in feeds:
            try:
                logger.info(f"  Fetching {feed_info['name']}...")
                feed = feedparser.parse(feed_info["url"])
                
                for entry in feed.entries[:20]:  # Limit to 20 entries per feed
                    # Parse publish date
                    pub_date = None
                    if hasattr(entry, "published_parsed") and entry.published_parsed:
                        pub_date = datetime(*entry.published_parsed[:6], tzinfo=UTC)
                    elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                        pub_date = datetime(*entry.updated_parsed[:6], tzinfo=UTC)
                    
                    if pub_date and start_date <= pub_date <= end_date:
                        all_articles.append({
                            "title": entry.get("title", ""),
                            "url": entry.get("link", ""),
                            "published_date": pub_date.isoformat(),
                            "source": f"RSS - {feed_info['name']}",
                            "summary": entry.get("summary", "")[:500],
                            "id": f"rss-{hash(entry.get('link', ''))}"
                        })
                        
            except Exception as e:
                logger.warning(f"Failed to fetch {feed_info['name']}: {e}")
                
        logger.info(f"Collected {len(all_articles)} articles from RSS feeds")
        return all_articles
        
    except ImportError:
        logger.warning("feedparser not installed, skipping RSS feeds")
        return []
    except Exception as e:
        logger.error(f"RSS collection failed: {e}")
        return []


def convert_to_ingestion_format(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert collected articles to ingestion format."""
    ingestion_items = []
    
    for article in articles:
        # Determine category based on content
        title = article.get("title", "").lower()
        summary = article.get("summary", "").lower()
        combined_text = f"{title} {summary}"
        
        # Simple categorization
        category = "ai-general"
        if any(word in combined_text for word in ["launch", "release", "announce", "unveil"]):
            category = "product-launch"
        elif any(word in combined_text for word in ["research", "study", "paper", "findings"]):
            category = "research"
        elif any(word in combined_text for word in ["funding", "investment", "raise", "valuation"]):
            category = "business"
        
        # Extract tool mentions
        tool_keywords = {
            "claude": "Claude",
            "gpt": "ChatGPT",
            "copilot": "GitHub Copilot",
            "cursor": "Cursor",
            "gemini": "Gemini",
            "llama": "LLaMA",
            "midjourney": "Midjourney",
            "stable diffusion": "Stable Diffusion"
        }
        
        tools_mentioned = []
        for keyword, tool_name in tool_keywords.items():
            if keyword in combined_text:
                tools_mentioned.append(tool_name)
        
        ingestion_item = {
            "id": article.get("id", f"news-{hash(article.get('url', ''))}"),
            "title": article.get("title", ""),
            "url": article.get("url", ""),
            "published_date": article.get("published_date", datetime.now(UTC).isoformat()),
            "source": article.get("source", "Unknown"),
            "category": category,
            "summary": article.get("summary", ""),
            "tools_mentioned": tools_mentioned,
            "relevance_score": min(article.get("score", 50) / 100.0, 1.0) if "score" in article else 0.5
        }
        
        ingestion_items.append(ingestion_item)
    
    return ingestion_items


def main():
    """Main entry point for the minimal collector."""
    parser = argparse.ArgumentParser(
        description="Collect latest AI news (minimal version)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Collect from available sources
  python collect_latest_news_minimal.py

  # Collect last 3 days
  python collect_latest_news_minimal.py --days 3

  # Save to specific file
  python collect_latest_news_minimal.py --output all_news.json
        """
    )
    
    parser.add_argument(
        "--days", "-d",
        type=int,
        default=7,
        help="Number of days to collect (default: 7)"
    )
    
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="latest_ai_news.json",
        help="Output file path (default: latest_ai_news.json)"
    )
    
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty print JSON output"
    )
    
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Minimize output (only show errors)"
    )
    
    args = parser.parse_args()
    
    # Configure logging based on quiet flag
    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    
    # Print header unless quiet
    if not args.quiet:
        print("\n" + "=" * 60)
        print("AI Power Rankings - News Collector (Minimal)")
        print("=" * 60)
        print(f"\nCollecting news from the last {args.days} days")
    
    # Determine time range
    end_date = datetime.now(UTC)
    start_date = end_date - timedelta(days=args.days)
    
    if not args.quiet:
        print(f"\nCollecting...")
    
    # Collect news
    try:
        all_articles = []
        
        # Collect from HackerNews
        hn_articles = collect_hackernews(start_date, end_date)
        all_articles.extend(hn_articles)
        
        # Collect from RSS feeds
        rss_articles = collect_rss_feeds(start_date, end_date)
        all_articles.extend(rss_articles)
        
        if not all_articles:
            if not args.quiet:
                print("\nNo news items collected.")
            return 1
        
        # Convert to ingestion format
        ingestion_items = convert_to_ingestion_format(all_articles)
        
        # Save to file
        output_path = Path(args.output)
        output_data = {
            "metadata": {
                "collection_timestamp": datetime.now(UTC).isoformat(),
                "collection_period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat()
                },
                "sources": ["hackernews", "rss"],
                "item_count": len(ingestion_items)
            },
            "items": ingestion_items
        }
        
        with open(output_path, 'w') as f:
            if args.pretty:
                json.dump(output_data, f, indent=2, default=str)
            else:
                json.dump(output_data, f, default=str)
        
        if not args.quiet:
            print(f"\n✅ Successfully collected {len(ingestion_items)} news items")
            print(f"📄 Saved to: {output_path.absolute()}")
            
            # Show summary by category
            categories = {}
            for item in ingestion_items:
                cat = item.get("category", "unknown")
                categories[cat] = categories.get(cat, 0) + 1
            
            print("\nSummary by category:")
            for cat, count in sorted(categories.items()):
                print(f"  {cat}: {count}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Collection failed: {e}")
        if not args.quiet:
            print(f"\n❌ Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())