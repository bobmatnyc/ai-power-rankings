/**
 * Automated Ingestion Orchestrator Service
 * Coordinates the daily news ingestion pipeline:
 * 1. Creates ingestion run record
 * 2. Discovers articles via BraveSearchService
 * 3. Filters duplicates via existing articles
 * 4. Assesses quality via ArticleQualityService
 * 5. Ingests passing articles via ArticleIngestionService
 * 6. Updates run record with metrics
 */

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import {
  automatedIngestionRuns,
  articles,
  type AutomatedIngestionRun,
  type IngestionRunType,
} from "@/lib/db/schema";
import { ArticleIngestionService } from "./article-ingestion.service";
import { BraveSearchService, type BraveSearchResult } from "./brave-search.service";
import { TavilySearchService, type TavilySearchResult } from "./tavily-search.service";
import {
  ArticleQualityService,
  type QualityAssessment,
  type ArticleToAssess,
} from "./article-quality.service";
import { loggers } from "@/lib/logger";

// Unified search result type
type SearchResult = BraveSearchResult | TavilySearchResult;

// Re-export types for consumers
export type { IngestionRunType } from "@/lib/db/schema";

/**
 * Result of an ingestion run
 */
export interface IngestionResult {
  runId: string;
  status: "completed" | "failed" | "partial";
  articlesDiscovered: number;
  articlesPassedQuality: number;
  articlesIngested: number;
  articlesSkipped: number;
  rankingChanges: number;
  estimatedCostUsd: number;
  errors: string[];
  ingestedArticleIds: string[];
  durationMs: number;
}

/**
 * Options for running daily discovery
 */
export interface DailyDiscoveryOptions {
  dryRun?: boolean;
  maxArticles?: number;
  qualityThreshold?: number;
  skipQualityCheck?: boolean; // Skip LLM quality assessment for faster testing
}

/**
 * Internal search result with fetched content for quality assessment
 */
interface SearchResultWithContent {
  url: string;
  title: string;
  description: string;
  source: string;
  publishedDate: string | null;
  content: string;
}

/**
 * Automated Ingestion Orchestrator
 * Coordinates the daily news ingestion pipeline
 */
export class AutomatedIngestionService {
  // Lazy-initialized service backing fields (null until first use)
  private _tavilySearchService: TavilySearchService | null = null;
  private _braveSearchService: BraveSearchService | null = null;
  private _articleQualityService: ArticleQualityService | null = null;
  private _articleIngestionService: ArticleIngestionService | null = null;

  // Lazy getters - services are created on first use, not at import time
  private get tavilySearchService(): TavilySearchService {
    if (!this._tavilySearchService) {
      this._tavilySearchService = new TavilySearchService();
    }
    return this._tavilySearchService;
  }

  private get braveSearchService(): BraveSearchService {
    if (!this._braveSearchService) {
      this._braveSearchService = new BraveSearchService();
    }
    return this._braveSearchService;
  }

  private get articleQualityService(): ArticleQualityService {
    if (!this._articleQualityService) {
      this._articleQualityService = new ArticleQualityService();
    }
    return this._articleQualityService;
  }

  private get articleIngestionService(): ArticleIngestionService {
    if (!this._articleIngestionService) {
      this._articleIngestionService = new ArticleIngestionService();
    }
    return this._articleIngestionService;
  }

  // Empty constructor - no eager initialization
  constructor() {
    // Services are lazily initialized via getters when first accessed
  }

  /**
   * Fetch article content from URL for quality assessment
   * Returns null if content cannot be fetched
   */
  private async fetchArticleContent(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        loggers.api.warn("[AutomatedIngestion] Failed to fetch article", {
          url: url.substring(0, 100),
          status: response.status,
        });
        return null;
      }

      const html = await response.text();

      // Basic content extraction - strip HTML tags and get text
      // In production, consider using a proper HTML parser like cheerio
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 8000); // Limit content length

      return textContent || null;
    } catch (error) {
      loggers.api.warn("[AutomatedIngestion] Error fetching article content", {
        url: url.substring(0, 100),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Run daily discovery pipeline
   * Main orchestration method that coordinates the entire ingestion flow
   */
  async runDailyDiscovery(options?: DailyDiscoveryOptions): Promise<IngestionResult> {
    const startTime = Date.now();
    const isDryRun = options?.dryRun ?? false;
    const maxArticles = options?.maxArticles ?? 20;

    loggers.api.info("[AutomatedIngestion] Starting daily discovery", {
      dryRun: isDryRun,
      maxArticles,
    });

    const errors: string[] = [];
    const ingestedArticleIds: string[] = [];
    let articlesDiscovered = 0;
    let articlesPassedQuality = 0;
    let articlesIngested = 0;
    let articlesSkipped = 0;
    let rankingChanges = 0;
    let estimatedCostUsd = 0;
    let runId = "";

    try {
      // Step 1: Create ingestion run record (skip in dry run)
      if (!isDryRun) {
        runId = await this.createRun("daily_news");
        loggers.api.info("[AutomatedIngestion] Created run record", { runId });
      } else {
        runId = `dry-run-${Date.now()}`;
        loggers.api.info("[AutomatedIngestion] Dry run mode - no database record created");
      }

      // Check if search service is available (prefer Tavily, fallback to Brave)
      const useTavily = this.tavilySearchService.isConfigured();
      const useBrave = this.braveSearchService.isAvailable();

      if (!useTavily && !useBrave) {
        const errorMsg = "No search API configured (Tavily or Brave) - cannot discover articles";
        loggers.api.error("[AutomatedIngestion] " + errorMsg);
        errors.push(errorMsg);

        const result: IngestionResult = {
          runId,
          status: "failed",
          articlesDiscovered: 0,
          articlesPassedQuality: 0,
          articlesIngested: 0,
          articlesSkipped: 0,
          rankingChanges: 0,
          estimatedCostUsd: 0,
          errors,
          ingestedArticleIds: [],
          durationMs: Date.now() - startTime,
        };

        if (!isDryRun && runId && !runId.startsWith("dry-run")) {
          await this.updateRun(runId, result);
        }

        return result;
      }

      // Step 2: Search for AI news articles (Tavily preferred, Brave fallback)
      loggers.api.info("[AutomatedIngestion] Searching for AI news articles...", {
        searchEngine: useTavily ? "Tavily" : "Brave",
      });

      let searchResults: SearchResult[];
      if (useTavily) {
        searchResults = await this.tavilySearchService.searchAINews({
          maxResults: 20,
          searchDepth: "advanced",
          topic: "news",
        });
      } else {
        searchResults = await this.braveSearchService.searchAINews("pd");
      }

      articlesDiscovered = searchResults.length;
      loggers.api.info("[AutomatedIngestion] Discovered articles", {
        count: articlesDiscovered,
        searchEngine: useTavily ? "Tavily" : "Brave",
      });

      if (articlesDiscovered === 0) {
        loggers.api.info("[AutomatedIngestion] No articles discovered, completing run");
        const result: IngestionResult = {
          runId,
          status: "completed",
          articlesDiscovered: 0,
          articlesPassedQuality: 0,
          articlesIngested: 0,
          articlesSkipped: 0,
          rankingChanges: 0,
          estimatedCostUsd: 0,
          errors: [],
          ingestedArticleIds: [],
          durationMs: Date.now() - startTime,
        };

        if (!isDryRun) {
          await this.updateRun(runId, result);
        }

        return result;
      }

      // Step 3: Filter duplicates
      const urls = searchResults.map((r) => r.url);
      const existingUrls = await this.checkDuplicates(urls);
      const newArticles = searchResults.filter((r) => !existingUrls.has(r.url));
      articlesSkipped = searchResults.length - newArticles.length;
      loggers.api.info("[AutomatedIngestion] Filtered duplicates", {
        duplicates: articlesSkipped,
        newArticles: newArticles.length,
      });

      if (newArticles.length === 0) {
        loggers.api.info("[AutomatedIngestion] All articles are duplicates, completing run");
        const result: IngestionResult = {
          runId,
          status: "completed",
          articlesDiscovered,
          articlesPassedQuality: 0,
          articlesIngested: 0,
          articlesSkipped,
          rankingChanges: 0,
          estimatedCostUsd: 0,
          errors: [],
          ingestedArticleIds: [],
          durationMs: Date.now() - startTime,
        };

        if (!isDryRun) {
          await this.updateRun(runId, result);
        }

        return result;
      }

      // Step 4: Prepare articles with content for quality assessment
      // Tavily results already include content, so we can skip fetching for those
      loggers.api.info("[AutomatedIngestion] Preparing article content for quality assessment...");
      const articlesWithContent: SearchResultWithContent[] = [];

      for (const article of newArticles.slice(0, maxArticles * 2)) {
        // Check if article already has content (from Tavily)
        const tavilyContent = (article as TavilySearchResult).content;

        if (tavilyContent && tavilyContent.length > 100) {
          // Use Tavily's pre-fetched content
          articlesWithContent.push({
            url: article.url,
            title: article.title,
            description: article.description,
            source: article.source,
            publishedDate: article.publishedDate,
            content: tavilyContent,
          });
        } else {
          // Fallback: fetch content for Brave Search results
          const content = await this.fetchArticleContent(article.url);
          if (content) {
            articlesWithContent.push({
              url: article.url,
              title: article.title,
              description: article.description,
              source: article.source,
              publishedDate: article.publishedDate,
              content,
            });
          }
        }
      }

      loggers.api.info("[AutomatedIngestion] Prepared content for articles", {
        count: articlesWithContent.length,
        usedTavilyContent: useTavily,
      });

      if (articlesWithContent.length === 0) {
        loggers.api.warn("[AutomatedIngestion] Could not fetch content for any articles");
        const result: IngestionResult = {
          runId,
          status: "completed",
          articlesDiscovered,
          articlesPassedQuality: 0,
          articlesIngested: 0,
          articlesSkipped: articlesSkipped + newArticles.length,
          rankingChanges: 0,
          estimatedCostUsd: 0,
          errors: ["Could not fetch content for any discovered articles"],
          ingestedArticleIds: [],
          durationMs: Date.now() - startTime,
        };

        if (!isDryRun) {
          await this.updateRun(runId, result);
        }

        return result;
      }

      // Step 5: Quality assessment (can be skipped for testing)
      let passingArticles: SearchResultWithContent[];

      if (options.skipQualityCheck) {
        // Skip LLM quality check - accept all articles (for testing)
        loggers.api.info("[AutomatedIngestion] Skipping quality assessment (skipQualityCheck=true)");
        passingArticles = articlesWithContent;
        articlesPassedQuality = articlesWithContent.length;
      } else {
        // Convert to ArticleToAssess format for quality service
        const articlesToAssess: ArticleToAssess[] = articlesWithContent.map((a) => ({
          title: a.title,
          content: a.content,
          source: a.source,
          url: a.url,
          publishedAt: a.publishedDate ? new Date(a.publishedDate) : undefined,
        }));

        loggers.api.info("[AutomatedIngestion] Assessing article quality...", {
          articleCount: articlesToAssess.length,
        });
        const qualityResults: QualityAssessment[] = await this.articleQualityService.batchAssess(
          articlesToAssess
        );

        // Sum up quality assessment costs
        estimatedCostUsd += qualityResults.reduce((sum, r) => sum + r.estimatedCost, 0);

        // Filter to passing articles
        passingArticles = articlesWithContent.filter((_, index) => {
          return qualityResults[index]?.shouldIngest === true;
        });
        articlesPassedQuality = passingArticles.length;

        loggers.api.info("[AutomatedIngestion] Quality assessment complete", {
          passed: articlesPassedQuality,
          rejected: articlesWithContent.length - articlesPassedQuality,
        });
      }

      // Limit to maxArticles
      const articlesToIngest = passingArticles.slice(0, maxArticles);

      // Step 5: Ingest each passing article
      loggers.api.info("[AutomatedIngestion] Ingesting articles", {
        count: articlesToIngest.length,
        dryRun: isDryRun,
      });

      for (const article of articlesToIngest) {
        try {
          const ingestionResult = await this.articleIngestionService.ingestArticle({
            type: "url",
            input: article.url,
            dryRun: isDryRun,
            metadata: {
              publishedDate: article.publishedDate || undefined,
            },
          });

          if (isDryRun) {
            // In dry run, we get a DryRunResult
            const dryResult = ingestionResult as {
              predictedChanges?: { rankChange?: number }[];
            };
            rankingChanges += dryResult.predictedChanges?.length ?? 0;
          } else {
            // In full ingestion, we get an Article with id
            const fullResult = ingestionResult as { id: string };
            if (fullResult.id) {
              ingestedArticleIds.push(fullResult.id);
              articlesIngested++;
            }
          }

          // Add ingestion cost estimate (~$0.003 per article for AI analysis)
          estimatedCostUsd += 0.003;
        } catch (error) {
          const errorMsg = `Failed to ingest ${article.url}: ${error instanceof Error ? error.message : "Unknown error"}`;
          loggers.api.error("[AutomatedIngestion] " + errorMsg);
          errors.push(errorMsg);
          // Continue with next article even if one fails
        }
      }

      // If dry run, count all passed articles as "ingested" for reporting
      if (isDryRun) {
        articlesIngested = articlesToIngest.length;
      }

      // Determine final status
      const hasErrors = errors.length > 0;
      const hasIngested = articlesIngested > 0;
      let status: "completed" | "failed" | "partial";

      if (!hasErrors && hasIngested) {
        status = "completed";
      } else if (hasErrors && hasIngested) {
        status = "partial";
      } else if (hasErrors && !hasIngested) {
        status = "failed";
      } else {
        status = "completed";
      }

      const result: IngestionResult = {
        runId,
        status,
        articlesDiscovered,
        articlesPassedQuality,
        articlesIngested,
        articlesSkipped,
        rankingChanges,
        estimatedCostUsd,
        errors,
        ingestedArticleIds,
        durationMs: Date.now() - startTime,
      };

      // Step 6: Update run record with final metrics
      if (!isDryRun) {
        await this.updateRun(runId, result);
      }

      loggers.api.info("[AutomatedIngestion] Daily discovery completed", {
        articlesIngested,
        articlesSkipped,
        errors: errors.length,
        durationMs: result.durationMs,
      });

      return result;
    } catch (error) {
      const errorMsg = `Pipeline error: ${error instanceof Error ? error.message : "Unknown error"}`;
      loggers.api.error("[AutomatedIngestion] " + errorMsg);
      errors.push(errorMsg);

      const result: IngestionResult = {
        runId,
        status: "failed",
        articlesDiscovered,
        articlesPassedQuality,
        articlesIngested,
        articlesSkipped,
        rankingChanges,
        estimatedCostUsd,
        errors,
        ingestedArticleIds,
        durationMs: Date.now() - startTime,
      };

      // Try to update run record with error
      if (!isDryRun && runId && !runId.startsWith("dry-run")) {
        try {
          await this.updateRun(runId, result);
        } catch (updateError) {
          loggers.api.error("[AutomatedIngestion] Failed to update run with error status", {
            error: updateError instanceof Error ? updateError.message : "Unknown error",
          });
        }
      }

      return result;
    }
  }

  /**
   * Check for duplicate URLs in the articles table
   * Returns a Set of URLs that already exist in the database
   */
  async checkDuplicates(urls: string[]): Promise<Set<string>> {
    const db = getDb();
    if (!db) {
      console.warn("[AutomatedIngestion] Database not available, assuming no duplicates");
      return new Set();
    }

    try {
      console.log(`[AutomatedIngestion] Checking ${urls.length} URLs for duplicates`);

      // Query articles table for matching source URLs
      const existingArticles = await db
        .select({ sourceUrl: articles.sourceUrl })
        .from(articles)
        .where(inArray(articles.sourceUrl, urls));

      const existingUrls = new Set(
        existingArticles
          .map((a) => a.sourceUrl)
          .filter((url): url is string => url !== null)
      );

      console.log(`[AutomatedIngestion] Found ${existingUrls.size} existing URLs`);
      return existingUrls;
    } catch (error) {
      console.error("[AutomatedIngestion] Error checking duplicates:", error);
      // Return empty set on error - better to potentially re-ingest than skip everything
      return new Set();
    }
  }

  /**
   * Create a new ingestion run record
   * Returns the run ID
   */
  async createRun(runType: IngestionRunType): Promise<string> {
    const db = getDb();
    if (!db) {
      throw new Error("Database not available - cannot create ingestion run");
    }

    console.log(`[AutomatedIngestion] Creating run record with type: ${runType}`);

    const result = await db
      .insert(automatedIngestionRuns)
      .values({
        runType,
        status: "running",
        articlesDiscovered: 0,
        articlesPassedQuality: 0,
        articlesIngested: 0,
        articlesSkipped: 0,
        rankingChanges: 0,
        startedAt: new Date(),
        errorLog: [],
        ingestedArticleIds: [],
        estimatedCostUsd: "0",
      })
      .returning();

    const run = result[0];
    if (!run?.id) {
      throw new Error("Failed to create ingestion run record");
    }

    return run.id;
  }

  /**
   * Update an existing run record with metrics
   */
  async updateRun(runId: string, updates: Partial<IngestionResult>): Promise<void> {
    const db = getDb();
    if (!db) {
      console.warn("[AutomatedIngestion] Database not available, skipping run update");
      return;
    }

    try {
      console.log(`[AutomatedIngestion] Updating run ${runId} with status: ${updates.status}`);

      const updateData: Partial<AutomatedIngestionRun> = {};

      if (updates.status !== undefined) {
        updateData.status = updates.status === "partial" ? "completed" : updates.status;
      }
      if (updates.articlesDiscovered !== undefined) {
        updateData.articlesDiscovered = updates.articlesDiscovered;
      }
      if (updates.articlesPassedQuality !== undefined) {
        updateData.articlesPassedQuality = updates.articlesPassedQuality;
      }
      if (updates.articlesIngested !== undefined) {
        updateData.articlesIngested = updates.articlesIngested;
      }
      if (updates.articlesSkipped !== undefined) {
        updateData.articlesSkipped = updates.articlesSkipped;
      }
      if (updates.rankingChanges !== undefined) {
        updateData.rankingChanges = updates.rankingChanges;
      }
      if (updates.estimatedCostUsd !== undefined) {
        updateData.estimatedCostUsd = updates.estimatedCostUsd.toFixed(4);
      }
      if (updates.errors !== undefined && updates.errors.length > 0) {
        updateData.errorLog = updates.errors;
      }
      if (updates.ingestedArticleIds !== undefined) {
        updateData.ingestedArticleIds = updates.ingestedArticleIds;
      }

      // Set completedAt if status is not running
      if (updates.status && updates.status !== "completed") {
        updateData.completedAt = new Date();
      }
      if (updates.status === "completed" || updates.status === "failed") {
        updateData.completedAt = new Date();
      }

      await db
        .update(automatedIngestionRuns)
        .set(updateData)
        .where(eq(automatedIngestionRuns.id, runId));

      console.log(`[AutomatedIngestion] Run ${runId} updated successfully`);
    } catch (error) {
      console.error(`[AutomatedIngestion] Failed to update run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Get the status of a specific run
   */
  async getRunStatus(runId: string): Promise<AutomatedIngestionRun | null> {
    const db = getDb();
    if (!db) {
      console.warn("[AutomatedIngestion] Database not available");
      return null;
    }

    const [run] = await db
      .select()
      .from(automatedIngestionRuns)
      .where(eq(automatedIngestionRuns.id, runId))
      .limit(1);

    return run ?? null;
  }

  /**
   * Get recent ingestion runs
   */
  async getRecentRuns(limit: number = 10): Promise<AutomatedIngestionRun[]> {
    const db = getDb();
    if (!db) {
      console.warn("[AutomatedIngestion] Database not available");
      return [];
    }

    const runs = await db
      .select()
      .from(automatedIngestionRuns)
      .orderBy(desc(automatedIngestionRuns.createdAt))
      .limit(limit);

    return runs;
  }
}

// Singleton instance - lazily created on first access
let _automatedIngestionServiceInstance: AutomatedIngestionService | null = null;

/**
 * Get or create AutomatedIngestionService singleton instance
 * Uses lazy initialization to avoid build-time API key validation
 * @returns Singleton AutomatedIngestionService instance
 */
export function getAutomatedIngestionService(): AutomatedIngestionService {
  if (!_automatedIngestionServiceInstance) {
    _automatedIngestionServiceInstance = new AutomatedIngestionService();
  }
  return _automatedIngestionServiceInstance;
}
