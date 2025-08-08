import crypto from "node:crypto";
import path from "node:path";
import Ajv from "ajv";
import ajvFormats from "ajv-formats";
import fs from "fs-extra";
import { BaseRepository } from "./base-repository";
import type { IngestionReport, NewsArticle, NewsData } from "./schemas";

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

// Removed schema validation for V2 as articles are in separate files

// const validateNewsArticle = ajv.compile(newsArticleSchema); // Not used in V2

interface MonthlyIndex {
  months: string[];
  articleCounts: Record<string, number>;
  totalArticles: number;
  lastUpdated: string;
}

interface ByMonthIndex {
  months: Array<{
    month: string;
    articleCount: number;
    filename: string;
  }>;
  totalArticles: number;
  lastUpdated: string;
}

interface MonthlyData {
  articles: NewsArticle[];
  newsById?: Record<string, NewsArticle>;
  newsBySlug?: Record<string, NewsArticle>;
  metadata?: {
    month: string;
    articleCount: number;
    generatedAt: string;
  };
}

export type DirectoryMode = "articles" | "by-month";

export class NewsRepositoryV2 extends BaseRepository<NewsData> {
  private static instance: NewsRepositoryV2;
  private articlesDir: string;
  private byMonthDir: string;
  private directoryMode: DirectoryMode;
  private indexCache: MonthlyIndex | null = null;
  private monthlyCache: Map<string, NewsArticle[]> = new Map();
  private monthlyDataCache: Map<string, MonthlyData> = new Map();

  constructor() {
    const filePath = path.join(process.cwd(), "data", "json", "news", "news.json");
    const defaultData: NewsData = {
      articles: [],
      ingestion_reports: [],
      index: {
        byId: {},
        bySlug: {},
        byDate: {},
        reportsByStatus: {},
      },
      metadata: {
        total: 0,
        last_updated: new Date().toISOString(),
        version: "2.0.0", // Version 2 with monthly split
        ingestion_reports_count: 0,
      },
    };

    super(filePath, defaultData);
    this.articlesDir = path.join(process.cwd(), "data", "json", "news", "articles");
    this.byMonthDir = path.join(process.cwd(), "data", "json", "news", "by-month");

    // Default to 'articles' mode, can be overridden via environment variable
    this.directoryMode = (process.env["NEWS_DIRECTORY_MODE"] as DirectoryMode) || "articles";

    // Auto-detect directory mode if not specified
    this.autoDetectDirectoryMode();
  }

  /**
   * Auto-detect which directory mode to use based on directory existence
   */
  private async autoDetectDirectoryMode(): Promise<void> {
    // Only auto-detect if not explicitly set via environment variable
    if (!process.env["NEWS_DIRECTORY_MODE"]) {
      try {
        const byMonthExists = await fs.pathExists(this.byMonthDir);
        const articlesExists = await fs.pathExists(this.articlesDir);

        // Always prefer /by-month/ if it exists and has JSON files
        if (byMonthExists) {
          const files = await fs.readdir(this.byMonthDir);
          const hasJsonFiles = files.some((f) => f.endsWith(".json") && f !== "index.json");
          if (hasJsonFiles) {
            console.log("NEWS: Auto-detected by-month directory mode");
            this.directoryMode = "by-month";
            return;
          }
        }

        // Fallback to /articles/ if it exists and has JSON files
        if (articlesExists) {
          const files = await fs.readdir(this.articlesDir);
          const hasJsonFiles = files.some((f) => f.endsWith(".json") && f !== "index.json");
          if (hasJsonFiles) {
            console.log("NEWS: Auto-detected articles directory mode");
            this.directoryMode = "articles";
            return;
          }
        }

        // If neither has content, default to by-month for new installations
        console.log("NEWS: Defaulting to by-month directory mode");
        this.directoryMode = "by-month";
      } catch (error) {
        // If there's an error, stick with the default
        console.warn("Error auto-detecting news directory mode:", error);
      }
    }
  }

  static getInstance(): NewsRepositoryV2 {
    if (!NewsRepositoryV2.instance) {
      NewsRepositoryV2.instance = new NewsRepositoryV2();
    }
    return NewsRepositoryV2.instance;
  }

  /**
   * Set the directory mode (for switching between /articles/ and /by-month/)
   */
  setDirectoryMode(mode: DirectoryMode): void {
    if (this.directoryMode !== mode) {
      this.directoryMode = mode;
      // Clear caches when switching modes
      this.indexCache = null;
      this.monthlyCache.clear();
      this.monthlyDataCache.clear();
    }
  }

  /**
   * Get the current directory mode
   */
  getDirectoryMode(): DirectoryMode {
    return this.directoryMode;
  }

  /**
   * Get the monthly index
   */
  private async getMonthlyIndex(): Promise<MonthlyIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }

    const targetDir = this.directoryMode === "by-month" ? this.byMonthDir : this.articlesDir;
    const indexPath = path.join(targetDir, "index.json");

    if (await fs.pathExists(indexPath)) {
      if (this.directoryMode === "by-month") {
        // Convert by-month index format to standard format
        const byMonthIndex = (await fs.readJson(indexPath)) as ByMonthIndex;
        const articleCounts: Record<string, number> = {};
        const months: string[] = [];

        for (const monthData of byMonthIndex.months) {
          months.push(monthData.month);
          articleCounts[monthData.month] = monthData.articleCount;
        }

        this.indexCache = {
          months,
          articleCounts,
          totalArticles: byMonthIndex.totalArticles,
          lastUpdated: byMonthIndex.lastUpdated,
        };
      } else {
        // Standard index format for /articles/ directory
        this.indexCache = await fs.readJson(indexPath);
      }
      return this.indexCache!;
    }

    // If no index exists, return empty
    return {
      months: [],
      articleCounts: {},
      totalArticles: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Load articles for a specific month
   */
  private async loadMonthlyArticles(month: string): Promise<NewsArticle[]> {
    // Check cache first
    if (this.monthlyCache.has(month)) {
      return this.monthlyCache.get(month)!;
    }

    if (this.directoryMode === "by-month") {
      // Load from /by-month/ directory with the new structure
      const monthData = await this.loadMonthlyData(month);
      if (monthData) {
        const articles = monthData.articles || [];
        this.monthlyCache.set(month, articles);
        return articles;
      }
      return [];
    } else {
      // Original /articles/ directory logic
      const monthFilePath = path.join(this.articlesDir, `${month}.json`);
      if (await fs.pathExists(monthFilePath)) {
        const articles = await fs.readJson(monthFilePath);
        this.monthlyCache.set(month, articles);
        return articles;
      }
      return [];
    }
  }

  /**
   * Load monthly data from the /by-month/ directory
   */
  private async loadMonthlyData(month: string): Promise<MonthlyData | null> {
    // Check cache first
    if (this.monthlyDataCache.has(month)) {
      return this.monthlyDataCache.get(month)!;
    }

    const monthFilePath = path.join(this.byMonthDir, `${month}.json`);
    if (await fs.pathExists(monthFilePath)) {
      const data = (await fs.readJson(monthFilePath)) as MonthlyData;
      this.monthlyDataCache.set(month, data);
      return data;
    }

    return null;
  }

  /**
   * Load articles for multiple months
   */
  private async loadArticlesForMonths(months: string[]): Promise<NewsArticle[]> {
    const allArticles: NewsArticle[] = [];

    for (const month of months) {
      const articles = await this.loadMonthlyArticles(month);
      allArticles.push(...articles);
    }

    return allArticles;
  }

  /**
   * Get all articles
   */
  async getAll(): Promise<NewsArticle[]> {
    const index = await this.getMonthlyIndex();
    return this.loadArticlesForMonths(index.months);
  }

  /**
   * Get article by ID
   */
  async getById(id: string): Promise<NewsArticle | null> {
    if (this.directoryMode === "by-month") {
      // Use the newsById index for fast lookup
      const index = await this.getMonthlyIndex();

      for (const month of index.months) {
        const monthData = await this.loadMonthlyData(month);
        if (monthData?.newsById?.[id]) {
          return monthData.newsById[id];
        }
      }
      return null;
    } else {
      // Original logic for /articles/ directory
      const index = await this.getMonthlyIndex();

      // Load months until we find the article
      for (const month of index.months) {
        const articles = await this.loadMonthlyArticles(month);
        const article = articles.find((a) => a.id === id);
        if (article) {
          return article;
        }
      }

      return null;
    }
  }

  /**
   * Get article by slug
   */
  async getBySlug(slug: string): Promise<NewsArticle | null> {
    if (this.directoryMode === "by-month") {
      // Use the newsBySlug index for fast lookup
      const index = await this.getMonthlyIndex();

      for (const month of index.months) {
        const monthData = await this.loadMonthlyData(month);
        if (monthData?.newsBySlug?.[slug]) {
          return monthData.newsBySlug[slug];
        }
      }
      return null;
    } else {
      // Original logic for /articles/ directory
      const index = await this.getMonthlyIndex();

      // Load months until we find the article
      for (const month of index.months) {
        const articles = await this.loadMonthlyArticles(month);
        const article = articles.find((a) => a.slug === slug);
        if (article) {
          return article;
        }
      }

      return null;
    }
  }

  /**
   * Get articles by date (YYYY-MM format)
   */
  async getByDate(date: string): Promise<NewsArticle[]> {
    return this.loadMonthlyArticles(date);
  }

  /**
   * Get recent articles
   */
  async getRecent(limit: number = 10): Promise<NewsArticle[]> {
    const index = await this.getMonthlyIndex();
    const articles: NewsArticle[] = [];

    // Load months until we have enough articles
    for (const month of index.months) {
      const monthArticles = await this.loadMonthlyArticles(month);
      articles.push(...monthArticles);

      if (articles.length >= limit) {
        break;
      }
    }

    // Sort by date and limit (handle both 'date' and 'published_date' fields)
    return articles
      .sort((a, b) => {
        const dateA = new Date(a.date || a.published_date).getTime();
        const dateB = new Date(b.date || b.published_date).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  /**
   * Get articles by tool mention
   */
  async getByToolMention(toolId: string): Promise<NewsArticle[]> {
    const index = await this.getMonthlyIndex();
    const matchingArticles: NewsArticle[] = [];

    // Search through all months
    for (const month of index.months) {
      const articles = await this.loadMonthlyArticles(month);
      const matches = articles.filter((article) => article.tool_mentions?.includes(toolId));
      matchingArticles.push(...matches);
    }

    return matchingArticles;
  }

  /**
   * Get articles by tag
   */
  async getByTag(tag: string): Promise<NewsArticle[]> {
    const index = await this.getMonthlyIndex();
    const matchingArticles: NewsArticle[] = [];

    // Search through all months
    for (const month of index.months) {
      const articles = await this.loadMonthlyArticles(month);
      const matches = articles.filter((article) => article.tags?.includes(tag));
      matchingArticles.push(...matches);
    }

    return matchingArticles;
  }

  /**
   * Search articles
   */
  async search(query: string): Promise<NewsArticle[]> {
    const index = await this.getMonthlyIndex();
    const searchTerm = query.toLowerCase();
    const matchingArticles: NewsArticle[] = [];

    // Search through all months
    for (const month of index.months) {
      const articles = await this.loadMonthlyArticles(month);
      const matches = articles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm) ||
          article.summary?.toLowerCase().includes(searchTerm) ||
          article.tags?.some((tag) => tag.toLowerCase().includes(searchTerm))
      );
      matchingArticles.push(...matches);
    }

    return matchingArticles;
  }

  /**
   * Add or update an article
   */
  async upsert(article: NewsArticle): Promise<void> {
    // Determine which month file to update (handle both 'date' and 'published_date' fields)
    const articleDate = article.date || article.published_date;
    const date = new Date(articleDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    // Load the month's articles
    const monthArticles = await this.loadMonthlyArticles(monthKey);

    // Remove existing article if updating
    const existingIndex = monthArticles.findIndex((a) => a.id === article.id);
    if (existingIndex !== -1) {
      monthArticles[existingIndex] = article;
    } else {
      monthArticles.push(article);
    }

    // Sort by date (newest first) - handle both 'date' and 'published_date' fields
    monthArticles.sort((a, b) => {
      const dateA = new Date(a.date || a.published_date).getTime();
      const dateB = new Date(b.date || b.published_date).getTime();
      return dateB - dateA;
    });

    // Save the updated month file
    if (this.directoryMode === "by-month") {
      // For /by-month/ directory, we need to update the full data structure
      const monthData = (await this.loadMonthlyData(monthKey)) || {
        articles: [],
        newsById: {},
        newsBySlug: {},
        metadata: {
          month: monthKey,
          articleCount: 0,
          generatedAt: new Date().toISOString(),
        },
      };

      // Update the data structure
      monthData.articles = monthArticles;
      monthData.newsById = monthData.newsById || {};
      monthData.newsBySlug = monthData.newsBySlug || {};

      // Update the indices
      for (const article of monthArticles) {
        monthData.newsById[article.id] = article;
        monthData.newsBySlug[article.slug] = article;
      }

      // Update metadata
      monthData.metadata = {
        month: monthKey,
        articleCount: monthArticles.length,
        generatedAt: new Date().toISOString(),
      };

      const monthFilePath = path.join(this.byMonthDir, `${monthKey}.json`);
      await fs.writeJson(monthFilePath, monthData, { spaces: 2 });

      // Update caches
      this.monthlyCache.set(monthKey, monthArticles);
      this.monthlyDataCache.set(monthKey, monthData);
    } else {
      // Original logic for /articles/ directory
      const monthFilePath = path.join(this.articlesDir, `${monthKey}.json`);
      await fs.writeJson(monthFilePath, monthArticles, { spaces: 2 });

      // Update cache
      this.monthlyCache.set(monthKey, monthArticles);
    }

    // Update index
    await this.updateMonthlyIndex();
  }

  /**
   * Delete an article
   */
  async delete(id: string): Promise<boolean> {
    const index = await this.getMonthlyIndex();

    // Find which month contains the article
    for (const month of index.months) {
      const articles = await this.loadMonthlyArticles(month);
      const articleIndex = articles.findIndex((a) => a.id === id);

      if (articleIndex !== -1) {
        // Remove the article
        articles.splice(articleIndex, 1);

        // Save the updated month file
        if (this.directoryMode === "by-month") {
          // For /by-month/ directory, update the full data structure
          const monthData = await this.loadMonthlyData(month);
          if (monthData) {
            monthData.articles = articles;

            // Remove from indices
            if (monthData.newsById) {
              delete monthData.newsById[id];
            }
            if (monthData.newsBySlug) {
              const article = articles.find((a) => a.id === id);
              if (article && monthData.newsBySlug[article.slug]) {
                delete monthData.newsBySlug[article.slug];
              }
            }

            // Update metadata
            monthData.metadata = {
              month: month,
              articleCount: articles.length,
              generatedAt: new Date().toISOString(),
            };

            const monthFilePath = path.join(this.byMonthDir, `${month}.json`);
            await fs.writeJson(monthFilePath, monthData, { spaces: 2 });

            // Update caches
            this.monthlyCache.set(month, articles);
            this.monthlyDataCache.set(month, monthData);
          }
        } else {
          // Original logic for /articles/ directory
          const monthFilePath = path.join(this.articlesDir, `${month}.json`);
          await fs.writeJson(monthFilePath, articles, { spaces: 2 });

          // Update cache
          this.monthlyCache.set(month, articles);
        }

        // Update index
        await this.updateMonthlyIndex();

        return true;
      }
    }

    return false;
  }

  /**
   * Get paginated articles
   */
  async getPaginated(
    page: number = 1,
    limit: number = 10
  ): Promise<{
    articles: NewsArticle[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const index = await this.getMonthlyIndex();
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // Load articles page by page
    const articles: NewsArticle[] = [];
    let totalLoaded = 0;

    for (const month of index.months) {
      const monthArticles = await this.loadMonthlyArticles(month);

      for (const article of monthArticles) {
        if (totalLoaded >= startIndex && totalLoaded < endIndex) {
          articles.push(article);
        }
        totalLoaded++;

        if (totalLoaded >= endIndex) {
          break;
        }
      }

      if (totalLoaded >= endIndex) {
        break;
      }
    }

    return {
      articles,
      total: index.totalArticles,
      page,
      totalPages: Math.ceil(index.totalArticles / limit),
    };
  }

  /**
   * Update the monthly index
   */
  private async updateMonthlyIndex(): Promise<void> {
    const targetDir = this.directoryMode === "by-month" ? this.byMonthDir : this.articlesDir;
    const months = await fs.readdir(targetDir);
    const jsonMonths = months
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      .map((f) => f.replace(".json", ""))
      .sort()
      .reverse();

    const articleCounts: Record<string, number> = {};
    let totalArticles = 0;

    for (const month of jsonMonths) {
      const articles = await this.loadMonthlyArticles(month);
      articleCounts[month] = articles.length;
      totalArticles += articles.length;
    }

    if (this.directoryMode === "by-month") {
      // Save in by-month format
      const byMonthIndex: ByMonthIndex = {
        months: jsonMonths.map((month) => ({
          month,
          articleCount: articleCounts[month] || 0,
          filename: `${month}.json`,
        })),
        totalArticles,
        lastUpdated: new Date().toISOString(),
      };

      const indexPath = path.join(targetDir, "index.json");
      await fs.writeJson(indexPath, byMonthIndex, { spaces: 2 });

      // Update cache in standard format
      this.indexCache = {
        months: jsonMonths,
        articleCounts,
        totalArticles,
        lastUpdated: byMonthIndex.lastUpdated,
      };
    } else {
      // Save in standard format for /articles/
      const index: MonthlyIndex = {
        months: jsonMonths,
        articleCounts,
        totalArticles,
        lastUpdated: new Date().toISOString(),
      };

      const indexPath = path.join(targetDir, "index.json");
      await fs.writeJson(indexPath, index, { spaces: 2 });

      // Update cache
      this.indexCache = index;
    }
  }

  /**
   * Get available dates with article counts
   */
  async getAvailableDates(): Promise<Record<string, number>> {
    const index = await this.getMonthlyIndex();
    return index.articleCounts;
  }

  /**
   * Get all tags with counts
   */
  async getTagsWithCounts(): Promise<Record<string, number>> {
    const index = await this.getMonthlyIndex();
    const counts: Record<string, number> = {};

    // Load all articles to count tags
    for (const month of index.months) {
      const articles = await this.loadMonthlyArticles(month);

      for (const article of articles) {
        if (article.tags) {
          for (const tag of article.tags) {
            counts[tag] = (counts[tag] || 0) + 1;
          }
        }
      }
    }

    return counts;
  }

  // Ingestion report methods remain the same as they're stored in the main file
  async createIngestionReport(
    report: Omit<IngestionReport, "id" | "created_at" | "updated_at">
  ): Promise<IngestionReport> {
    const now = new Date().toISOString();
    const fullReport: IngestionReport = {
      ...report,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };

    await this.update(async (data) => {
      data.ingestion_reports.push(fullReport);
      this.rebuildReportIndices(data);
    });

    return fullReport;
  }

  async getIngestionReports(status?: string, limit?: number): Promise<IngestionReport[]> {
    const data = await this.getData();
    let reports = data.ingestion_reports;

    if (status) {
      const reportIds = data.index.reportsByStatus[status] || [];
      reports = reportIds
        .map((id) => data.ingestion_reports.find((r) => r.id === id))
        .filter((r): r is IngestionReport => Boolean(r));
    }

    // Sort by created date (newest first)
    reports = reports.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    if (limit) {
      reports = reports.slice(0, limit);
    }

    return reports;
  }

  async getIngestionReportById(id: string): Promise<IngestionReport | null> {
    const data = await this.getData();
    return data.ingestion_reports.find((r) => r.id === id) || null;
  }

  async updateIngestionReport(
    id: string,
    updates: Partial<IngestionReport>
  ): Promise<IngestionReport | null> {
    let updatedReport: IngestionReport | null = null;

    await this.update(async (data) => {
      const index = data.ingestion_reports.findIndex((r) => r.id === id);
      if (index !== -1) {
        const report = data.ingestion_reports[index];
        updatedReport = {
          ...report,
          ...updates,
          id: report?.id, // Never allow ID to be changed
          filename: report?.filename, // Keep required fields
          updated_at: new Date().toISOString(),
        } as IngestionReport;

        data.ingestion_reports[index] = updatedReport!;
        this.rebuildReportIndices(data);
      }
    });

    return updatedReport;
  }

  async deleteIngestionReport(id: string): Promise<boolean> {
    let deleted = false;

    await this.update(async (data) => {
      const index = data.ingestion_reports.findIndex((r) => r.id === id);
      if (index !== -1) {
        data.ingestion_reports.splice(index, 1);
        this.rebuildReportIndices(data);
        deleted = true;
      }
    });

    return deleted;
  }

  async getIngestionReportStats(): Promise<{
    total: number;
    completed: number;
    partial: number;
    failed: number;
    total_items_processed: number;
    total_tools_created: number;
    total_companies_created: number;
  }> {
    const data = await this.getData();
    const reports = data.ingestion_reports;

    const stats = {
      total: reports.length,
      completed: 0,
      partial: 0,
      failed: 0,
      total_items_processed: 0,
      total_tools_created: 0,
      total_companies_created: 0,
    };

    for (const report of reports) {
      if (report.status === "completed") {
        stats.completed++;
      } else if (report.status === "partial") {
        stats.partial++;
      } else if (report.status === "failed") {
        stats.failed++;
      }

      stats.total_items_processed += report.processed_items;
      stats.total_tools_created += report.new_tools_created;
      stats.total_companies_created += report.new_companies_created;
    }

    return stats;
  }

  private rebuildReportIndices(data: NewsData): void {
    // Clear report indices
    data.index.reportsByStatus = {};

    // Rebuild ingestion report indices
    for (const report of data.ingestion_reports) {
      if (report.status) {
        if (!data.index.reportsByStatus[report.status]) {
          data.index.reportsByStatus[report.status] = [];
        }
        data.index.reportsByStatus[report.status]?.push(report.id);
      }
    }

    // Update metadata
    data.metadata.ingestion_reports_count = data.ingestion_reports.length;
    data.metadata.last_updated = new Date().toISOString();
  }

  async validate(): Promise<boolean> {
    // For v2, we don't validate articles in the main file since they're in monthly files
    return true;
  }
}
