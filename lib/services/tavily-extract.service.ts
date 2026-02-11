/**
 * Tavily Extract Service
 *
 * Provides webpage content extraction using the Tavily Extract API.
 * Tavily Extract is optimized for clean, structured content extraction
 * with intelligent content parsing and markdown formatting.
 *
 * @see https://docs.tavily.com/documentation/api-reference/endpoint/extract
 */

import { loggers } from '@/lib/logger';

/**
 * Result from Tavily Extract API for a single URL
 */
export interface TavilyExtractResult {
  url: string;
  raw_content?: string;
  images?: string[];
  favicon?: string;
}

/**
 * Failed extraction result
 */
export interface TavilyExtractFailedResult {
  url: string;
  error: string;
}

/**
 * Tavily Extract API response
 */
interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results?: TavilyExtractFailedResult[];
  response_time: number;
  usage?: {
    credits: number;
  };
  request_id: string;
}

/**
 * Options for extracting content
 */
export interface TavilyExtractOptions {
  query?: string;
  chunks_per_source?: number; // 1-5, default: 3
  extract_depth?: 'basic' | 'advanced';
  include_images?: boolean;
  include_favicon?: boolean;
  format?: 'markdown' | 'text';
  timeout?: number; // 1.0-60.0 seconds
  include_usage?: boolean;
}

/**
 * Service for extracting webpage content using Tavily Extract API
 */
export class TavilyExtractService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/extract';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';

    if (!this.apiKey) {
      loggers.api.warn('[TavilyExtract] No API key configured. Service will not function.');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Extract content from a single URL with retry logic
   *
   * @param url - URL to extract content from
   * @param options - Extraction options
   * @returns Promise resolving to extracted content or null on failure
   */
  async extractContent(
    url: string,
    options: TavilyExtractOptions = {}
  ): Promise<string | null> {
    if (!this.apiKey) {
      loggers.api.warn('[TavilyExtract] API key not configured, cannot extract content');
      return null;
    }

    const {
      extract_depth = 'basic',
      format = 'markdown',
      timeout = 10,
      chunks_per_source = 5,
    } = options;

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        loggers.api.info('[TavilyExtract] Attempting content extraction', {
          url: url.substring(0, 100),
          attempt,
          maxRetries: this.maxRetries,
          extract_depth,
          format,
        });

        const requestBody: Record<string, unknown> = {
          api_key: this.apiKey,
          urls: [url],
          extract_depth,
          format,
          timeout,
          chunks_per_source,
          include_images: options.include_images ?? false,
          include_favicon: options.include_favicon ?? false,
          include_usage: options.include_usage ?? false,
        };

        // Add optional query if provided
        if (options.query) {
          requestBody['query'] = options.query;
        }

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Tavily Extract API error: ${response.status} - ${errorText}`);
        }

        const data: TavilyExtractResponse = await response.json();

        // Check if extraction succeeded
        if (data.results && data.results.length > 0 && data.results[0].raw_content) {
          const content = data.results[0].raw_content;

          loggers.api.info('[TavilyExtract] Content extraction successful', {
            url: url.substring(0, 100),
            contentLength: content.length,
            attempt,
            responseTime: data.response_time,
          });

          return content;
        }

        // Check for failed results
        if (data.failed_results && data.failed_results.length > 0) {
          const failedResult = data.failed_results[0];
          throw new Error(`Extraction failed: ${failedResult.error}`);
        }

        // No content extracted
        loggers.api.warn('[TavilyExtract] No content extracted', {
          url: url.substring(0, 100),
          attempt,
        });

        return null;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        loggers.api.warn('[TavilyExtract] Extraction attempt failed', {
          url: url.substring(0, 100),
          attempt,
          maxRetries: this.maxRetries,
          error: errorMessage,
        });

        // Don't retry on certain errors
        if (
          errorMessage.includes('404') ||
          errorMessage.includes('invalid url') ||
          errorMessage.includes('api key')
        ) {
          loggers.api.info('[TavilyExtract] Non-retryable error, stopping attempts', {
            url: url.substring(0, 100),
            error: errorMessage,
          });
          return null;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          loggers.api.info('[TavilyExtract] Waiting before retry', {
            url: url.substring(0, 100),
            delayMs: delay,
            nextAttempt: attempt + 1,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    loggers.api.error('[TavilyExtract] All extraction attempts failed', {
      url: url.substring(0, 100),
      attempts: this.maxRetries,
      finalError: lastError?.message ?? 'Unknown error',
    });

    return null;
  }

  /**
   * Extract content from multiple URLs (batch operation)
   *
   * @param urls - Array of URLs to extract content from
   * @param options - Extraction options
   * @returns Promise resolving to array of results (null for failed extractions)
   */
  async extractBatch(
    urls: string[],
    options: TavilyExtractOptions = {}
  ): Promise<Array<{ url: string; content: string | null }>> {
    if (!this.apiKey) {
      loggers.api.warn('[TavilyExtract] API key not configured, cannot extract content');
      return urls.map((url) => ({ url, content: null }));
    }

    loggers.api.info('[TavilyExtract] Batch extraction started', {
      urlCount: urls.length,
    });

    // Extract content from each URL sequentially to respect rate limits
    const results: Array<{ url: string; content: string | null }> = [];

    for (const url of urls) {
      const content = await this.extractContent(url, options);
      results.push({ url, content });
    }

    const successCount = results.filter((r) => r.content !== null).length;
    loggers.api.info('[TavilyExtract] Batch extraction completed', {
      urlCount: urls.length,
      successCount,
      failureCount: urls.length - successCount,
    });

    return results;
  }
}

// Singleton instance - lazily created on first access
let _tavilyExtractServiceInstance: TavilyExtractService | null = null;

/**
 * Get or create TavilyExtractService singleton instance
 * @returns Singleton TavilyExtractService instance
 */
export function getTavilyExtractService(): TavilyExtractService {
  if (!_tavilyExtractServiceInstance) {
    _tavilyExtractServiceInstance = new TavilyExtractService();
  }
  return _tavilyExtractServiceInstance;
}

// Export singleton for convenience
export const tavilyExtractService = getTavilyExtractService();
