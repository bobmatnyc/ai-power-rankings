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
    /**
     * #125: when true (and topic is "news"), issues an extra pass with
     * `time_range: 'day'` — Tavily's documented recency filter — ahead of the
     * broader `days`-bounded pass below. Opt-in rather than default-on so
     * every OTHER searchAINews caller (e.g. the admin test-search route)
     * keeps its exact current request shape; the automated-ingestion pipeline
     * is the only caller that turns it on.
     */
    includeRecentPass?: boolean;
  } = {}): Promise<TavilySearchResult[]> {
    if (!this.apiKey) {
      loggers.api.warn('[TavilySearch] API key not configured, returning empty results');
      return [];
    }

    const {
      maxResults = 20,
      // Default to "advanced" depth to preserve historical behavior for all
      // callers of searchAINews. Cost-sensitive callers (e.g. the automated
      // ingestion pipeline) opt into "basic" depth explicitly at the call site,
      // so the cost reduction is scoped to ingestion rather than applied globally.
      searchDepth = 'advanced',
      includeDomains = [],
      topic = 'news',
      days,
      includeRecentPass = false,
    } = options;

    const results: TavilySearchResult[] = [];

    try {
      // #125: recent-first pass. Tavily ranks results by relevance, not
      // recency (confirmed against the current API reference — there is no
      // sort-by-date option), and a same-day story can rank below a more
      // established multi-day-old one on relevance alone, keeping it out of
      // the top `maxResults` entirely rather than merely ranking it lower.
      // `time_range: 'day'` (documented, topic-independent per the API
      // reference) is the provider-supported way to force retrieval of
      // last-24h content instead of hoping relevance ranking surfaces it.
      // This ADDS candidates ahead of the broader pass below rather than
      // narrowing it, so total volume is not reduced — a day with no
      // same-day story still gets the full broader-window result set.
      //
      // #125 (code-critic follow-up on bbf43787): this pass gets its OWN
      // try/catch. It must degrade to "no recency pass" on a transient
      // failure, not abort the primary/supplementary passes below it — the
      // comment above already promised "additive, never narrowing" and a
      // shared try block broke that promise (a failure here previously
      // propagated out of searchAINews entirely, failing the whole run when
      // Brave wasn't configured as a fallback).
      if (includeRecentPass && topic === 'news') {
        try {
          const recentQuery = this.buildAINewsQuery();
          const recentResults = await this.executeSearch(recentQuery, {
            maxResults: 10,
            searchDepth,
            includeDomains,
            topic,
            timeRange: 'day',
          });
          results.push(...recentResults);
        } catch (error) {
          loggers.api.warn('[TavilySearch] Recency pass failed, continuing with broader pass only', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Fall through — the broader days-bounded pass below still runs.
        }
      }

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
      // #125: Tavily's documented recency filter (see the Tavily API
      // reference — `time_range` accepts day/week/month/year and, per its
      // description, is not restricted to topic="news"). Distinct from
      // `days`: this is a discrete bucket, not an arbitrary day count.
      timeRange?: 'day' | 'week' | 'month' | 'year';
    }
  ): Promise<TavilySearchResult[]> {
    const { maxResults, searchDepth, includeDomains = [], topic = 'news', days, timeRange } = options;

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

    // #125: recency filter for the recent-first pass (see searchAINews)
    if (timeRange !== undefined) {
      requestBody.time_range = timeRange;
    }

    loggers.api.debug('[TavilySearch] Executing search', {
      query: query.substring(0, 100) + '...',
      maxResults,
      searchDepth,
      topic,
      days,
      timeRange,
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

    // Cost reduction: issue ONE rotated supplementary query per run instead of
    // two. This trims ~1 Tavily search credit per ingestion run while keeping
    // daily coverage variety — the chosen query still advances by one slot each
    // day (startIndex = dayOfWeek), so across a week the full topic list is
    // still swept. The primary discovery query is unchanged. Reverting is a
    // one-line change (re-add the (startIndex + 1) entry below).
    const startIndex = dayOfWeek % allQueries.length;
    return [allQueries[startIndex]];
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
