/**
 * Tavily Search Service
 *
 * Provides AI news discovery using the Tavily Search API.
 * Tavily is optimized for AI/LLM applications with better relevance
 * for technical content and news.
 *
 * @see https://tavily.com/
 */

import { loggers } from '@/lib/logger';

/**
 * Search result structure from Tavily API
 */
export interface TavilySearchResult {
  title: string;
  url: string;
  description: string;
  source: string;
  publishedDate: string | null;
  content?: string;
  score: number;
}

/**
 * Raw result item from Tavily API
 */
interface TavilyApiResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
  published_date?: string;
}

/**
 * Tavily API response structure
 */
interface TavilyApiResponse {
  query: string;
  follow_up_questions?: string[];
  answer?: string;
  images?: string[];
  results: TavilyApiResult[];
  response_time: number;
}

/**
 * Service for discovering AI news using Tavily Search API
 */
export class TavilySearchService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[TavilySearch] No API key configured. Service will not function.');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for AI coding news using Tavily
   *
   * @param options - Search options
   * @returns Promise resolving to array of search results
   */
  async searchAINews(options: {
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    topic?: 'general' | 'news';
    days?: number;
  } = {}): Promise<TavilySearchResult[]> {
    if (!this.apiKey) {
      loggers.api.warn('[TavilySearch] API key not configured, returning empty results');
      return [];
    }

    const {
      maxResults = 20,
      searchDepth = 'advanced',
      includeDomains = [],
      topic = 'news',
      days,
    } = options;

    const results: TavilySearchResult[] = [];

    try {
      // Execute primary query
      const primaryQuery = this.buildAINewsQuery();
      const primaryResults = await this.executeSearch(primaryQuery, {
        maxResults,
        searchDepth,
        includeDomains,
        topic,
        days,
      });
      results.push(...primaryResults);

      // Execute supplementary queries for better coverage
      const supplementaryQueries = this.getSupplementaryQueries();
      for (const query of supplementaryQueries) {
        const supplementaryResults = await this.executeSearch(query, {
          maxResults: 10,
          searchDepth: 'basic',
          includeDomains,
          topic,
          days,
        });
        results.push(...supplementaryResults);
      }

      // Deduplicate by URL
      const seen = new Set<string>();
      const deduplicated = results.filter((result) => {
        if (seen.has(result.url)) {
          return false;
        }
        seen.add(result.url);
        return true;
      });

      loggers.api.info('[TavilySearch] Search completed', {
        totalResults: results.length,
        deduplicatedResults: deduplicated.length,
      });

      return deduplicated;
    } catch (error) {
      loggers.api.error('[TavilySearch] Search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Execute a single search query
   */
  private async executeSearch(
    query: string,
    options: {
      maxResults: number;
      searchDepth: 'basic' | 'advanced';
      includeDomains?: string[];
      topic?: 'general' | 'news';
      days?: number;
    }
  ): Promise<TavilySearchResult[]> {
    const { maxResults, searchDepth, includeDomains = [], topic = 'news', days } = options;

    const requestBody: Record<string, unknown> = {
      api_key: this.apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      topic,
    };

    // Add domain filtering if specified
    if (includeDomains.length > 0) {
      requestBody.include_domains = includeDomains;
    }

    // Add days lookback if specified
    if (days !== undefined) {
      requestBody.days = days;
    }

    loggers.api.debug('[TavilySearch] Executing search', {
      query: query.substring(0, 100) + '...',
      maxResults,
      searchDepth,
      topic,
      days,
    });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
    }

    const data: TavilyApiResponse = await response.json();

    return data.results.map((result) => this.mapToSearchResult(result));
  }

  /**
   * Map Tavily API result to our standard format
   */
  private mapToSearchResult(result: TavilyApiResult): TavilySearchResult {
    // Extract domain from URL
    let source = '';
    try {
      const url = new URL(result.url);
      source = url.hostname.replace('www.', '');
    } catch {
      source = 'unknown';
    }

    return {
      title: result.title || 'Untitled',
      url: result.url,
      description: result.content?.substring(0, 500) || '',
      source,
      publishedDate: result.published_date || null,
      content: result.content,
      score: result.score,
    };
  }

  /**
   * Build the primary AI news query
   */
  private buildAINewsQuery(): string {
    return `AI coding assistant news OR AI code generation tools OR
GitHub Copilot OR Cursor AI OR Claude Code OR Windsurf OR
Devin AI OR Replit Agent OR Amazon Q Developer OR
AI developer tools announcement OR agentic coding 2026`.replace(/\s+/g, ' ').trim();
  }

  /**
   * Get supplementary queries for broader coverage
   * Rotates based on day of week
   */
  private getSupplementaryQueries(): string[] {
    const dayOfWeek = new Date().getDay();

    const allQueries = [
      'AI coding assistant funding startup investment 2026',
      'autonomous coding agent Devin Replit release update',
      '"GitHub Copilot" OR "Cursor" announcement 2026',
      'AI code review tool launch enterprise',
      'SWE-bench coding agent benchmark results',
      'AI pair programming tool VS Code JetBrains',
      'Claude Anthropic developer tools API update',
    ];

    // Return 2 queries based on day of week
    const startIndex = dayOfWeek % allQueries.length;
    return [
      allQueries[startIndex],
      allQueries[(startIndex + 1) % allQueries.length],
    ];
  }

  /**
   * Test the search with a simple query
   */
  async testSearch(query: string): Promise<TavilySearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Tavily API key not configured');
    }

    return this.executeSearch(query, {
      maxResults: 10,
      searchDepth: 'basic',
      topic: 'news',
    });
  }
}

// Singleton instance
let tavilySearchServiceInstance: TavilySearchService | null = null;

/**
 * Get the singleton TavilySearchService instance
 */
export function getTavilySearchService(): TavilySearchService {
  if (!tavilySearchServiceInstance) {
    tavilySearchServiceInstance = new TavilySearchService();
  }
  return tavilySearchServiceInstance;
}
