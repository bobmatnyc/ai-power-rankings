#!/usr/bin/env python3
"""
Wrapper script to collect AI news and transform it to the ai-power-rankings format.

This script:
1. Uses the minimal collector to gather news from HackerNews and RSS feeds
2. Transforms the data to match the ai-power-rankings news.json format
3. Saves it to data/incoming/ for manual review and ingestion

Usage:
    python scripts/collect_news.py [options]

Examples:
    # Collect last 7 days of news
    python scripts/collect_news.py
    
    # Collect last 3 days
    python scripts/collect_news.py --days 3
"""

import argparse
import json
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List

# Project root
PROJECT_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
DATA_DIR = PROJECT_ROOT / "data"
INCOMING_DIR = DATA_DIR / "incoming"

# Tool ID mapping
TOOL_ID_MAP = {
    "claude": "claude-code",
    "claude code": "claude-code",
    "gpt": "chatgpt-canvas",
    "chatgpt": "chatgpt-canvas",
    "copilot": "github-copilot",
    "github copilot": "github-copilot",
    "cursor": "cursor",
    "gemini": "gemini-code-assist",
    "llama": "llama",
    "midjourney": "midjourney",
    "stable diffusion": "stable-diffusion",
    "devin": "devin",
    "aider": "aider",
    "cline": "cline",
    "v0": "v0-vercel",
    "windsurf": "windsurf",
    "bolt": "bolt-new",
    "lovable": "lovable",
    "replit": "replit-agent",
    "amazon q": "amazon-q-developer",
    "kiro": "kiro",
}

# News type mapping based on categories
CATEGORY_TO_TYPE_MAP = {
    "product-launch": "product_launch",
    "research": "research_paper",
    "business": "funding",
    "ai-general": "market_analysis",
}


def transform_to_ai_power_rankings_format(collected_data: Dict[str, Any]) -> Dict[str, Any]:
    """Transform collected news to ai-power-rankings format."""
    transformed_articles = []
    
    items = collected_data.get("items", [])
    
    for item in items:
        # Generate unique ID
        article_id = str(uuid.uuid4())
        
        # Extract tools mentioned
        tools_mentioned = []
        title_lower = item.get("title", "").lower()
        summary_lower = item.get("summary", "").lower()
        combined_text = f"{title_lower} {summary_lower}"
        
        # Find tool mentions
        tool_relevance_map = {}
        for keyword, tool_id in TOOL_ID_MAP.items():
            if keyword in combined_text:
                # Determine relevance based on how prominently the tool is mentioned
                if keyword in title_lower:
                    relevance = "primary"
                else:
                    relevance = "mentioned"
                
                if tool_id not in tool_relevance_map or relevance == "primary":
                    tool_relevance_map[tool_id] = relevance
        
        # Convert to tools_mentioned format
        for tool_id, relevance in tool_relevance_map.items():
            tools_mentioned.append({
                "tool_id": tool_id,
                "relevance": relevance,
                "sentiment": "neutral"  # Default to neutral
            })
        
        # Skip if no tools are mentioned
        if not tools_mentioned:
            continue
        
        # Create slug from title
        slug = item.get("title", "").lower()
        slug = "-".join(slug.split()[:8])  # First 8 words
        slug = "".join(c if c.isalnum() or c == "-" else "-" for c in slug)
        slug = "-".join(filter(None, slug.split("-")))  # Remove empty parts
        
        # Determine news type
        category = item.get("category", "ai-general")
        news_type = CATEGORY_TO_TYPE_MAP.get(category, "market_analysis")
        
        # Build article
        article = {
            "id": article_id,
            "slug": f"news-{slug}",
            "title": item.get("title", ""),
            "content": item.get("summary", ""),
            "summary": item.get("summary", "")[:200] + "..." if len(item.get("summary", "")) > 200 else item.get("summary", ""),
            "source": item.get("source", "Unknown"),
            "source_url": item.get("url", ""),
            "tags": ["industry", "ai-coding"],
            "tool_mentions": [tool["tool_id"] for tool in tools_mentioned],  # Simple list format
            "created_at": datetime.now(UTC).isoformat(),
            "updated_at": datetime.now(UTC).isoformat(),
            "date": item.get("published_date", datetime.now(UTC).isoformat())
        }
        
        transformed_articles.append(article)
    
    return {
        "articles": transformed_articles,
        "metadata": {
            "collection_timestamp": collected_data.get("metadata", {}).get("collection_timestamp"),
            "total_articles": len(transformed_articles),
            "sources": collected_data.get("metadata", {}).get("sources", [])
        }
    }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Collect AI news for ai-power-rankings",
        formatter_class=argparse.RawDescriptionHelpFormatter
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
        help="Output file path (default: data/incoming/collected_news_TIMESTAMP.json)"
    )
    
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Also save raw collected data"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print("AI Power Rankings - News Collector")
    print("=" * 60)
    print(f"\nCollecting news from the last {args.days} days")
    
    # Ensure incoming directory exists
    INCOMING_DIR.mkdir(parents=True, exist_ok=True)
    
    # Run the minimal collector
    temp_output = INCOMING_DIR / "temp_collected_news.json"
    
    try:
        # Run the minimal collector
        cmd = [
            sys.executable,
            str(SCRIPTS_DIR / "collect_news_minimal.py"),
            "--days", str(args.days),
            "--output", str(temp_output),
            "--pretty"
        ]
        
        print("\nRunning news collector...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Error running collector: {result.stderr}")
            return 1
        
        # Load collected data
        with open(temp_output, 'r') as f:
            collected_data = json.load(f)
        
        # Transform to ai-power-rankings format
        print("\nTransforming to ai-power-rankings format...")
        transformed_data = transform_to_ai_power_rankings_format(collected_data)
        
        # Determine output path
        if args.output:
            output_path = Path(args.output)
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = INCOMING_DIR / f"collected_news_{timestamp}.json"
        
        # Save transformed data
        with open(output_path, 'w') as f:
            json.dump(transformed_data, f, indent=2, default=str)
        
        print(f"\n✅ Successfully collected and transformed {len(transformed_data['articles'])} news articles")
        print(f"📄 Saved to: {output_path}")
        
        # Save raw data if requested
        if args.raw:
            raw_path = output_path.with_stem(output_path.stem + "_raw")
            with open(raw_path, 'w') as f:
                json.dump(collected_data, f, indent=2, default=str)
            print(f"📄 Raw data saved to: {raw_path}")
        
        # Clean up temp file
        temp_output.unlink()
        
        # Show summary
        print("\nSummary:")
        print(f"  Total articles with tool mentions: {len(transformed_data['articles'])}")
        
        # Count tools mentioned
        tool_counts = {}
        for article in transformed_data['articles']:
            for tool_id in article.get('tool_mentions', []):
                tool_counts[tool_id] = tool_counts.get(tool_id, 0) + 1
        
        print("\n  Tools mentioned:")
        for tool_id, count in sorted(tool_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"    {tool_id}: {count}")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        # Clean up temp file if it exists
        if temp_output.exists():
            temp_output.unlink()
        return 1


if __name__ == "__main__":
    sys.exit(main())