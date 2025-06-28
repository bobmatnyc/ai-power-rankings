import { BaseRepository } from './base-repository';
import { NewsArticle, NewsData, IngestionReport } from './schemas';
import path from 'path';
import Ajv from 'ajv';
import ajvFormats from 'ajv-formats';
import crypto from 'crypto';

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

const newsArticleSchema = {
  type: 'object',
  required: ['id', 'slug', 'title', 'content', 'published_date', 'created_at', 'updated_at'],
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    title: { type: 'string' },
    content: { type: 'string' },
    summary: { type: ['string', 'null'] },
    author: { type: ['string', 'null'] },
    published_date: { type: 'string', format: 'date-time' },
    source: { type: ['string', 'null'] },
    source_url: { type: ['string', 'null'], format: 'uri' },
    tags: { type: ['array', 'null'], items: { type: 'string' } },
    tool_mentions: { type: ['array', 'null'], items: { type: 'string' } },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
};

const validateNewsArticle = ajv.compile(newsArticleSchema);

export class NewsRepository extends BaseRepository<NewsData> {
  private static instance: NewsRepository;
  
  constructor() {
    const filePath = path.join(process.cwd(), 'data', 'json', 'news', 'news.json');
    const defaultData: NewsData = {
      articles: [],
      ingestion_reports: [],
      index: {
        byId: {},
        bySlug: {},
        byDate: {},
        reportsByStatus: {}
      },
      metadata: {
        total: 0,
        last_updated: new Date().toISOString(),
        version: '1.0.0',
        ingestion_reports_count: 0
      }
    };
    
    super(filePath, defaultData);
  }
  
  static getInstance(): NewsRepository {
    if (!NewsRepository.instance) {
      NewsRepository.instance = new NewsRepository();
    }
    return NewsRepository.instance;
  }
  
  async validate(data: NewsData): Promise<boolean> {
    // Validate each article
    for (const article of data.articles) {
      if (!validateNewsArticle(article)) {
        this.logger.error('News article validation failed', {
          article: article.id,
          errors: validateNewsArticle.errors
        });
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get all articles
   */
  async getAll(): Promise<NewsArticle[]> {
    const data = await this.getData();
    return data.articles;
  }
  
  /**
   * Get article by ID
   */
  async getById(id: string): Promise<NewsArticle | null> {
    const data = await this.getData();
    return data.index.byId[id] || null;
  }
  
  /**
   * Get article by slug
   */
  async getBySlug(slug: string): Promise<NewsArticle | null> {
    const data = await this.getData();
    return data.index.bySlug[slug] || null;
  }
  
  /**
   * Get articles by date (YYYY-MM format)
   */
  async getByDate(date: string): Promise<NewsArticle[]> {
    const data = await this.getData();
    const articleIds = data.index.byDate[date] || [];
    return articleIds.map(id => data.index.byId[id]).filter((article): article is NewsArticle => Boolean(article));
  }
  
  /**
   * Get recent articles
   */
  async getRecent(limit: number = 10): Promise<NewsArticle[]> {
    const data = await this.getData();
    return data.articles
      .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
      .slice(0, limit);
  }
  
  /**
   * Get articles by tool mention
   */
  async getByToolMention(toolId: string): Promise<NewsArticle[]> {
    const data = await this.getData();
    return data.articles.filter(article => 
      article.tool_mentions?.includes(toolId)
    );
  }
  
  /**
   * Get articles by tag
   */
  async getByTag(tag: string): Promise<NewsArticle[]> {
    const data = await this.getData();
    return data.articles.filter(article => 
      article.tags?.includes(tag)
    );
  }
  
  /**
   * Search articles
   */
  async search(query: string): Promise<NewsArticle[]> {
    const data = await this.getData();
    const searchTerm = query.toLowerCase();
    
    return data.articles.filter(article => 
      article.title.toLowerCase().includes(searchTerm) ||
      article.content.toLowerCase().includes(searchTerm) ||
      (article.summary && article.summary.toLowerCase().includes(searchTerm)) ||
      (article.tags && article.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
  }
  
  /**
   * Add or update an article
   */
  async upsert(article: NewsArticle): Promise<void> {
    await this.update(async (data) => {
      // Remove existing article if updating
      const existingIndex = data.articles.findIndex(a => a.id === article.id);
      if (existingIndex !== -1) {
        data.articles[existingIndex] = article;
      } else {
        data.articles.push(article);
      }
      
      // Rebuild indices
      this.rebuildIndices(data);
    });
  }
  
  /**
   * Delete an article
   */
  async delete(id: string): Promise<boolean> {
    let deleted = false;
    
    await this.update(async (data) => {
      const index = data.articles.findIndex(a => a.id === id);
      if (index !== -1) {
        data.articles.splice(index, 1);
        this.rebuildIndices(data);
        deleted = true;
      }
    });
    
    return deleted;
  }
  
  /**
   * Get paginated articles
   */
  async getPaginated(page: number = 1, limit: number = 10): Promise<{
    articles: NewsArticle[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const data = await this.getData();
    const sortedArticles = data.articles
      .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const articles = sortedArticles.slice(startIndex, endIndex);
    
    return {
      articles,
      total: data.articles.length,
      page,
      totalPages: Math.ceil(data.articles.length / limit)
    };
  }
  
  /**
   * Create ingestion report
   */
  async createIngestionReport(report: Omit<IngestionReport, 'id' | 'created_at' | 'updated_at'>): Promise<IngestionReport> {
    const now = new Date().toISOString();
    const fullReport: IngestionReport = {
      ...report,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };

    await this.update(async (data) => {
      data.ingestion_reports.push(fullReport);
      this.rebuildIndices(data);
    });

    return fullReport;
  }

  /**
   * Get all ingestion reports
   */
  async getIngestionReports(status?: string, limit?: number): Promise<IngestionReport[]> {
    const data = await this.getData();
    let reports = data.ingestion_reports;

    if (status) {
      const reportIds = data.index.reportsByStatus[status] || [];
      reports = reportIds.map(id => data.ingestion_reports.find(r => r.id === id))
        .filter((r): r is IngestionReport => Boolean(r));
    }

    // Sort by created date (newest first)
    reports = reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (limit) {
      reports = reports.slice(0, limit);
    }

    return reports;
  }

  /**
   * Get ingestion report by ID
   */
  async getIngestionReportById(id: string): Promise<IngestionReport | null> {
    const data = await this.getData();
    return data.ingestion_reports.find(r => r.id === id) || null;
  }

  /**
   * Update ingestion report
   */
  async updateIngestionReport(id: string, updates: Partial<IngestionReport>): Promise<IngestionReport | null> {
    let updatedReport: IngestionReport | null = null;

    await this.update(async (data) => {
      const index = data.ingestion_reports.findIndex(r => r.id === id);
      if (index !== -1) {
        const report = data.ingestion_reports[index];
        updatedReport = {
          ...report,
          ...updates,
          id: report.id, // Never allow ID to be changed
          updated_at: new Date().toISOString(),
        };
        
        data.ingestion_reports[index] = updatedReport;
        this.rebuildIndices(data);
      }
    });

    return updatedReport;
  }

  /**
   * Delete ingestion report
   */
  async deleteIngestionReport(id: string): Promise<boolean> {
    let deleted = false;

    await this.update(async (data) => {
      const index = data.ingestion_reports.findIndex(r => r.id === id);
      if (index !== -1) {
        data.ingestion_reports.splice(index, 1);
        this.rebuildIndices(data);
        deleted = true;
      }
    });

    return deleted;
  }

  /**
   * Get ingestion report statistics
   */
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
      if (report.status === 'completed') stats.completed++;
      else if (report.status === 'partial') stats.partial++;
      else if (report.status === 'failed') stats.failed++;

      stats.total_items_processed += report.processed_items;
      stats.total_tools_created += report.new_tools_created;
      stats.total_companies_created += report.new_companies_created;
    }

    return stats;
  }

  /**
   * Rebuild all indices
   */
  private rebuildIndices(data: NewsData): void {
    // Clear indices
    data.index.byId = {};
    data.index.bySlug = {};
    data.index.byDate = {};
    data.index.reportsByStatus = {};
    
    // Rebuild article indices
    for (const article of data.articles) {
      data.index.byId[article.id] = article;
      data.index.bySlug[article.slug] = article;
      
      // Index by date (YYYY-MM format)
      const date = new Date(article.published_date);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!data.index.byDate[dateKey]) {
        data.index.byDate[dateKey] = [];
      }
      data.index.byDate[dateKey].push(article.id);
    }

    // Rebuild ingestion report indices
    for (const report of data.ingestion_reports) {
      if (!data.index.reportsByStatus[report.status]) {
        data.index.reportsByStatus[report.status] = [];
      }
      data.index.reportsByStatus[report.status].push(report.id);
    }
    
    // Update metadata
    data.metadata.total = data.articles.length;
    data.metadata.ingestion_reports_count = data.ingestion_reports.length;
    data.metadata.last_updated = new Date().toISOString();
  }
  
  /**
   * Get available dates with article counts
   */
  async getAvailableDates(): Promise<Record<string, number>> {
    const data = await this.getData();
    const counts: Record<string, number> = {};
    
    for (const [date, articleIds] of Object.entries(data.index.byDate)) {
      counts[date] = articleIds.length;
    }
    
    return counts;
  }
  
  /**
   * Get all tags with counts
   */
  async getTagsWithCounts(): Promise<Record<string, number>> {
    const data = await this.getData();
    const counts: Record<string, number> = {};
    
    for (const article of data.articles) {
      if (article.tags) {
        for (const tag of article.tags) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      }
    }
    
    return counts;
  }
}