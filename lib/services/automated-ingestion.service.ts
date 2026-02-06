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

import { desc, eq, gte, inArray } from "drizzle-orm";
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
  articlesSkippedSemantic: number;
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
    let articlesSkippedSemantic = 0;
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
          articlesSkippedSemantic: 0,
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
          articlesSkippedSemantic: 0,
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

      // Step 3: Filter URL duplicates
      const urls = searchResults.map((r) => r.url);
      const existingUrls = await this.checkDuplicates(urls);
      const articlesWithoutUrlDuplicates = searchResults.filter((r) => !existingUrls.has(r.url));
      const urlDuplicatesCount = searchResults.length - articlesWithoutUrlDuplicates.length;
      loggers.api.info("[AutomatedIngestion] Filtered URL duplicates", {
        duplicates: urlDuplicatesCount,
        remaining: articlesWithoutUrlDuplicates.length,
      });

      // Step 3b: Filter semantic duplicates (same story, different source)
      // "First wins" - keep only the first article per topic
      const recentArticles = await this.getRecentArticleTitles(7); // Last 7 days
      const newArticles = await this.filterSemanticDuplicates(
        articlesWithoutUrlDuplicates,
        recentArticles
      );
      articlesSkippedSemantic = articlesWithoutUrlDuplicates.length - newArticles.length;
      articlesSkipped = urlDuplicatesCount + articlesSkippedSemantic;

      loggers.api.info("[AutomatedIngestion] Filtered all duplicates", {
        urlDuplicates: urlDuplicatesCount,
        semanticDuplicates: articlesSkippedSemantic,
        totalDuplicates: articlesSkipped,
        remaining: newArticles.length,
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
          articlesSkippedSemantic,
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
          articlesSkippedSemantic,
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

      if (options?.skipQualityCheck) {
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
          // Determine the search source used for this run
          const searchSource = useTavily ? "tavily" : "brave_search";

          const ingestionResult = await this.articleIngestionService.ingestArticle({
            type: "url",
            input: article.url,
            dryRun: isDryRun,
            metadata: {
              publishedDate: article.publishedDate || undefined,
              isAutoIngested: true,
              ingestionRunId: runId,
              discoverySource: searchSource,
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
        articlesSkippedSemantic,
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
        articlesSkippedSemantic,
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
        articlesSkippedSemantic,
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
   * Normalize a title for similarity comparison
   * - Lowercase
   * - Remove punctuation
   * - Remove common stop words
   * - Trim and normalize whitespace
   * - Extract key entities (companies, products)
   */
  private normalizeTitle(title: string): string {
    const stopWords = new Set([
      "the", "a", "an", "in", "on", "at", "to", "for", "of", "with", "by",
      "is", "are", "was", "were", "be", "been", "being", "has", "have", "had",
      "do", "does", "did", "will", "would", "should", "could", "may", "might",
      "and", "or", "but", "if", "then", "than", "as", "from", "into", "about",
    ]);

    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word)) // Remove short words and stop words
      .join(' ')
      .trim();
  }

  /**
   * Extract key semantic features from title (companies, products, topics)
   * These are weighted more heavily in similarity calculation
   */
  private extractKeyFeatures(title: string): Set<string> {
    const normalized = this.normalizeTitle(title);
    const words = normalized.split(' ');

    // Known entities that should be weighted heavily
    const keyEntities = new Set([
      'openai', 'anthropic', 'google', 'microsoft', 'apple', 'amazon', 'meta',
      'claude', 'chatgpt', 'gemini', 'copilot', 'xcode', 'cursor', 'devin',
      'github', 'agent', 'coding', 'assistant', 'model', 'release', 'launch',
      'announces', 'unveils', 'funding', 'acquisition', 'partnership',
    ]);

    return new Set(words.filter(w => keyEntities.has(w)));
  }

  /**
   * Calculate weighted similarity between two titles
   * Uses both standard Jaccard and key feature matching
   * Returns a value between 0 and 1, where 1 means identical
   */
  private calculateTitleSimilarity(title1: string, title2: string): number {
    const normalized1 = this.normalizeTitle(title1);
    const normalized2 = this.normalizeTitle(title2);

    if (!normalized1 || !normalized2) {
      return 0;
    }

    const words1 = new Set(normalized1.split(' '));
    const words2 = new Set(normalized2.split(' '));

    // Calculate standard Jaccard similarity
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    // Extract key features (companies, products, topics)
    const features1 = this.extractKeyFeatures(title1);
    const features2 = this.extractKeyFeatures(title2);

    // If both titles have key features, check overlap
    if (features1.size > 0 && features2.size > 0) {
      const featureIntersection = new Set([...features1].filter(f => features2.has(f)));
      const featureUnion = new Set([...features1, ...features2]);
      const featureSimilarity = featureUnion.size > 0 ? featureIntersection.size / featureUnion.size : 0;

      // Weighted combination: 40% standard similarity + 60% feature similarity
      // Features matter more for detecting same story
      return jaccardSimilarity * 0.4 + featureSimilarity * 0.6;
    }

    // Fallback to standard Jaccard if no key features detected
    return jaccardSimilarity;
  }

  /**
   * Filter semantic duplicates using "first wins" approach
   * Removes articles with similar titles to already-ingested articles or earlier articles in the batch
   *
   * @param articles - Articles to check for duplicates
   * @param existingArticles - Recently published articles from DB (last 7 days)
   * @returns Filtered list with semantic duplicates removed
   */
  private async filterSemanticDuplicates(
    articles: SearchResult[],
    existingArticles: { title: string }[]
  ): Promise<SearchResult[]> {
    const similarityThreshold = 0.35; // 35% weighted similarity triggers duplicate detection
    // Note: Uses weighted algorithm (40% word overlap + 60% key feature overlap)
    // A 35% threshold catches articles with matching key entities (apple+xcode+agent)
    const uniqueArticles: SearchResult[] = [];
    const seenTitles: string[] = [];

    loggers.api.info("[AutomatedIngestion] Starting semantic duplicate detection", {
      articleCount: articles.length,
      existingArticleCount: existingArticles.length,
      threshold: similarityThreshold,
    });

    // Build list of existing article titles for comparison
    const existingTitles = existingArticles.map(a => a.title);

    for (const article of articles) {
      let isDuplicate = false;

      // Check against existing DB articles
      for (const existingTitle of existingTitles) {
        const similarity = this.calculateTitleSimilarity(article.title, existingTitle);

        if (similarity >= similarityThreshold) {
          isDuplicate = true;
          loggers.api.info("[AutomatedIngestion] Semantic duplicate detected (vs DB)", {
            newTitle: article.title.substring(0, 80),
            existingTitle: existingTitle.substring(0, 80),
            similarity: similarity.toFixed(2),
            url: article.url.substring(0, 100),
          });
          break;
        }
      }

      // Check against earlier articles in current batch (first wins)
      if (!isDuplicate) {
        for (const seenTitle of seenTitles) {
          const similarity = this.calculateTitleSimilarity(article.title, seenTitle);

          if (similarity >= similarityThreshold) {
            isDuplicate = true;
            loggers.api.info("[AutomatedIngestion] Semantic duplicate detected (within batch)", {
              newTitle: article.title.substring(0, 80),
              firstTitle: seenTitle.substring(0, 80),
              similarity: similarity.toFixed(2),
              url: article.url.substring(0, 100),
            });
            break;
          }
        }
      }

      if (!isDuplicate) {
        uniqueArticles.push(article);
        seenTitles.push(article.title);
      }
    }

    const removedCount = articles.length - uniqueArticles.length;
    loggers.api.info("[AutomatedIngestion] Semantic duplicate detection complete", {
      originalCount: articles.length,
      uniqueCount: uniqueArticles.length,
      duplicatesRemoved: removedCount,
    });

    return uniqueArticles;
  }

  /**
   * Get recent article titles from the database for semantic duplicate detection
   * @param daysBack - Number of days to look back (default: 7)
   * @returns Array of article titles
   */
  async getRecentArticleTitles(daysBack: number = 7): Promise<{ title: string }[]> {
    const db = getDb();
    if (!db) {
      loggers.api.warn("[AutomatedIngestion] Database not available, no recent articles for comparison");
      return [];
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      loggers.api.info("[AutomatedIngestion] Fetching recent article titles", {
        daysBack,
        cutoffDate: cutoffDate.toISOString(),
      });

      // Query articles published in the last N days
      const recentArticles = await db
        .select({ title: articles.title })
        .from(articles)
        .where(gte(articles.publishedDate, cutoffDate))
        .orderBy(desc(articles.publishedDate));

      loggers.api.info("[AutomatedIngestion] Fetched recent articles", {
        count: recentArticles.length,
      });

      return recentArticles.filter((a): a is { title: string } => a.title !== null);
    } catch (error) {
      loggers.api.error("[AutomatedIngestion] Error fetching recent articles", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
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
        articlesSkippedSemantic: 0,
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
      if (updates.articlesSkippedSemantic !== undefined) {
        updateData.articlesSkippedSemantic = updates.articlesSkippedSemantic;
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
