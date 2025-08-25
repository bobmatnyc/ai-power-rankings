#!/usr/bin/env python3
"""
Ingest pending news articles into the AI Power Rankings news system.
This script processes the consolidated news collection and merges it with existing data.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import shutil

def load_json(file_path: Path) -> Dict[str, Any]:
    """Load JSON file safely."""
    if not file_path.exists():
        return {"articles": []}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data: Dict[str, Any], file_path: Path) -> None:
    """Save JSON file with proper formatting."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def merge_articles(existing: List[Dict], new: List[Dict]) -> List[Dict]:
    """Merge new articles with existing ones, avoiding duplicates."""
    existing_ids = {article['id'] for article in existing}
    merged = existing.copy()
    
    for article in new:
        if article['id'] not in existing_ids:
            merged.append(article)
            print(f"  ✅ Added: {article['title'][:60]}...")
        else:
            print(f"  ⏭️  Skipped (duplicate): {article['title'][:60]}...")
    
    # Sort by date descending
    merged.sort(key=lambda x: x.get('date', ''), reverse=True)
    return merged

def update_monthly_files(articles: List[Dict], base_path: Path) -> Dict[str, int]:
    """Update monthly JSON files with new articles."""
    monthly_path = base_path / 'by-month'
    monthly_path.mkdir(exist_ok=True)
    
    # Group articles by month
    articles_by_month = {}
    for article in articles:
        date_str = article.get('date', '')
        if date_str:
            # Extract YYYY-MM from date
            month_key = date_str[:7]  # Gets "2025-08" from "2025-08-07T..."
            if month_key not in articles_by_month:
                articles_by_month[month_key] = []
            articles_by_month[month_key].append(article)
    
    updates = {}
    for month, month_articles in articles_by_month.items():
        file_path = monthly_path / f"{month}.json"
        
        # Load existing or create new
        existing_data = load_json(file_path)
        existing_articles = existing_data.get('articles', [])
        
        # Merge articles
        merged = merge_articles(existing_articles, month_articles)
        
        # Save updated file
        month_data = {
            "month": month,
            "articles": merged,
            "metadata": {
                "total_articles": len(merged),
                "last_updated": datetime.now().isoformat()
            }
        }
        
        save_json(month_data, file_path)
        updates[month] = len(merged)
        print(f"  📅 Updated {month}.json: {len(merged)} total articles")
    
    return updates

def update_article_files(articles: List[Dict], base_path: Path) -> int:
    """Update individual article JSON files."""
    articles_path = base_path / 'articles'
    articles_path.mkdir(exist_ok=True)
    
    count = 0
    for article in articles:
        # Extract year and month from date
        date_str = article.get('date', '')
        if date_str:
            year = date_str[:4]
            month = date_str[5:7]
            
            # Create year/month directory structure
            year_month_path = articles_path / year / month
            year_month_path.mkdir(parents=True, exist_ok=True)
            
            # Save article file
            article_file = year_month_path / f"{article['id']}.json"
            save_json(article, article_file)
            count += 1
    
    return count

def rebuild_index(base_path: Path) -> None:
    """Rebuild the news index file."""
    index_path = base_path / 'index.json'
    
    # Collect all articles from monthly files
    all_articles = []
    monthly_path = base_path / 'by-month'
    
    if monthly_path.exists():
        for month_file in sorted(monthly_path.glob('*.json')):
            month_data = load_json(month_file)
            all_articles.extend(month_data.get('articles', []))
    
    # Sort by date descending
    all_articles.sort(key=lambda x: x.get('date', ''), reverse=True)
    
    # Create index
    index = {
        "total_articles": len(all_articles),
        "last_updated": datetime.now().isoformat(),
        "months": [],
        "recent_articles": all_articles[:10]  # Top 10 most recent
    }
    
    # Add monthly summaries
    monthly_counts = {}
    for article in all_articles:
        date_str = article.get('date', '')
        if date_str:
            month_key = date_str[:7]
            monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1
    
    index["months"] = [
        {"month": month, "count": count}
        for month, count in sorted(monthly_counts.items(), reverse=True)
    ]
    
    save_json(index, index_path)
    print(f"  📚 Rebuilt index.json: {len(all_articles)} total articles")

def main():
    """Main ingestion process."""
    print("=" * 60)
    print("AI Power Rankings - News Ingestion Process")
    print("=" * 60)
    
    # Paths
    project_root = Path('/Users/masa/Projects/managed/ai-power-rankings')
    pending_file = project_root / 'data/incoming/temp-news-review/consolidated-news-collection-2025-08-07.json'
    news_base = project_root / 'data/json/news'
    main_news_file = news_base / 'news.json'
    
    # Step 1: Load pending news
    print("\n📥 Loading pending news...")
    pending_data = load_json(pending_file)
    pending_articles = pending_data.get('articles', [])
    print(f"  Found {len(pending_articles)} pending articles")
    
    if not pending_articles:
        print("  ⚠️  No articles to process")
        return
    
    # Step 2: Load existing main news file
    print("\n📖 Loading existing news data...")
    main_news_data = load_json(main_news_file)
    existing_articles = main_news_data.get('articles', [])
    print(f"  Found {len(existing_articles)} existing articles")
    
    # Step 3: Merge articles
    print("\n🔀 Merging articles...")
    merged_articles = merge_articles(existing_articles, pending_articles)
    
    # Step 4: Update main news file
    print("\n💾 Updating main news file...")
    main_news_data['articles'] = merged_articles
    main_news_data['metadata'] = {
        'total_articles': len(merged_articles),
        'last_updated': datetime.now().isoformat(),
        'sources': list(set(
            article.get('source', 'Unknown') 
            for article in merged_articles
        ))
    }
    
    # Create backup
    backup_file = main_news_file.with_suffix(f'.json.backup-{datetime.now().strftime("%Y%m%d-%H%M%S")}')
    if main_news_file.exists():
        shutil.copy2(main_news_file, backup_file)
        print(f"  📋 Created backup: {backup_file.name}")
    
    save_json(main_news_data, main_news_file)
    print(f"  ✅ Updated news.json: {len(merged_articles)} total articles")
    
    # Step 5: Update monthly files
    print("\n📅 Updating monthly files...")
    monthly_updates = update_monthly_files(pending_articles, news_base)
    
    # Step 6: Update individual article files
    print("\n📄 Creating individual article files...")
    article_count = update_article_files(pending_articles, news_base)
    print(f"  ✅ Created/updated {article_count} article files")
    
    # Step 7: Rebuild index
    print("\n🔍 Rebuilding index...")
    rebuild_index(news_base)
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ INGESTION COMPLETE")
    print("=" * 60)
    print(f"  📊 Total articles in system: {len(merged_articles)}")
    print(f"  🆕 New articles added: {len(merged_articles) - len(existing_articles)}")
    print(f"  📅 Monthly files updated: {list(monthly_updates.keys())}")
    print(f"  📄 Article files created: {article_count}")
    print("=" * 60)

if __name__ == "__main__":
    main()