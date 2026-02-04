/**
 * Brave Search Service
 *
 * Provides AI news discovery using the Brave Search API.
 * Features analyst-style queries targeting tech news sites and AI coding tools,
 * with day-of-week rotation for supplementary queries.
 *
 * @see https://api.search.brave.com/
 */

import { loggers } from '@/lib/logger';

/**
 * Search result structure from Brave Search API
 */
export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  source: string;
  publishedDate: string | null;
  age: string | null;
}

/**
 * Raw result item from Brave Search API
 */
interface BraveApiResultItem {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
  age?: string;
  meta_url?: {
    hostname?: string;
  };
}

/**
 * Raw Brave Search API response structure
 */
interface BraveApiResponse {
  web?: {
    results?: BraveApiResultItem[];
  };
}

/**
 * Days of the week for query rotation
 */
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Service for discovering AI news using Brave Search API
 */
export class BraveSearchService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[BraveSearch] No API key configured. Service will not function.');
    }
  }

  /**
   * Search for AI news using primary and supplementary queries
   *
   * @param freshness - Search freshness: 'pd' (past day) or 'pw' (past week)
   * @returns Promise resolving to array of search results
   */
  async searchAINews(freshness: 'pd' | 'pw' = 'pd'): Promise<BraveSearchResult[]> {
    if (!this.apiKey) {
      loggers.api.warn('[BraveSearch] API key not configured, returning empty results');
      return [];
    }

    const results: BraveSearchResult[] = [];

    try {
      // Execute primary query
      const primaryQuery = this.buildAnalystQuery();
      const primaryResults = await this.executeSearch(primaryQuery, freshness);
      results.push(...primaryResults);

      // Execute supplementary queries
      const supplementaryQueries = this.getSupplementaryQueries();
      for (const query of supplementaryQueries) {
        const supplementaryResults = await this.executeSearch(query, freshness);
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

      loggers.api.info('[BraveSearch] Search completed', {
        totalResults: deduplicated.length,
        freshness,
      });

      return deduplicated;
    } catch (error) {
      loggers.api.error('[BraveSearch] Search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        freshness,
      });
      return [];
    }
  }

  /**
   * Build the primary analyst-style query targeting tech news sites and AI coding tools
   *
   * @returns Primary search query string
   */
  buildAnalystQuery(): string {
    return 'AI coding tools news announcements launches updates site:techcrunch.com OR site:theverge.com OR site:arstechnica.com OR site:venturebeat.com OR site:wired.com OR "GitHub Copilot" OR "Cursor" OR "Claude Code" OR "Windsurf" OR "Devin" OR "Replit" OR "Codeium"';
  }

  /**
   * Get supplementary queries based on the current day of week
   *
   * @returns Array of supplementary query strings
   */
  getSupplementaryQueries(): string[] {
    const dayOfWeek = this.getCurrentDayOfWeek();

    const supplementaryQueryMap: Record<DayOfWeek, string[]> = {
      monday: ['"GitHub Copilot" OR "Cursor" OR "Claude Code" announcement 2026'],
      tuesday: ['AI code assistant funding startup investment'],
      wednesday: ['autonomous coding agent Devin Replit release update'],
      thursday: ['AI developer tools benchmark SWE-bench evaluation'],
      friday: ['Anthropic OpenAI coding assistant API update'],
      saturday: [this.buildAnalystQuery()],
      sunday: [this.buildAnalystQuery()],
    };

    return supplementaryQueryMap[dayOfWeek];
  }

  /**
   * Execute a single search query against Brave Search API
   *
   * @param query - Search query string
   * @param freshness - Search freshness parameter
   * @returns Promise resolving to array of search results
   */
  private async executeSearch(
    query: string,
    freshness: 'pd' | 'pw'
  ): Promise<BraveSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        freshness,
        count: '20',
        result_filter: 'web',
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        loggers.api.error('[BraveSearch] API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200),
          query: query.substring(0, 100),
        });
        return [];
      }

      const data: BraveApiResponse = await response.json();

      if (!data.web?.results || !Array.isArray(data.web.results)) {
        loggers.api.warn('[BraveSearch] No results in response', {
          query: query.substring(0, 100),
        });
        return [];
      }

      return data.web.results.map((result) => this.mapToSearchResult(result));
    } catch (error) {
      loggers.api.error('[BraveSearch] Execute search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: query.substring(0, 100),
      });
      return [];
    }
  }

  /**
   * Map Brave API result to BraveSearchResult interface
   *
   * @param result - Raw result from Brave API
   * @returns Mapped BraveSearchResult
   */
  private mapToSearchResult(result: BraveApiResultItem): BraveSearchResult {
    // Extract source from hostname
    let source = 'Unknown';
    if (result.meta_url?.hostname) {
      source = result.meta_url.hostname.replace('www.', '');
    } else if (result.url) {
      try {
        const urlObj = new URL(result.url);
        source = urlObj.hostname.replace('www.', '');
      } catch {
        // Keep default 'Unknown'
      }
    }

    return {
      title: result.title || 'Untitled',
      url: result.url || '',
      description: result.description || '',
      source,
      publishedDate: result.page_age || null,
      age: result.age || null,
    };
  }

  /**
   * Get the current day of week in lowercase
   *
   * @returns Current day of week
   */
  private getCurrentDayOfWeek(): DayOfWeek {
    const days: DayOfWeek[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayIndex = new Date().getDay();
    return days[dayIndex];
  }

  /**
   * Check if the Brave Search service is available and configured
   *
   * @returns True if service is configured and ready to use
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

/**
 * Singleton instance for application-wide use
 */
let braveSearchServiceInstance: BraveSearchService | null = null;

/**
 * Get or create Brave Search service instance
 *
 * @returns Singleton Brave Search service
 */
export function getBraveSearchService(): BraveSearchService {
  if (!braveSearchServiceInstance) {
    braveSearchServiceInstance = new BraveSearchService();
  }
  return braveSearchServiceInstance;
}
