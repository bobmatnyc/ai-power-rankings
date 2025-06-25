/**
 * Fallback data for when API calls fail
 * This ensures the app remains functional even during database issues
 */

export const FALLBACK_RANKINGS = {
  rankings: [],
  algorithm: {
    version: "v6-news",
    name: "News-Enhanced Rankings",
    date: new Date().toISOString(),
    weights: {
      newsImpact: 0.3,
      baseScore: 0.7,
    },
  },
  stats: {
    total_tools: 0,
    tools_with_news: 0,
    avg_news_boost: 0,
    max_news_impact: 0,
  },
};

export const FALLBACK_TOOLS = {
  docs: [],
  totalDocs: 0,
  limit: 10,
  totalPages: 0,
  page: 1,
  pagingCounter: 0,
  hasPrevPage: false,
  hasNextPage: false,
  prevPage: null,
  nextPage: null,
};

export const FALLBACK_NEWS = {
  items: [],
  totalItems: 0,
  hasMore: false,
};