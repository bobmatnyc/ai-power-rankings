#!/usr/bin/env python3
"""
Update news.json and monthly indexes with new August 2025 articles
"""

import json
import os
from pathlib import Path
from datetime import datetime

def main():
    # Paths
    base_dir = Path("/Users/masa/Projects/managed/ai-power-rankings")
    news_dir = base_dir / "data/json/news"
    articles_dir = news_dir / "articles/2025/08"
    
    # New article IDs from August 19-25, 2025
    new_article_ids = [
        "claude-opus-4-1-general-availability-2025-08-19",
        "github-copilot-gpt5-integration-2025-08-20",
        "cursor-security-patches-2025-08-21",
        "windsurf-gpt5-pricing-changes-2025-08-22",
        "enterprise-ai-coding-market-report-2025-08-23",
        "continue-open-source-milestone-2025-08-24",
        "aider-deepseek-r1-integration-2025-08-25"
    ]
    
    # Load new articles
    new_articles = []
    for article_id in new_article_ids:
        article_file = articles_dir / f"{article_id}.json"
        if article_file.exists():
            with open(article_file, 'r') as f:
                article = json.load(f)
                new_articles.append(article)
                print(f"Loaded article: {article['title']}")
    
    if not new_articles:
        print("No new articles found to add")
        return
    
    # Update main news.json
    news_file = news_dir / "news.json"
    print(f"\nUpdating {news_file}")
    
    with open(news_file, 'r') as f:
        news_data = json.load(f)
    
    # Add new articles at the beginning (most recent first)
    existing_ids = {article['id'] for article in news_data['articles']}
    
    for article in reversed(new_articles):  # Reverse to maintain chronological order
        if article['id'] not in existing_ids:
            news_data['articles'].insert(0, article)
            print(f"  Added: {article['title']}")
    
    # Sort articles by date (most recent first)
    news_data['articles'].sort(key=lambda x: x['date'], reverse=True)
    
    # Save updated news.json
    with open(news_file, 'w') as f:
        json.dump(news_data, f, indent=2, ensure_ascii=False)
    
    print(f"Updated {news_file} with {len(new_articles)} new articles")
    
    # Update monthly index for August 2025
    monthly_file = news_dir / "by-month/2025-08.json"
    print(f"\nUpdating {monthly_file}")
    
    with open(monthly_file, 'r') as f:
        monthly_data = json.load(f)
    
    # Add new articles to monthly index
    monthly_existing_ids = {article['id'] for article in monthly_data['articles']}
    
    for article in reversed(new_articles):
        if article['id'] not in monthly_existing_ids:
            monthly_data['articles'].insert(0, article)
            print(f"  Added to monthly: {article['title']}")
    
    # Sort monthly articles by date (most recent first)
    monthly_data['articles'].sort(key=lambda x: x['date'], reverse=True)
    
    # Save updated monthly index
    with open(monthly_file, 'w') as f:
        json.dump(monthly_data, f, indent=2, ensure_ascii=False)
    
    print(f"Updated {monthly_file} with {len(new_articles)} new articles")
    
    # Update the main index.json for articles
    articles_index = news_dir / "articles/index.json"
    if articles_index.exists():
        print(f"\nUpdating {articles_index}")
        with open(articles_index, 'r') as f:
            index_data = json.load(f)
        
        # Add references to new articles
        for article in new_articles:
            article_ref = {
                "id": article["id"],
                "slug": article["slug"],
                "date": article["date"],
                "file": f"2025/08/{article['id']}.json"
            }
            # Check if not already in index
            if not any(item['id'] == article['id'] for item in index_data.get('articles', [])):
                if 'articles' not in index_data:
                    index_data['articles'] = []
                index_data['articles'].append(article_ref)
                print(f"  Added to index: {article['id']}")
        
        # Sort by date
        index_data['articles'].sort(key=lambda x: x['date'], reverse=True)
        
        with open(articles_index, 'w') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        
        print(f"Updated articles index with {len(new_articles)} new references")
    
    print("\n✅ All news files updated successfully!")
    print(f"Total new articles added: {len(new_articles)}")

if __name__ == "__main__":
    main()