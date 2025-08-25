#!/usr/bin/env python3
"""
Enhanced news collection script for AI coding tools.
Collects broader AI coding news and maps to relevant tools.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path
import requests
import time
from typing import Any, Dict, List, Optional

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Comprehensive tool mapping
AI_CODING_TOOLS = {
    "claude": ["Claude", "Anthropic Claude", "Claude AI", "Claude Code"],
    "chatgpt": ["ChatGPT", "GPT-4", "GPT-3.5", "OpenAI GPT"],
    "copilot": ["GitHub Copilot", "Copilot", "Microsoft Copilot"],
    "cursor": ["Cursor", "Cursor AI", "Cursor Editor"],
    "gemini": ["Gemini", "Google Gemini", "Bard"],
    "codewhisperer": ["Amazon CodeWhisperer", "CodeWhisperer", "AWS CodeWhisperer"],
    "tabnine": ["Tabnine", "TabNine"],
    "cody": ["Cody", "Sourcegraph Cody"],
    "replit": ["Replit", "Replit AI", "Ghostwriter"],
    "v0": ["v0", "v0.dev", "Vercel v0"],
    "windsurf": ["Windsurf", "Windsurf Editor"],
    "codeium": ["Codeium"],
    "phind": ["Phind", "Phind Code"],
    "aider": ["Aider", "Aider Chat"],
    "continue": ["Continue", "Continue.dev"],
    "qodo": ["Qodo", "Qodo Gen", "CodiumAI"],
    "devin": ["Devin", "Cognition Devin"],
    "codegen": ["CodeGen", "Salesforce CodeGen"],
    "starcoder": ["StarCoder", "HuggingFace StarCoder"],
    "llama": ["Code Llama", "LLaMA", "Meta LLaMA"]
}

# Expanded AI keywords for broader collection
AI_KEYWORDS = [
    # Core AI terms
    "ai", "artificial intelligence", "machine learning", "ml", "llm", "large language model",
    "neural network", "deep learning", "transformer", "gpt", "generative ai", "genai",
    
    # Coding specific
    "ai coding", "code generation", "code assistant", "coding assistant", "ai developer",
    "ai programming", "code completion", "ai pair programming", "developer tools",
    "automated coding", "code automation", "ai ide", "intelligent code",
    
    # Companies and products
    "anthropic", "openai", "microsoft", "google", "amazon", "meta", "github",
    "claude", "chatgpt", "copilot", "gemini", "bard", "codewhisperer",
    
    # Technical terms
    "prompt engineering", "rag", "retrieval augmented", "fine-tuning", "model training",
    "context window", "token", "embedding", "vector database", "langchain",
    
    # Industry terms
    "ai startup", "ai funding", "ai research", "ai breakthrough", "ai announcement",
    "ai competition", "ai benchmark", "ai performance", "ai capability"
]

def search_hackernews_extended(start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
    """Extended HackerNews search with broader criteria and Algolia API."""
    articles = []
    
    try:
        # First, get top stories as before
        logger.info("Fetching HackerNews top stories...")
        top_stories_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
        response = requests.get(top_stories_url)
        story_ids = response.json()[:100]  # Get more stories
        
        for story_id in story_ids:
            story_url = f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json"
            story_response = requests.get(story_url)
            story = story_response.json()
            
            if story and story.get("type") == "story":
                title = story.get("title", "").lower()
                # Check with expanded keywords
                if any(keyword in title for keyword in AI_KEYWORDS):
                    timestamp = story.get("time", 0)
                    pub_date = datetime.fromtimestamp(timestamp, tz=UTC)
                    
                    if start_date <= pub_date <= end_date:
                        articles.append(format_hn_article(story, story_id))
            
            time.sleep(0.1)  # Rate limiting
        
        # Also search using Algolia API for specific queries
        logger.info("Searching HackerNews via Algolia...")
        algolia_base = "https://hn.algolia.com/api/v1/search_by_date"
        
        search_queries = [
            "ai coding", "code assistant", "github copilot", "claude",
            "chatgpt programming", "ai developer tools", "code generation",
            "llm coding", "ai ide", "cursor editor", "windsurf", "codeium"
        ]
        
        for query in search_queries:
            try:
                params = {
                    "query": query,
                    "tags": "story",
                    "numericFilters": f"created_at_i>{int(start_date.timestamp())},created_at_i<{int(end_date.timestamp())}"
                }
                
                response = requests.get(algolia_base, params=params)
                if response.status_code == 200:
                    data = response.json()
                    for hit in data.get("hits", [])[:5]:  # Limit per query
                        article = format_algolia_article(hit)
                        if article and article["id"] not in [a["id"] for a in articles]:
                            articles.append(article)
                
                time.sleep(0.5)  # Rate limiting for Algolia
                
            except Exception as e:
                logger.warning(f"Algolia search failed for '{query}': {e}")
        
    except Exception as e:
        logger.error(f"HackerNews collection error: {e}")
    
    logger.info(f"Collected {len(articles)} articles from HackerNews")
    return articles

def format_hn_article(story: Dict, story_id: int) -> Dict[str, Any]:
    """Format HackerNews story into article format."""
    return {
        "id": f"hn-{story_id}",
        "title": story.get("title", ""),
        "url": story.get("url", f"https://news.ycombinator.com/item?id={story_id}"),
        "published_date": datetime.fromtimestamp(story.get("time", 0), tz=UTC).isoformat(),
        "source": "HackerNews",
        "score": story.get("score", 0),
        "comments": story.get("descendants", 0),
        "text": story.get("text", "")  # Some stories have text content
    }

def format_algolia_article(hit: Dict) -> Optional[Dict[str, Any]]:
    """Format Algolia search result into article format."""
    if not hit.get("title"):
        return None
    
    return {
        "id": f"hn-{hit.get('objectID', '')}",
        "title": hit.get("title", ""),
        "url": hit.get("url", f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"),
        "published_date": hit.get("created_at", ""),
        "source": "HackerNews",
        "score": hit.get("points", 0),
        "comments": hit.get("num_comments", 0),
        "author": hit.get("author", "")
    }

def search_tech_news_apis(start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
    """Search tech news APIs for AI coding content."""
    articles = []
    
    # Dev.to API - developer focused content
    try:
        logger.info("Searching Dev.to for AI coding articles...")
        dev_to_base = "https://dev.to/api/articles"
        
        tags = ["ai", "machinelearning", "github", "copilot", "chatgpt", "claude", "programming"]
        for tag in tags:
            params = {
                "tag": tag,
                "per_page": 10
            }
            
            response = requests.get(dev_to_base, params=params)
            if response.status_code == 200:
                for article in response.json():
                    pub_date = datetime.fromisoformat(article.get("published_at", "").replace("Z", "+00:00"))
                    if start_date <= pub_date <= end_date:
                        articles.append({
                            "id": f"devto-{article.get('id', '')}",
                            "title": article.get("title", ""),
                            "url": article.get("url", ""),
                            "published_date": article.get("published_at", ""),
                            "source": "Dev.to",
                            "description": article.get("description", ""),
                            "tags": article.get("tag_list", [])
                        })
            
            time.sleep(0.3)
            
    except Exception as e:
        logger.warning(f"Dev.to search failed: {e}")
    
    logger.info(f"Collected {len(articles)} articles from tech news APIs")
    return articles

def extract_tool_mentions(text: str) -> List[str]:
    """Extract AI coding tool mentions from text."""
    text_lower = text.lower()
    mentioned_tools = set()
    
    for tool_key, tool_names in AI_CODING_TOOLS.items():
        for tool_name in tool_names:
            if tool_name.lower() in text_lower:
                mentioned_tools.add(tool_names[0])  # Use primary name
                break
    
    # Also check for general AI coding references
    if not mentioned_tools:
        coding_indicators = ["code", "coding", "programming", "developer", "development", "software"]
        ai_indicators = ["ai", "artificial intelligence", "llm", "gpt", "machine learning"]
        
        has_coding = any(ind in text_lower for ind in coding_indicators)
        has_ai = any(ind in text_lower for ind in ai_indicators)
        
        if has_coding and has_ai:
            # Map to relevant tools based on context
            if "microsoft" in text_lower or "github" in text_lower:
                mentioned_tools.add("GitHub Copilot")
            if "google" in text_lower:
                mentioned_tools.add("Gemini")
            if "anthropic" in text_lower:
                mentioned_tools.add("Claude")
            if "openai" in text_lower:
                mentioned_tools.add("ChatGPT")
    
    return list(mentioned_tools)

def categorize_article(article: Dict[str, Any]) -> str:
    """Categorize article based on content."""
    title = article.get("title", "").lower()
    description = article.get("description", "").lower()
    text = article.get("text", "").lower()
    combined = f"{title} {description} {text}"
    
    # Category mapping
    if any(word in combined for word in ["launch", "release", "announce", "unveil", "introduce", "debut"]):
        return "product-launch"
    elif any(word in combined for word in ["research", "study", "paper", "findings", "breakthrough", "discover"]):
        return "research"
    elif any(word in combined for word in ["funding", "investment", "raise", "valuation", "acquire", "merger"]):
        return "business"
    elif any(word in combined for word in ["tutorial", "guide", "how to", "learn", "example", "demo"]):
        return "tutorial"
    elif any(word in combined for word in ["benchmark", "comparison", "versus", "vs", "performance", "speed"]):
        return "comparison"
    elif any(word in combined for word in ["update", "upgrade", "version", "patch", "improvement"]):
        return "update"
    elif any(word in combined for word in ["security", "vulnerability", "breach", "hack", "exploit"]):
        return "security"
    else:
        return "ai-general"

def calculate_relevance_score(article: Dict[str, Any]) -> float:
    """Calculate relevance score for AI coding tools."""
    score = 0.5  # Base score
    
    title = article.get("title", "").lower()
    description = article.get("description", "").lower()
    combined = f"{title} {description}"
    
    # Boost for specific tool mentions
    tools_mentioned = article.get("tools_mentioned", [])
    if tools_mentioned:
        score += 0.2 * min(len(tools_mentioned), 2)
    
    # Boost for coding-specific keywords
    coding_keywords = ["code", "coding", "programming", "developer", "ide", "editor", "compiler"]
    if any(kw in combined for kw in coding_keywords):
        score += 0.2
    
    # Boost for AI-specific keywords
    ai_keywords = ["ai", "llm", "gpt", "artificial intelligence", "machine learning"]
    if any(kw in combined for kw in ai_keywords):
        score += 0.1
    
    # Consider engagement metrics if available
    if "score" in article:
        normalized_score = min(article["score"] / 100, 1.0)
        score = (score + normalized_score) / 2
    
    return min(score, 1.0)

def format_for_ingestion(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format articles for ingestion into the AI Power Rankings system."""
    formatted_items = []
    seen_urls = set()
    
    for article in articles:
        # Skip duplicates
        url = article.get("url", "")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        
        # Extract all text for analysis
        full_text = f"{article.get('title', '')} {article.get('description', '')} {article.get('text', '')}"
        
        # Extract tool mentions
        tools_mentioned = extract_tool_mentions(full_text)
        
        # Categorize
        category = categorize_article(article)
        
        # Calculate relevance
        article["tools_mentioned"] = tools_mentioned
        relevance_score = calculate_relevance_score(article)
        
        # Format for ingestion
        formatted_item = {
            "id": article.get("id", f"news-{hash(url)}"),
            "title": article.get("title", ""),
            "url": url,
            "published_date": article.get("published_date", datetime.now(UTC).isoformat()),
            "source": article.get("source", "Unknown"),
            "category": category,
            "summary": article.get("description", article.get("text", ""))[:500],
            "tools_mentioned": tools_mentioned,
            "relevance_score": relevance_score,
            "engagement": {
                "score": article.get("score", 0),
                "comments": article.get("comments", 0)
            },
            "tags": article.get("tags", [])
        }
        
        # Only include if relevance score is high enough
        if relevance_score >= 0.3:
            formatted_items.append(formatted_item)
    
    # Sort by relevance and date
    formatted_items.sort(key=lambda x: (x["relevance_score"], x["published_date"]), reverse=True)
    
    return formatted_items

def main():
    """Main collection process."""
    print("\n" + "=" * 60)
    print("AI Power Rankings - Expanded News Collection")
    print("=" * 60)
    
    # Set date range for August 7-19, 2025
    end_date = datetime(2025, 8, 19, 23, 59, 59, tzinfo=UTC)
    start_date = datetime(2025, 8, 7, 0, 0, 0, tzinfo=UTC)
    
    print(f"\nCollecting news from {start_date.date()} to {end_date.date()}")
    
    all_articles = []
    
    # Collect from multiple sources
    print("\n1. Collecting from HackerNews...")
    hn_articles = search_hackernews_extended(start_date, end_date)
    all_articles.extend(hn_articles)
    print(f"   Found {len(hn_articles)} articles")
    
    print("\n2. Collecting from tech news APIs...")
    tech_articles = search_tech_news_apis(start_date, end_date)
    all_articles.extend(tech_articles)
    print(f"   Found {len(tech_articles)} articles")
    
    print(f"\nTotal raw articles collected: {len(all_articles)}")
    
    # Format for ingestion
    print("\n3. Processing and filtering articles...")
    formatted_articles = format_for_ingestion(all_articles)
    print(f"   {len(formatted_articles)} articles meet relevance criteria")
    
    # Prepare output
    output_data = {
        "metadata": {
            "collection_timestamp": datetime.now(UTC).isoformat(),
            "collection_period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "sources": ["hackernews", "algolia", "dev.to"],
            "raw_count": len(all_articles),
            "filtered_count": len(formatted_articles)
        },
        "items": formatted_articles
    }
    
    # Save to file
    output_path = Path("expanded_news_aug_2025.json")
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2, default=str)
    
    print(f"\n✅ Successfully processed {len(formatted_articles)} relevant articles")
    print(f"📄 Saved to: {output_path.absolute()}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("COLLECTION SUMMARY")
    print("=" * 60)
    
    # By category
    categories = {}
    for item in formatted_articles:
        cat = item.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1
    
    print("\nArticles by category:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"  {cat:20} {count:3} articles")
    
    # By tool mentions
    tool_counts = {}
    for item in formatted_articles:
        for tool in item.get("tools_mentioned", []):
            tool_counts[tool] = tool_counts.get(tool, 0) + 1
    
    if tool_counts:
        print("\nTool mentions:")
        for tool, count in sorted(tool_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {tool:20} {count:3} mentions")
    
    # By source
    sources = {}
    for item in formatted_articles:
        source = item.get("source", "Unknown")
        sources[source] = sources.get(source, 0) + 1
    
    print("\nArticles by source:")
    for source, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
        print(f"  {source:20} {count:3} articles")
    
    # Top articles by relevance
    print("\nTop 5 most relevant articles:")
    for i, article in enumerate(formatted_articles[:5], 1):
        print(f"\n  {i}. [{article['relevance_score']:.2f}] {article['title'][:60]}...")
        if article.get("tools_mentioned"):
            print(f"     Tools: {', '.join(article['tools_mentioned'])}")
    
    return output_path

if __name__ == "__main__":
    output_file = main()
    print(f"\n🎯 Next step: Review {output_file} and prepare for ingestion")