/**
 * Articles Repository (Facade)
 * Maintains backward compatibility by composing specialized repositories and services.
 *
 * This file acts as a facade that delegates to specialized modules:
 * - ArticlesCoreRepository: CRUD operations (create, read, update, delete)
 * - ArticlesQueryRepository: Search and filter operations
 * - ArticlesStatisticsService: Statistics and impact analysis
 * - ArticlesRankingService: Ranking changes and processing logs
 * - ArticlesSlugService: Slug generation and uniqueness checking
 * - ArticlesEntitiesService: Auto-creation of tools and companies
 *
 * For new code, consider importing from the specialized modules directly:
 * import { ArticlesCoreRepository } from "@/lib/db/repositories/articles";
 */

import {
  type Article,
  type ArticleProcessingLog,
  type ArticleRankingsChange,
  type ArticleWithImpact,
  type NewArticle,
  type NewArticleProcessingLog,
  type NewArticleRankingsChange,
} from "@/lib/db/article-schema";

import {
  ArticlesCoreRepository,
  ArticlesQueryRepository,
  ArticlesStatisticsService,
  ArticlesRankingService,
  ArticlesSlugService,
  ArticlesEntitiesService,
  type AutoToolInput,
  type AutoCompanyInput,
  type AutoToolResult,
  type AutoCompanyResult,
} from "./articles";

/**
 * @deprecated Consider using specialized repositories directly for new code.
 * This facade is maintained for backward compatibility.
 */
export class ArticlesRepository {
  private coreRepo: ArticlesCoreRepository;
  private queryRepo: ArticlesQueryRepository;
  private statsService: ArticlesStatisticsService;
  private rankingService: ArticlesRankingService;
  private slugService: ArticlesSlugService;
  private entitiesService: ArticlesEntitiesService;

  constructor() {
    this.coreRepo = new ArticlesCoreRepository();
    this.queryRepo = new ArticlesQueryRepository();
    this.statsService = new ArticlesStatisticsService();
    this.rankingService = new ArticlesRankingService();
    this.slugService = new ArticlesSlugService();
    this.entitiesService = new ArticlesEntitiesService();
  }

  // ============================================
  // Core CRUD Operations (from ArticlesCoreRepository)
  // ============================================

  /**
   * Create a new article
   */
  async createArticle(article: NewArticle): Promise<Article> {
    return this.coreRepo.createArticle(article);
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<Article | null> {
    return this.coreRepo.getArticleById(id);
  }

  /**
   * Find article by ID (alias for getArticleById)
   */
  async findById(id: string): Promise<Article | null> {
    return this.coreRepo.findById(id);
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string): Promise<Article | null> {
    return this.coreRepo.getArticleBySlug(slug);
  }

  /**
   * Get all articles with optional filtering
   */
  async getArticles(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Article[]> {
    return this.coreRepo.getArticles(options);
  }

  /**
   * Find all articles (alias for getArticles without options)
   */
  async findAll(): Promise<Article[]> {
    return this.coreRepo.findAll();
  }

  /**
   * Find articles by status
   */
  async findByStatus(status: string): Promise<Article[]> {
    return this.coreRepo.findByStatus(status);
  }

  /**
   * Update an article
   */
  async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
    return this.coreRepo.updateArticle(id, updates);
  }

  /**
   * Delete an article (soft delete by default)
   */
  async deleteArticle(id: string, hard = false): Promise<boolean> {
    return this.coreRepo.deleteArticle(id, hard);
  }

  // ============================================
  // Query Operations (from ArticlesQueryRepository)
  // ============================================

  /**
   * Get articles that mention a specific tool
   */
  async getArticlesByToolMention(toolName: string): Promise<Article[]> {
    return this.queryRepo.getArticlesByToolMention(toolName);
  }

  /**
   * Get articles that mention a specific company
   */
  async getArticlesByCompanyMention(companyName: string): Promise<Article[]> {
    return this.queryRepo.getArticlesByCompanyMention(companyName);
  }

  /**
   * Get articles by importance score threshold
   */
  async getImportantArticles(minScore = 7): Promise<Article[]> {
    return this.queryRepo.getImportantArticles(minScore);
  }

  /**
   * Search articles by tags
   */
  async searchArticlesByTags(tags: string[]): Promise<Article[]> {
    return this.queryRepo.searchArticlesByTags(tags);
  }

  /**
   * Find articles that mention a specific tool
   */
  async findByToolMention(toolId: string): Promise<Article[]> {
    return this.queryRepo.findByToolMention(toolId);
  }

  // ============================================
  // Statistics Operations (from ArticlesStatisticsService)
  // ============================================

  /**
   * Get article with impact statistics
   */
  async getArticleWithImpact(id: string): Promise<ArticleWithImpact | null> {
    return this.statsService.getArticleWithImpact(id);
  }

  /**
   * Get article statistics
   */
  async getArticleStats(): Promise<{
    totalArticles: number;
    articlesThisMonth: number;
    articlesLastMonth: number;
    averageToolMentions: number;
    topCategories: Array<{ category: string; count: number }>;
  }> {
    return this.statsService.getArticleStats();
  }

  // ============================================
  // Ranking Operations (from ArticlesRankingService)
  // ============================================

  /**
   * Save article ranking changes
   */
  async saveRankingChanges(changes: NewArticleRankingsChange[]): Promise<ArticleRankingsChange[]> {
    return this.rankingService.saveRankingChanges(changes);
  }

  /**
   * Get ranking changes for an article
   */
  async getArticleRankingChanges(articleId: string): Promise<ArticleRankingsChange[]> {
    return this.rankingService.getArticleRankingChanges(articleId);
  }

  /**
   * Rollback ranking changes for an article
   */
  async rollbackArticleRankings(articleId: string): Promise<number> {
    return this.rankingService.rollbackArticleRankings(articleId);
  }

  /**
   * Get recent ranking changes across all articles
   */
  async getRecentRankingChanges(limit = 50): Promise<ArticleRankingsChange[]> {
    return this.rankingService.getRecentRankingChanges(limit);
  }

  /**
   * Create a processing log entry
   */
  async createProcessingLog(log: NewArticleProcessingLog): Promise<ArticleProcessingLog> {
    return this.rankingService.createProcessingLog(log);
  }

  /**
   * Update a processing log entry
   */
  async updateProcessingLog(
    id: string,
    updates: Partial<ArticleProcessingLog>
  ): Promise<ArticleProcessingLog | null> {
    return this.rankingService.updateProcessingLog(id, updates);
  }

  /**
   * Get processing logs for an article
   */
  async getArticleProcessingLogs(articleId: string): Promise<ArticleProcessingLog[]> {
    return this.rankingService.getArticleProcessingLogs(articleId);
  }

  // ============================================
  // Slug Operations (from ArticlesSlugService)
  // ============================================

  /**
   * Check if an article slug exists
   */
  async slugExists(slug: string): Promise<boolean> {
    return this.slugService.slugExists(slug);
  }

  /**
   * Generate a unique slug for an article
   */
  async generateUniqueSlug(title: string): Promise<string> {
    return this.slugService.generateUniqueSlug(title);
  }

  // ============================================
  // Entity Operations (from ArticlesEntitiesService)
  // ============================================

  /**
   * Create a new tool (auto-created from article)
   */
  async createAutoTool(
    toolData: AutoToolInput,
    articleId: string
  ): Promise<AutoToolResult> {
    return this.entitiesService.createAutoTool(toolData, articleId);
  }

  /**
   * Create a new company (auto-created from article)
   */
  async createAutoCompany(
    companyData: AutoCompanyInput,
    articleId: string
  ): Promise<AutoCompanyResult> {
    return this.entitiesService.createAutoCompany(companyData, articleId);
  }
}

// Re-export specialized classes for direct usage
export {
  ArticlesCoreRepository,
  ArticlesQueryRepository,
  ArticlesStatisticsService,
  ArticlesRankingService,
  ArticlesSlugService,
  ArticlesEntitiesService,
} from "./articles";

// Re-export types
export type { AutoToolInput, AutoCompanyInput, AutoToolResult, AutoCompanyResult };
