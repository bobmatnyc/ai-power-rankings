/**
 * Jina.ai Reader Service
 *
 * Provides intelligent web scraping and article content extraction using Jina.ai Reader API.
 * Extracts clean content and metadata from URLs without dealing with HTML parsing.
 *
 * Features:
 * - Clean markdown content extraction
 * - Metadata extraction (title, author, published date, description)
 * - 30-second timeout for reliability
 * - Comprehensive error handling
 * - Health check capability
 *
 * @see https://jina.ai/reader
 */

export interface JinaReaderMetadata {
  title?: string;
  author?: string;
  publishedDate?: string;
  source?: string;
  description?: string;
  url?: string;
}

export interface JinaReaderResponse {
  content: string;
  metadata: JinaReaderMetadata;
  isPartialContent?: boolean; // Flag for when we had to use fallback content
}

export interface JinaReaderError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Service for fetching and extracting article content using Jina.ai Reader API
 */
export class JinaReaderService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://r.jina.ai";
  private readonly timeout = 30000; // 30 seconds

  constructor(apiKey?: string) {
    // Allow passing API key or use environment variable
    this.apiKey = apiKey || process.env.JINA_API_KEY || "";

    if (!this.apiKey) {
      console.warn("[JinaReader] No API key configured. Service will not function.");
    }
  }

  /**
   * Fetch article content and metadata from a URL
   *
   * @param url - The URL to fetch content from
   * @param retryCount - Internal retry counter (default: 0)
   * @returns Promise resolving to content and metadata
   * @throws Error if fetch fails or API returns error
   */
  async fetchArticle(url: string, retryCount = 0): Promise<JinaReaderResponse> {
    if (!this.apiKey) {
      throw new Error("Jina.ai API key is not configured");
    }

    console.log("[JinaReader] Fetching article from:", url, retryCount > 0 ? `(retry ${retryCount})` : "");

    try {
      // Construct Jina Reader URL
      const jinaUrl = `${this.baseUrl}/${url}`;

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(jinaUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Accept": "application/json",
            "X-Return-Format": "json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle 401/403 errors with retry logic
        if (response.status === 401 || response.status === 403) {
          const errorText = await response.text();
          console.error(`[JinaReader] API blocked (${response.status}):`, errorText);

          // Retry up to 2 times with exponential backoff
          if (retryCount < 2) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
            console.log(`[JinaReader] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.fetchArticle(url, retryCount + 1);
          }

          throw new Error(
            `Jina.ai blocked by source (${response.status}): ${response.statusText}`
          );
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[JinaReader] API error (${response.status}):`, errorText);

          throw new Error(
            `Jina.ai API error (${response.status}): ${response.statusText}`
          );
        }

        const data = await response.json();

        // Extract content and metadata from Jina response
        const content = this.extractContent(data);
        const metadata = this.extractMetadata(data, url);

        console.log("[JinaReader] Successfully fetched article:", {
          contentLength: content.length,
          title: metadata.title,
          source: metadata.source,
        });

        return {
          content,
          metadata,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Jina.ai API timeout after ${this.timeout}ms`);
        }

        throw error;
      }
    } catch (error) {
      console.error("[JinaReader] Fetch error:", error);

      if (error instanceof Error) {
        throw new Error(`Failed to fetch article with Jina.ai: ${error.message}`);
      }

      throw new Error("Failed to fetch article with Jina.ai: Unknown error");
    }
  }

  /**
   * Extract clean content from Jina API response
   *
   * @param data - Raw Jina API response
   * @returns Extracted content string
   */
  private extractContent(data: any): string {
    // Jina Reader returns content in different formats
    // Try different field names based on API version
    let content =
      data.content ||
      data.data?.content ||
      data.text ||
      data.data?.text ||
      "";

    // If content is markdown, it's already clean
    // Otherwise, apply basic cleanup
    if (typeof content === "string") {
      content = content.trim();

      // Limit to 10k characters for processing
      if (content.length > 10000) {
        content = content.substring(0, 10000);
        console.log("[JinaReader] Content truncated to 10k characters");
      }
    }

    return content;
  }

  /**
   * Extract metadata from Jina API response
   *
   * @param data - Raw Jina API response
   * @param originalUrl - Original URL requested
   * @returns Extracted metadata
   */
  private extractMetadata(data: any, originalUrl: string): JinaReaderMetadata {
    const metadata: JinaReaderMetadata = {
      url: originalUrl,
    };

    // Extract metadata fields from response
    // Jina Reader may return metadata in different locations
    const meta = data.metadata || data.data?.metadata || data;

    if (meta.title) {
      metadata.title = String(meta.title).trim();
    }

    if (meta.author || meta.byline) {
      metadata.author = String(meta.author || meta.byline).trim();
    }

    if (meta.publishedDate || meta.published_time || meta.date_published) {
      const dateStr = String(
        meta.publishedDate || meta.published_time || meta.date_published
      );
      metadata.publishedDate = this.normalizeDate(dateStr);
    }

    if (meta.description || meta.excerpt) {
      metadata.description = String(meta.description || meta.excerpt).trim();
    }

    // Extract source from URL if not provided
    if (meta.site_name || meta.source) {
      metadata.source = String(meta.site_name || meta.source).trim();
    } else {
      try {
        const urlObj = new URL(originalUrl);
        metadata.source = urlObj.hostname.replace("www.", "");
      } catch {
        metadata.source = "Unknown";
      }
    }

    return metadata;
  }

  /**
   * Normalize date string to ISO format (YYYY-MM-DD)
   *
   * @param dateStr - Date string in various formats
   * @returns Normalized date string or original if parsing fails
   */
  private normalizeDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
      }
    } catch {
      // Return original if parsing fails
    }

    return dateStr;
  }

  /**
   * Check if the Jina.ai Reader service is available and configured
   *
   * @returns True if service is configured and ready to use
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Perform a health check on the Jina.ai Reader service
   *
   * @returns Promise resolving to true if service is healthy
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // Try to fetch a simple, reliable URL
      const testUrl = "https://example.com";
      await this.fetchArticle(testUrl);
      return true;
    } catch (error) {
      console.error("[JinaReader] Health check failed:", error);
      return false;
    }
  }
}

/**
 * Create a singleton instance for the application
 */
export const jinaReaderService = new JinaReaderService();
