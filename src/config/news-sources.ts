/**
 * News Sources Configuration
 *
 * Defines RSS feeds and other news sources to crawl for AI coding tool news
 */

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  type: "rss" | "api" | "scraper";
  category: string;
  active: boolean;
  checkInterval?: number; // hours
  filters?: {
    keywords?: string[];
    excludeKeywords?: string[];
  };
}

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "hyperdev-matsuoka",
    name: "HyperDev by Bob Matsuoka",
    url: "https://hyperdev.matsuoka.com/rss",
    type: "rss",
    category: "ai-development",
    active: true,
    checkInterval: 6,
    filters: {
      keywords: [
        "AI",
        "coding",
        "code",
        "developer",
        "programming",
        "LLM",
        "assistant",
        "copilot",
        "cursor",
        "devin",
        "claude",
        "github",
        "IDE",
        "editor",
        "agent",
      ],
      excludeKeywords: ["spam", "advertisement"],
    },
  },
  // Add more RSS feeds here as needed
  {
    id: "techcrunch-ai",
    name: "TechCrunch AI",
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    type: "rss",
    category: "tech-news",
    active: false, // Enable when ready
    checkInterval: 12,
  },
  {
    id: "hackernews-ai",
    name: "Hacker News AI",
    url: "https://hnrss.org/newest?q=AI+coding+OR+copilot+OR+cursor+OR+devin",
    type: "rss",
    category: "community",
    active: false,
    checkInterval: 24,
  },
];

export const ACTIVE_SOURCES = NEWS_SOURCES.filter((source) => source.active);
