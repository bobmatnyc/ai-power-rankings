/**
 * Article Database Service
 * Enhanced service that integrates with the database for full article management
 */

import { eq } from "drizzle-orm";
import type {
  Article,
  ArticleProcessingLog,
  ArticleRankingsChange,
  DryRunResult,
  NewArticle,
  NewArticleRankingsChange,
} from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { companies, rankings, tools } from "@/lib/db/schema";
import type {
  CurrentRanking,
  RankingChange,
  RankingsSnapshot,
  ValidatedCompanyMention,
  ValidatedToolMention,
} from "@/lib/types/article-analysis";
import {
  cleanCompanyMentions,
  cleanToolMentions,
  ensureArray,
  validateImportanceScore,
  validatePublishedDate,
  validateSentimentScore,
} from "@/lib/types/article-analysis";
import {
  AIAnalyzer,
  type ArticleIngestionInput,
  ContentExtractor,
  RankingsCalculator,
} from "./article-ingestion.service";

export class ArticleDatabaseService {
  private articlesRepo: ArticlesRepository;
  private db: ReturnType<typeof getDb>;
  private contentExtractor: ContentExtractor;
  private aiAnalyzer: AIAnalyzer;
  private rankingsCalculator: RankingsCalculator;

  constructor() {
    this.articlesRepo = new ArticlesRepository();
    this.db = getDb();
    if (!this.db) {
      throw new Error("Database connection not available");
    }
    this.contentExtractor = new ContentExtractor();
    this.aiAnalyzer = new AIAnalyzer();
    this.rankingsCalculator = new RankingsCalculator();
  }

  // Expose the articles repository for direct access
  getArticlesRepo(): ArticlesRepository {
    return this.articlesRepo;
  }

  /**
   * Complete article ingestion with database operations
   */
  async ingestArticle(input: ArticleIngestionInput): Promise<DryRunResult | Article> {
    const startTime = Date.now();

    // For dry runs, we don't need to create a processing log with articleId
    // For actual ingestion, we'll create the log after creating the article
    let processingLog: ArticleProcessingLog | null = null;

    try {
      // Step 1: Extract content
      let content: string;
      let sourceUrl: string | undefined;
      let analysis: any; // Keep as any for compatibility with existing RankingsCalculator // Will be assigned based on input type

      // Handle preprocessed data (skip extraction and AI analysis)
      if (input.type === "preprocessed") {
        // Use the already-analyzed data
        if (!input.preprocessedData) {
          throw new Error("Preprocessed type requires preprocessedData");
        }
        // The preprocessedData contains the full result including article and predictedChanges
        analysis = input.preprocessedData.article || input.preprocessedData;
        content = analysis.content || analysis.rewritten_excerpt || "";
        sourceUrl = analysis.sourceUrl || analysis.url;
      } else {
        // Normal flow for other types
        switch (input.type) {
          case "url":
            sourceUrl = input.input;
            content = await this.contentExtractor.extractFromUrl(input.input!);
            break;
          case "file":
            if (!input.mimeType || !input.fileName) {
              throw new Error("File ingestion requires mimeType and fileName");
            }
            content = await this.contentExtractor.extractFromFile(
              input.input!,
              input.mimeType,
              input.fileName
            );
            break;
          case "text":
            content = input.input!;
            break;
        }

        // Step 2: Analyze content with AI (only for non-preprocessed)
        analysis = await this.aiAnalyzer.analyzeContent(content, {
          url: sourceUrl,
          fileName: input.fileName,
          author: input.metadata?.author,
        });
      }

      // Step 3: Get current state from database
      const currentRankings = await this.getCurrentRankings();
      const existingTools = await this.getExistingToolNames();
      const existingCompanies = await this.getExistingCompanyNames();

      // Step 4: Take rankings snapshot (for rollback)
      const rankingsSnapshot = await this.createRankingsSnapshot();

      // Step 5: Calculate predicted changes (or use preprocessed ones)
      let predictedChanges: DryRunResult["predictedChanges"];
      let newTools: DryRunResult["newTools"];
      let newCompanies: DryRunResult["newCompanies"];

      if (input.type === "preprocessed" && input.preprocessedData.predictedChanges) {
        // Use the already-calculated changes and entities
        predictedChanges = input.preprocessedData
          .predictedChanges as DryRunResult["predictedChanges"];
        newTools = (input.preprocessedData.newTools || []) as DryRunResult["newTools"];
        newCompanies = (input.preprocessedData.newCompanies || []) as DryRunResult["newCompanies"];
      } else {
        // Calculate changes
        predictedChanges = this.rankingsCalculator.calculateRankingChanges(
          analysis,
          currentRankings
        );

        const entities = this.rankingsCalculator.identifyNewEntities(
          analysis,
          existingTools,
          existingCompanies
        );
        newTools = entities.newTools as DryRunResult["newTools"];
        newCompanies = entities.newCompanies as DryRunResult["newCompanies"];
      }

      // Step 6: Handle dry run vs complete ingestion
      if (input.dryRun) {
        // For dry runs, we don't create a processing log since there's no article

        // Return dry run result
        const dryRunResult: DryRunResult = {
          article: {
            title: analysis.title,
            summary: analysis.summary,
            content: `${content.substring(0, 1000)}...`,
            ingestionType: input.type,
            sourceUrl,
            sourceName: analysis.source,
            fileName: input.fileName,
            fileType: input.mimeType,
            tags: analysis.tags,
            category: analysis.category,
            importanceScore: analysis.importance_score,
            sentimentScore: analysis.overall_sentiment?.toString() || "0",
            toolMentions: analysis.tool_mentions,
            companyMentions: analysis.company_mentions,
            author: input.metadata?.author,
            publishedDate: analysis.published_date ? new Date(analysis.published_date) : undefined,
          },
          predictedChanges,
          newTools,
          newCompanies,
          summary: {
            totalToolsAffected: predictedChanges.length,
            totalNewTools: newTools.length,
            totalNewCompanies: newCompanies.length,
            averageRankChange:
              predictedChanges.reduce((sum, c) => sum + (c.rankChange || 0), 0) /
              (predictedChanges.length || 1),
            averageScoreChange:
              predictedChanges.reduce((sum, c) => sum + (c.scoreChange || 0), 0) /
              (predictedChanges.length || 1),
          },
        };

        return dryRunResult;
      } else {
        // Complete ingestion with database changes

        // Generate unique slug
        const slug = await this.articlesRepo.generateUniqueSlug(analysis.title);

        // Use imported helper functions for type safety

        // Validate and clean tool mentions using type-safe functions
        const cleanedToolMentions: ValidatedToolMention[] = cleanToolMentions(
          analysis.tool_mentions
        );

        // Validate and clean company mentions using type-safe functions
        const cleanedCompanyMentions: ValidatedCompanyMention[] = cleanCompanyMentions(
          analysis.company_mentions
        );

        // Create article with validated data
        const newArticle: NewArticle = {
          slug,
          title: (analysis.title || "Untitled").substring(0, 500), // Enforce max length
          summary: analysis.summary || "",
          content: content || "",
          // Map preprocessed to 'text' since it's not a valid enum value in the database
          ingestionType: input.type === "preprocessed" ? "text" : input.type,
          sourceUrl: sourceUrl ? sourceUrl.substring(0, 1000) : null, // Enforce max length
          sourceName: analysis.source ? analysis.source.substring(0, 255) : null,
          fileName: input.fileName ? input.fileName.substring(0, 255) : null,
          fileType: input.mimeType ? input.mimeType.substring(0, 50) : null,
          tags: [
            ...ensureArray(analysis.tags).filter(
              (tag: unknown): tag is string => typeof tag === "string"
            ),
          ],
          category: analysis.category ? analysis.category.substring(0, 100) : null,
          importanceScore: validateImportanceScore(analysis.importance_score),
          sentimentScore: validateSentimentScore(analysis.overall_sentiment),
          // Ensure JSON fields are properly formatted
          toolMentions: cleanedToolMentions,
          companyMentions: cleanedCompanyMentions,
          rankingsSnapshot: rankingsSnapshot || null,
          author: (input.metadata?.author || analysis.source || "Unknown").substring(0, 255),
          publishedDate: validatePublishedDate(analysis.published_date),
          ingestedBy: "admin",
          status: "active",
          isProcessed: false,
        };

        console.log("[ArticleDB] Prepared article for database insert:", {
          slug: newArticle.slug,
          titleLength: newArticle.title.length,
          contentLength: newArticle.content.length,
          toolMentionsCount: Array.isArray(newArticle.toolMentions)
            ? newArticle.toolMentions.length
            : 0,
          companyMentionsCount: Array.isArray(newArticle.companyMentions)
            ? newArticle.companyMentions.length
            : 0,
          importanceScore: newArticle.importanceScore,
          sentimentScore: newArticle.sentimentScore,
        });

        const article = await this.articlesRepo.createArticle(newArticle);

        // Create processing log after article is created
        processingLog = await this.articlesRepo.createProcessingLog({
          articleId: article.id,
          action: "ingest",
          status: "started",
          performedBy: "admin",
        });

        // Create new companies if needed (only if article was saved)
        if (!input.dryRun && article?.id && newCompanies) {
          for (const company of newCompanies) {
            // Company should always be an object per DryRunResult type
            const companyName = company.name;
            const companyWebsite = company.website;

            try {
              await this.articlesRepo.createAutoCompany(
                {
                  name: companyName,
                  slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                  website: companyWebsite,
                },
                article.id
              );
            } catch (companyError) {
              console.error(`[ArticleDB] Failed to create company ${companyName}:`, companyError);
              // Continue with other companies even if one fails
            }
          }
        }

        // Create new tools if needed (only if article was saved)
        if (!input.dryRun && article?.id && newTools) {
          for (const tool of newTools) {
            // Tool should always be an object per DryRunResult type
            const toolName = tool.name;
            const toolCategory = tool.category || "other";
            const toolCompanyId = tool.companyId;

            try {
              await this.articlesRepo.createAutoTool(
                {
                  name: toolName,
                  slug: toolName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                  category: toolCategory,
                  companyId: toolCompanyId,
                },
                article.id
              );
            } catch (toolError) {
              console.error(`[ArticleDB] Failed to create tool ${toolName}:`, toolError);
              // Continue with other tools even if one fails
            }
          }
        }

        // Apply ranking changes
        const rankingChanges: NewArticleRankingsChange[] = (
          predictedChanges as RankingChange[]
        ).map((change: RankingChange) => ({
          articleId: article.id,
          toolId: change.toolId,
          toolName: change.toolName,
          metricChanges: change.metrics,
          oldRank: change.currentRank,
          newRank: change.predictedRank,
          rankChange: change.rankChange,
          oldScore: change.currentScore?.toString() || "0",
          newScore: change.predictedScore?.toString() || "0",
          scoreChange: change.scoreChange?.toString() || "0",
          changeType:
            (change.scoreChange || 0) > 0
              ? "increase"
              : (change.scoreChange || 0) < 0
                ? "decrease"
                : "no_change",
          changeReason: `Article ingestion: ${analysis.title}`,
          isApplied: true,
        }));

        if (rankingChanges.length > 0) {
          await this.articlesRepo.saveRankingChanges(rankingChanges);

          // Apply the changes to the actual rankings
          await this.applyRankingChanges(rankingChanges);
        }

        // Mark article as processed
        await this.articlesRepo.updateArticle(article.id, {
          isProcessed: true,
          processedAt: new Date(),
        });

        // Update processing log
        if (processingLog) {
          await this.articlesRepo.updateProcessingLog(processingLog.id, {
            status: "completed",
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
            toolsAffected: (predictedChanges as RankingChange[]).length,
            companiesAffected: newCompanies?.length || 0,
            rankingsChanged: rankingChanges.length,
          });
        }

        return article;
      }
    } catch (error) {
      // Update processing log with error if it exists
      if (processingLog) {
        await this.articlesRepo.updateProcessingLog(processingLog.id, {
          status: "failed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }

      throw error;
    }
  }

  /**
   * Update an article (text only, no recalculation)
   */
  async updateArticle(
    articleId: string,
    updates: Partial<Pick<Article, "title" | "summary" | "content" | "tags" | "category">>
  ): Promise<Article> {
    const article = await this.articlesRepo.updateArticle(articleId, updates);
    if (!article) {
      throw new Error("Article not found");
    }
    return article;
  }

  /**
   * Recalculate rankings for an article
   */
  async recalculateArticleRankings(articleId: string): Promise<void> {
    const startTime = Date.now();

    // Create processing log
    const processingLog = await this.articlesRepo.createProcessingLog({
      articleId,
      action: "recalculate",
      status: "started",
      performedBy: "admin",
    });

    try {
      // Get the article
      const article = await this.articlesRepo.getArticleById(articleId);
      if (!article) {
        throw new Error("Article not found");
      }

      // Re-analyze the content
      const analysis = await this.aiAnalyzer.analyzeContent(article.content, {
        url: article.sourceUrl || undefined,
        fileName: article.fileName || undefined,
        author: article.author || undefined,
      });

      // Get current rankings
      const currentRankings = await this.getCurrentRankings();

      // Calculate new changes
      const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
        analysis,
        currentRankings
      );

      // Rollback old changes
      await this.articlesRepo.rollbackArticleRankings(articleId);

      // Apply new changes
      const rankingChanges: NewArticleRankingsChange[] = predictedChanges.map((change) => ({
        articleId,
        toolId: change.toolId,
        toolName: change.toolName,
        metricChanges: change.metrics,
        oldRank: change.currentRank,
        newRank: change.predictedRank,
        rankChange: change.rankChange,
        oldScore: change.currentScore?.toString() || "0",
        newScore: change.predictedScore?.toString() || "0",
        scoreChange: change.scoreChange?.toString() || "0",
        changeType:
          (change.scoreChange || 0) > 0
            ? "increase"
            : (change.scoreChange || 0) < 0
              ? "decrease"
              : "no_change",
        changeReason: `Recalculation: ${article.title}`,
        isApplied: true,
      }));

      if (rankingChanges.length > 0) {
        await this.articlesRepo.saveRankingChanges(rankingChanges);
        await this.applyRankingChanges(rankingChanges);
      }

      // Update processing log
      await this.articlesRepo.updateProcessingLog(processingLog.id, {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        rankingsChanged: rankingChanges.length,
      });
    } catch (error) {
      // Update processing log with error
      await this.articlesRepo.updateProcessingLog(processingLog.id, {
        status: "failed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  /**
   * Cache for storing AI analysis results to avoid duplicate calls
   */
  private recalculationCache: Map<string, { analysis: any; timestamp: number }> = new Map();
  private readonly CACHE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Recalculate rankings for an article with progress tracking
   */
  async recalculateArticleRankingsWithProgress(
    articleId: string,
    progressCallback?: (progress: number, step: string) => void,
    options?: { dryRun?: boolean; useCachedAnalysis?: boolean }
  ): Promise<{
    changes: Array<{
      tool: string;
      oldScore: number;
      newScore: number;
      change: number;
      oldRank?: number;
      newRank?: number;
    }>;
    summary: {
      totalToolsAffected: number;
      averageScoreChange: number;
    };
    article?: Article;
    analysis?: any;
  }> {
    const startTime = Date.now();
    const isDryRun = options?.dryRun || false;
    const useCachedAnalysis = options?.useCachedAnalysis || false;

    // Send initial progress
    progressCallback?.(0, isDryRun ? "Starting preview..." : "Starting recalculation...");

    // IMPORTANT: Do NOT create processing log for dry runs
    // This prevents any database modifications during preview
    let processingLog: ArticleProcessingLog | null = null;

    try {
      // Get the article
      progressCallback?.(10, "Loading article from database...");
      const article = await this.articlesRepo.getArticleById(articleId);
      if (!article) {
        throw new Error("Article not found");
      }

      let analysis: any; // Keep as any for compatibility with existing RankingsCalculator

      // Check if we should use cached analysis
      if (useCachedAnalysis) {
        const cached = this.recalculationCache.get(articleId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY_MS) {
          progressCallback?.(30, "Using cached AI analysis...");
          analysis = cached.analysis;
        }
      }

      // If no cached analysis or not using cache, re-analyze
      if (!analysis) {
        progressCallback?.(30, "Analyzing content with AI...");
        analysis = await this.aiAnalyzer.analyzeContent(article.content, {
          url: article.sourceUrl || undefined,
          fileName: article.fileName || undefined,
          author: article.author || undefined,
        });

        // Cache the analysis for potential apply operation
        this.recalculationCache.set(articleId, {
          analysis,
          timestamp: Date.now(),
        });
      }

      // Ensure analysis is available
      if (!analysis) {
        throw new Error("Failed to obtain article analysis");
      }

      // Get current rankings
      progressCallback?.(50, "Loading current rankings...");
      const currentRankings = await this.getCurrentRankings();

      // Calculate new changes
      progressCallback?.(60, "Calculating ranking changes...");
      const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
        analysis,
        currentRankings
      );

      // For dry run, stop here and return preview results
      if (isDryRun) {
        progressCallback?.(100, "Preview complete!");

        // Format preview results
        const changes = predictedChanges.map((change) => ({
          tool: change.toolName,
          oldScore: change.currentScore || 0,
          newScore: change.predictedScore || 0,
          change: change.scoreChange || 0,
          oldRank: change.currentRank,
          newRank: change.predictedRank,
        }));

        const summary = {
          totalToolsAffected: changes.length,
          averageScoreChange:
            changes.length > 0 ? changes.reduce((sum, c) => sum + c.change, 0) / changes.length : 0,
        };

        // Return preview results WITHOUT any database modifications
        return { changes, summary, article, analysis };
      }

      // ==== ACTUAL APPLICATION PHASE (non-dry run) ====
      // Only create processing log when actually applying changes
      processingLog = await this.articlesRepo.createProcessingLog({
        articleId,
        action: "recalculate",
        status: "started",
        performedBy: "admin",
      });

      // Continue with actual application of changes for non-dry run
      progressCallback?.(70, "Rolling back previous changes...");
      await this.articlesRepo.rollbackArticleRankings(articleId);

      // Apply new changes
      progressCallback?.(80, "Applying new ranking changes...");
      const rankingChanges: NewArticleRankingsChange[] = predictedChanges.map((change) => ({
        articleId,
        toolId: change.toolId,
        toolName: change.toolName,
        metricChanges: change.metrics,
        oldRank: change.currentRank,
        newRank: change.predictedRank,
        rankChange: change.rankChange,
        oldScore: change.currentScore?.toString() || "0",
        newScore: change.predictedScore?.toString() || "0",
        scoreChange: change.scoreChange?.toString() || "0",
        changeType:
          (change.scoreChange || 0) > 0
            ? "increase"
            : (change.scoreChange || 0) < 0
              ? "decrease"
              : "no_change",
        changeReason: `Recalculation: ${article.title}`,
        isApplied: true,
      }));

      if (rankingChanges.length > 0) {
        await this.articlesRepo.saveRankingChanges(rankingChanges);
        await this.applyRankingChanges(rankingChanges);
      }

      progressCallback?.(90, "Finalizing changes...");

      // Update processing log
      if (processingLog) {
        await this.articlesRepo.updateProcessingLog(processingLog.id, {
          status: "completed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          rankingsChanged: rankingChanges.length,
        });
      }

      progressCallback?.(100, "Recalculation complete!");

      // Clear the cache after successful application
      this.recalculationCache.delete(articleId);

      // Format and return results using original predictedChanges data
      const changes = predictedChanges.map((change) => ({
        tool: change.toolName,
        oldScore: change.currentScore || 0,
        newScore: change.predictedScore || 0,
        change: change.scoreChange || 0,
        oldRank: change.currentRank,
        newRank: change.predictedRank,
      }));

      const summary = {
        totalToolsAffected: changes.length,
        averageScoreChange:
          changes.length > 0 ? changes.reduce((sum, c) => sum + c.change, 0) / changes.length : 0,
      };

      return { changes, summary };
    } catch (error) {
      // Update processing log with error (only for non-dry runs)
      if (processingLog) {
        await this.articlesRepo.updateProcessingLog(processingLog.id, {
          status: "failed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }

      throw error;
    }
  }

  /**
   * Delete article and rollback its ranking changes
   */
  async deleteArticle(articleId: string): Promise<void> {
    const startTime = Date.now();

    // Create processing log
    const processingLog = await this.articlesRepo.createProcessingLog({
      articleId,
      action: "delete",
      status: "started",
      performedBy: "admin",
    });

    try {
      // Get the article
      const article = await this.articlesRepo.getArticleById(articleId);
      if (!article) {
        throw new Error("Article not found");
      }

      // Rollback ranking changes
      const rolledBack = await this.articlesRepo.rollbackArticleRankings(articleId);

      // Restore rankings from snapshot if available
      if (article.rankingsSnapshot) {
        await this.restoreRankingsFromSnapshot(article.rankingsSnapshot);
      }

      // Soft delete the article
      await this.articlesRepo.deleteArticle(articleId, false);

      // Update processing log
      await this.articlesRepo.updateProcessingLog(processingLog.id, {
        status: "completed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        rankingsChanged: rolledBack,
        debugInfo: { rolledBackChanges: rolledBack },
      });
    } catch (error) {
      // Update processing log with error
      await this.articlesRepo.updateProcessingLog(processingLog.id, {
        status: "failed",
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  /**
   * Get current rankings from database
   */
  private async getCurrentRankings(): Promise<CurrentRanking[]> {
    // First try to get from database
    if (this.db) {
      try {
        // Get the most recent rankings
        const [latestRanking] = await this.db
          .select()
          .from(rankings)
          .where(eq(rankings.isCurrent, true))
          .limit(1);

        if (latestRanking?.data) {
          // Extract tools from rankings data
          const rankingData = latestRanking.data as Record<string, unknown>[];
          console.log(
            "[ArticleDatabaseService] Sample raw ranking data:",
            JSON.stringify(rankingData[0])
          );

          const mappedRankings: CurrentRanking[] = rankingData.map((item, index) => ({
            id: String((item["tool_id"] || item["id"]) ?? `unknown_${index}`),
            tool_id: String((item["tool_id"] || item["id"]) ?? `unknown_${index}`),
            tool_name: String(
              item["tool_name"] || item["name"] || (item["tool"] as any)?.["name"] || "Unknown Tool"
            ),
            name: String(
              item["tool_name"] || item["name"] || (item["tool"] as any)?.["name"] || "Unknown Tool"
            ),
            rank: typeof item["rank"] === "number" ? item["rank"] : index + 1,
            score: typeof item["score"] === "number" ? item["score"] : 0,
            metrics: (item["metrics"] as Record<string, unknown>) || {},
          }));
          console.log(
            `[ArticleDatabaseService] Found ${mappedRankings.length} rankings in database`
          );
          console.log(
            "[ArticleDatabaseService] Sample tool names from DB:",
            mappedRankings.slice(0, 3).map((r: CurrentRanking) => r.tool_name)
          );
          return mappedRankings;
        }
      } catch (error) {
        console.warn(
          "[ArticleDatabaseService] Database query failed, falling back to static data:",
          error
        );
      }
    }

    // Return empty array when DB is unavailable and no static file exists
    console.log("[ArticleDatabaseService] No rankings available, returning empty array");
    return [];
  }

  /**
   * Get existing tool names from database
   */
  private async getExistingToolNames(): Promise<string[]> {
    // First try to get from database
    if (this.db) {
      try {
        const allTools = await this.db.select({ name: tools.name }).from(tools);
        if (allTools && allTools.length > 0) {
          console.log(`[ArticleDatabaseService] Found ${allTools.length} tools in database`);
          return allTools.map((t) => t.name);
        }
      } catch (error) {
        console.warn(
          "[ArticleDatabaseService] Database query failed, falling back to static data:",
          error
        );
      }
    }

    // Return known tools as a fallback when DB is unavailable
    console.log("[ArticleDatabaseService] Using known tools list as fallback");
    return [
      "Claude Code",
      "GitHub Copilot",
      "Cursor",
      "ChatGPT Canvas",
      "v0",
      "Kiro",
      "Windsurf",
      "Google Jules",
      "Amazon Q Developer",
      "Lovable",
      "Aider",
      "Tabnine",
      "Bolt.new",
      "Augment Code",
      "Google Gemini Code Assist",
      "Replit Agent",
      "Zed",
      "OpenAI Codex CLI",
      "Devin",
      "Continue",
      "Claude Artifacts",
      "Sourcegraph Cody",
      "Cline",
      "OpenHands",
      "JetBrains AI Assistant",
      "Qodo Gen",
      "CodeRabbit",
      "Snyk Code",
      "Microsoft IntelliCode",
      "Sourcery",
      "Diffblue Cover",
    ];
  }

  /**
   * Get existing company names from database
   */
  private async getExistingCompanyNames(): Promise<string[]> {
    // First try to get from database
    if (this.db) {
      try {
        const allCompanies = await this.db.select({ name: companies.name }).from(companies);
        if (allCompanies && allCompanies.length > 0) {
          console.log(
            `[ArticleDatabaseService] Found ${allCompanies.length} companies in database`
          );
          return allCompanies.map((c) => c.name);
        }
      } catch (error) {
        console.warn(
          "[ArticleDatabaseService] Database query failed for companies, using fallback:",
          error
        );
      }
    }

    // Fallback to known companies for dry runs or when DB is unavailable
    console.log("[ArticleDatabaseService] Using known company list");
    return [
      "Anthropic",
      "OpenAI",
      "Google",
      "Microsoft",
      "GitHub",
      "Amazon",
      "Replit",
      "Cognition",
      "Cursor",
      "Codeium",
      "Vercel",
      "Sourcegraph",
      "Continue",
      "JetBrains",
      "Qodo",
      "CodeRabbit",
      "Stackblitz",
      "Augment",
      "Lovable",
      "Zed",
      "Kiro",
      "Snyk",
      "Sourcery",
      "Diffblue",
    ];
  }

  /**
   * Create a snapshot of current rankings
   */
  private async createRankingsSnapshot(): Promise<RankingsSnapshot> {
    const currentRankings = await this.getCurrentRankings();
    return {
      timestamp: new Date().toISOString(),
      rankings: currentRankings,
    };
  }

  /**
   * Apply ranking changes to the database
   */
  private async applyRankingChanges(
    changes: (ArticleRankingsChange | NewArticleRankingsChange)[]
  ): Promise<void> {
    // This is a simplified implementation
    // In production, you'd update the actual rankings table
    console.log(`[ArticleDatabaseService] Applying ${changes.length} ranking changes`);

    // TODO: Implement actual ranking updates
    // This would involve:
    // 1. Loading current rankings
    // 2. Applying the changes
    // 3. Recalculating positions
    // 4. Saving updated rankings
  }

  /**
   * Restore rankings from a snapshot
   */
  private async restoreRankingsFromSnapshot(_snapshot: unknown): Promise<void> {
    console.log("[ArticleDatabaseService] Restoring rankings from snapshot");

    // TODO: Implement snapshot restoration
    // This would involve:
    // 1. Loading the snapshot data
    // 2. Updating the rankings table
    // 3. Recalculating any dependent data
  }
}
