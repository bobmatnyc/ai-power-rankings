/**
 * FOR TESTING ONLY - NOT FOR DEVELOPMENT
 *
 * This module provides mock data EXCLUSIVELY for automated testing.
 * Development environment must use a real database connection.
 *
 * Mock data should never be used as a fallback in development mode.
 * If you need rankings data in development, configure a real database:
 * 1. Copy .env.example to .env.local
 * 2. Set DATABASE_URL with your database connection string
 * 3. Visit https://neon.tech to create a free PostgreSQL database
 */

export interface MockRanking {
  rank: number;
  previousRank: number | null;
  rankChange: number;
  changeReason: string;
  tool: {
    id: string;
    slug: string;
    name: string;
    category: string;
    status: string;
    website_url: string;
    description: string;
  };
  total_score: number;
  scores: {
    overall: number;
    base_score: number;
    news_impact: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    news_articles_count: number;
    recent_funding_rounds: number;
    recent_product_launches: number;
    users: number;
    swe_bench_score: number | null;
  };
  tier: "premium" | "standard" | "emerging";
}

export const MOCK_RANKINGS: MockRanking[] = [
  {
    rank: 1,
    previousRank: 1,
    rankChange: 0,
    changeReason: "Maintained leadership through consistent innovation and market adoption",
    tool: {
      id: "chatgpt-4",
      slug: "chatgpt",
      name: "ChatGPT",
      category: "ai-assistant",
      status: "active",
      website_url: "https://chat.openai.com",
      description: "Advanced AI assistant powered by GPT-4 with multimodal capabilities",
    },
    total_score: 95.8,
    scores: {
      overall: 95.8,
      base_score: 92.5,
      news_impact: 12.3,
      agentic_capability: 9.2,
      innovation: 9.5,
    },
    metrics: {
      news_articles_count: 245,
      recent_funding_rounds: 2,
      recent_product_launches: 5,
      users: 180000000,
      swe_bench_score: 48.9,
    },
    tier: "premium",
  },
  {
    rank: 2,
    previousRank: 3,
    rankChange: 1,
    changeReason: "Major improvements in code generation and reasoning capabilities",
    tool: {
      id: "claude-3",
      slug: "claude",
      name: "Claude",
      category: "ai-assistant",
      status: "active",
      website_url: "https://claude.ai",
      description: "Anthropic's helpful, harmless, and honest AI assistant",
    },
    total_score: 94.2,
    scores: {
      overall: 94.2,
      base_score: 90.8,
      news_impact: 10.5,
      agentic_capability: 9.0,
      innovation: 9.3,
    },
    metrics: {
      news_articles_count: 178,
      recent_funding_rounds: 1,
      recent_product_launches: 3,
      users: 50000000,
      swe_bench_score: 45.7,
    },
    tier: "premium",
  },
  {
    rank: 3,
    previousRank: 2,
    rankChange: -1,
    changeReason: "Strong performance but increased competition from other models",
    tool: {
      id: "gemini-ultra",
      slug: "gemini",
      name: "Gemini",
      category: "ai-assistant",
      status: "active",
      website_url: "https://gemini.google.com",
      description: "Google's multimodal AI model with advanced reasoning",
    },
    total_score: 93.5,
    scores: {
      overall: 93.5,
      base_score: 89.2,
      news_impact: 11.2,
      agentic_capability: 8.8,
      innovation: 9.1,
    },
    metrics: {
      news_articles_count: 198,
      recent_funding_rounds: 0,
      recent_product_launches: 4,
      users: 100000000,
      swe_bench_score: 42.3,
    },
    tier: "premium",
  },
  {
    rank: 4,
    previousRank: 5,
    rankChange: 1,
    changeReason: "Significant updates to enterprise features and API capabilities",
    tool: {
      id: "copilot-github",
      slug: "github-copilot",
      name: "GitHub Copilot",
      category: "code-assistant",
      status: "active",
      website_url: "https://github.com/features/copilot",
      description: "AI pair programmer that helps you write code faster",
    },
    total_score: 89.7,
    scores: {
      overall: 89.7,
      base_score: 86.3,
      news_impact: 8.9,
      agentic_capability: 8.5,
      innovation: 8.2,
    },
    metrics: {
      news_articles_count: 142,
      recent_funding_rounds: 0,
      recent_product_launches: 2,
      users: 2000000,
      swe_bench_score: 38.6,
    },
    tier: "premium",
  },
  {
    rank: 5,
    previousRank: 4,
    rankChange: -1,
    changeReason: "Steady progress but slower innovation pace compared to competitors",
    tool: {
      id: "midjourney-v6",
      slug: "midjourney",
      name: "Midjourney",
      category: "image-generator",
      status: "active",
      website_url: "https://www.midjourney.com",
      description: "AI-powered image generation with artistic capabilities",
    },
    total_score: 88.3,
    scores: {
      overall: 88.3,
      base_score: 85.1,
      news_impact: 9.2,
      agentic_capability: 7.5,
      innovation: 8.8,
    },
    metrics: {
      news_articles_count: 156,
      recent_funding_rounds: 1,
      recent_product_launches: 2,
      users: 16000000,
      swe_bench_score: null,
    },
    tier: "premium",
  },
  {
    rank: 6,
    previousRank: 7,
    rankChange: 1,
    changeReason: "New features and improved performance in latest update",
    tool: {
      id: "cursor-ai",
      slug: "cursor",
      name: "Cursor",
      category: "code-assistant",
      status: "active",
      website_url: "https://cursor.sh",
      description: "AI-first code editor built for pair programming with AI",
    },
    total_score: 85.6,
    scores: {
      overall: 85.6,
      base_score: 82.4,
      news_impact: 7.8,
      agentic_capability: 8.2,
      innovation: 8.5,
    },
    metrics: {
      news_articles_count: 89,
      recent_funding_rounds: 2,
      recent_product_launches: 3,
      users: 500000,
      swe_bench_score: 35.2,
    },
    tier: "standard",
  },
  {
    rank: 7,
    previousRank: 6,
    rankChange: -1,
    changeReason: "Strong capabilities but facing increased competition",
    tool: {
      id: "perplexity-ai",
      slug: "perplexity",
      name: "Perplexity AI",
      category: "search-assistant",
      status: "active",
      website_url: "https://www.perplexity.ai",
      description: "AI-powered search engine with real-time information",
    },
    total_score: 84.2,
    scores: {
      overall: 84.2,
      base_score: 81.0,
      news_impact: 8.1,
      agentic_capability: 7.8,
      innovation: 8.0,
    },
    metrics: {
      news_articles_count: 112,
      recent_funding_rounds: 1,
      recent_product_launches: 2,
      users: 10000000,
      swe_bench_score: null,
    },
    tier: "standard",
  },
  {
    rank: 8,
    previousRank: 8,
    rankChange: 0,
    changeReason: "Consistent performance in document and data analysis",
    tool: {
      id: "notion-ai",
      slug: "notion-ai",
      name: "Notion AI",
      category: "productivity",
      status: "active",
      website_url: "https://www.notion.so/product/ai",
      description: "AI-powered workspace for notes, docs, and collaboration",
    },
    total_score: 82.5,
    scores: {
      overall: 82.5,
      base_score: 79.8,
      news_impact: 6.5,
      agentic_capability: 7.2,
      innovation: 7.5,
    },
    metrics: {
      news_articles_count: 78,
      recent_funding_rounds: 0,
      recent_product_launches: 1,
      users: 35000000,
      swe_bench_score: null,
    },
    tier: "standard",
  },
  {
    rank: 9,
    previousRank: 10,
    rankChange: 1,
    changeReason: "Growing adoption in enterprise and improved API offerings",
    tool: {
      id: "cohere-command",
      slug: "cohere",
      name: "Cohere",
      category: "ai-platform",
      status: "active",
      website_url: "https://cohere.com",
      description: "Enterprise AI platform for language understanding",
    },
    total_score: 80.3,
    scores: {
      overall: 80.3,
      base_score: 77.5,
      news_impact: 7.2,
      agentic_capability: 7.5,
      innovation: 7.8,
    },
    metrics: {
      news_articles_count: 92,
      recent_funding_rounds: 1,
      recent_product_launches: 2,
      users: 800000,
      swe_bench_score: 28.4,
    },
    tier: "standard",
  },
  {
    rank: 10,
    previousRank: 9,
    rankChange: -1,
    changeReason: "Solid foundation but slower growth compared to competitors",
    tool: {
      id: "stable-diffusion",
      slug: "stable-diffusion",
      name: "Stable Diffusion",
      category: "image-generator",
      status: "active",
      website_url: "https://stability.ai",
      description: "Open-source image generation model with wide adoption",
    },
    total_score: 79.1,
    scores: {
      overall: 79.1,
      base_score: 76.2,
      news_impact: 6.8,
      agentic_capability: 6.5,
      innovation: 7.9,
    },
    metrics: {
      news_articles_count: 134,
      recent_funding_rounds: 0,
      recent_product_launches: 1,
      users: 10000000,
      swe_bench_score: null,
    },
    tier: "standard",
  },
];

/**
 * Get mock rankings response for testing ONLY
 * @returns Mock rankings response structure matching the API format
 */
export function getMockRankingsResponse() {
  const toolsWithNews = MOCK_RANKINGS.filter(
    (r) => r.metrics.news_articles_count > 0
  ).length;

  const newsImpacts = MOCK_RANKINGS.map((r) => r.scores.news_impact);
  const avgNewsBoost = newsImpacts.reduce((a, b) => a + b, 0) / newsImpacts.length;
  const maxNewsImpact = Math.max(...newsImpacts);

  return {
    rankings: MOCK_RANKINGS,
    algorithm: {
      version: "v1.0-test",
      name: "Test Mock Rankings",
      date: new Date().toISOString(),
      weights: { newsImpact: 0.3, baseScore: 0.7 },
    },
    stats: {
      total_tools: MOCK_RANKINGS.length,
      tools_with_news: toolsWithNews,
      avg_news_boost: avgNewsBoost,
      max_news_impact: maxNewsImpact,
    },
    _source: "test-mock",
    _timestamp: new Date().toISOString(),
    _isTest: true,
    _message: "TEST DATA ONLY - Configure DATABASE_URL for real data.",
  };
}