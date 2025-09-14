/**
 * Article Database Service
 * Enhanced service that integrates with the database for full article management
 */

import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { getDb } from "@/lib/db/connection";
import { tools, rankings, companies } from "@/lib/db/schema";
import { eq, } from "drizzle-orm";
import type {
  Article,
  NewArticle,
  ArticleRankingsChange,
  NewArticleRankingsChange,
  DryRunResult,
} from "@/lib/db/article-schema";
import {
  ContentExtractor,
  AIAnalyzer,
  RankingsCalculator,
  type ArticleIngestionInput,
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

  /**
   * Complete article ingestion with database operations
   */
  async ingestArticle(input: ArticleIngestionInput): Promise<DryRunResult | Article> {
    const startTime = Date.now();

    // For dry runs, we don't need to create a processing log with articleId
    // For actual ingestion, we'll create the log after creating the article
    let processingLog: any = null;

    try {
      // Step 1: Extract content
      let content: string;
      let sourceUrl: string | undefined;

      switch (input.type) {
        case "url":
          sourceUrl = input.input;
          content = await this.contentExtractor.extractFromUrl(input.input);
          break;
        case "file":
          if (!input.mimeType || !input.fileName) {
            throw new Error("File ingestion requires mimeType and fileName");
          }
          content = await this.contentExtractor.extractFromFile(
            input.input,
            input.mimeType,
            input.fileName
          );
          break;
        case "text":
          content = input.input;
          break;
      }

      // Step 2: Analyze content with AI
      const analysis = await this.aiAnalyzer.analyzeContent(content, {
        url: sourceUrl,
        fileName: input.fileName,
        author: input.metadata?.author,
      });

      // Step 3: Get current state from database
      const currentRankings = await this.getCurrentRankings();
      const existingTools = await this.getExistingToolNames();
      const existingCompanies = await this.getExistingCompanyNames();

      // Step 4: Take rankings snapshot (for rollback)
      const rankingsSnapshot = await this.createRankingsSnapshot();

      // Step 5: Calculate predicted changes
      const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
        analysis,
        currentRankings
      );

      const { newTools, newCompanies } = this.rankingsCalculator.identifyNewEntities(
        analysis,
        existingTools,
        existingCompanies
      );

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
            sentimentScore: analysis.overall_sentiment,
            toolMentions: analysis.tool_mentions,
            companyMentions: analysis.company_mentions,
            author: input.metadata?.author,
            publishedDate: analysis.published_date
              ? new Date(analysis.published_date)
              : undefined,
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

        // Create article
        const newArticle: NewArticle = {
          slug,
          title: analysis.title,
          summary: analysis.summary,
          content,
          ingestionType: input.type,
          sourceUrl,
          sourceName: analysis.source,
          fileName: input.fileName,
          fileType: input.mimeType,
          tags: analysis.tags,
          category: analysis.category,
          importanceScore: analysis.importance_score,
          sentimentScore: analysis.overall_sentiment,
          toolMentions: analysis.tool_mentions,
          companyMentions: analysis.company_mentions,
          rankingsSnapshot,
          author: input.metadata?.author || analysis.source,
          publishedDate: analysis.published_date
            ? new Date(analysis.published_date)
            : new Date(),
          ingestedBy: "admin",
          status: "active",
          isProcessed: false,
        };

        const article = await this.articlesRepo.createArticle(newArticle);

        // Create processing log after article is created
        processingLog = await this.articlesRepo.createProcessingLog({
          articleId: article.id,
          action: "ingest",
          status: "started",
          performedBy: "admin",
        });

        // Create new companies if needed
        for (const company of newCompanies) {
          await this.articlesRepo.createAutoCompany(
            {
              name: company.name,
              slug: company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              website: company.website,
            },
            article.id
          );
        }

        // Create new tools if needed
        for (const tool of newTools) {
          await this.articlesRepo.createAutoTool(
            {
              name: tool.name,
              slug: tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              category: tool.category || "other",
              companyId: tool.companyId,
            },
            article.id
          );
        }

        // Apply ranking changes
        const rankingChanges: NewArticleRankingsChange[] = predictedChanges.map((change) => ({
          articleId: article.id,
          toolId: change.toolId,
          toolName: change.toolName,
          metricChanges: change.metrics,
          oldRank: change.currentRank,
          newRank: change.predictedRank,
          rankChange: change.rankChange,
          oldScore: change.currentScore,
          newScore: change.predictedScore,
          scoreChange: change.scoreChange,
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
            toolsAffected: predictedChanges.length,
            companiesAffected: newCompanies.length,
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
        oldScore: change.currentScore,
        newScore: change.predictedScore,
        scoreChange: change.scoreChange,
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
  private async getCurrentRankings(): Promise<any[]> {
    // Get the most recent rankings
    const [latestRanking] = await this.db?.select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (!latestRanking) {
      return [];
    }

    // Extract tools from rankings data
    const rankingData = latestRanking.data as any[];
    return rankingData.map((item, index) => ({
      id: item.tool_id || item.id,
      tool_name: item.tool_name || item.name,
      rank: index + 1,
      score: item.score || 0,
      metrics: item.metrics || {},
    }));
  }

  /**
   * Get existing tool names from database
   */
  private async getExistingToolNames(): Promise<string[]> {
    const allTools = await this.db?.select({ name: tools.name }).from(tools);
    return allTools.map((t) => t.name);
  }

  /**
   * Get existing company names from database
   */
  private async getExistingCompanyNames(): Promise<string[]> {
    const allCompanies = await this.db?.select({ name: companies.name }).from(companies);
    return allCompanies.map((c) => c.name);
  }

  /**
   * Create a snapshot of current rankings
   */
  private async createRankingsSnapshot(): Promise<any> {
    const currentRankings = await this.getCurrentRankings();
    return {
      timestamp: new Date().toISOString(),
      rankings: currentRankings,
    };
  }

  /**
   * Apply ranking changes to the database
   */
  private async applyRankingChanges(changes: ArticleRankingsChange[]): Promise<void> {
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
  private async restoreRankingsFromSnapshot(_snapshot: any): Promise<void> {
    console.log("[ArticleDatabaseService] Restoring rankings from snapshot");

    // TODO: Implement snapshot restoration
    // This would involve:
    // 1. Loading the snapshot data
    // 2. Updating the rankings table
    // 3. Recalculating any dependent data
  }
}