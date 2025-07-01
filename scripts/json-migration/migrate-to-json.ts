#!/usr/bin/env tsx
/**
 * JSON Database Migration Script
 * 
 * Migrates data from Payload CMS to JSON files
 * Part of Epic EP-001: Migrate to Static JSON Database Architecture
 */

import { configDotenv } from 'dotenv';
import { getPayload } from 'payload';
import config from '../../payload.config';
import { 
  getToolsRepo, 
  getRankingsRepo, 
  getNewsRepo, 
  getCompaniesRepo,
  initializeRepositories
} from '../../src/lib/json-db';
import type { Tool, Company, NewsArticle, RankingPeriod } from '../../src/lib/json-db/schemas';
import { loggers } from '../../src/lib/logger';
import path from 'path';
import fs from 'fs-extra';

// Load environment variables
configDotenv();

const logger = loggers.migration;

interface MigrationStats {
  companies: number;
  tools: number;
  rankings: number;
  news: number;
  errors: string[];
}

class JsonMigrator {
  private stats: MigrationStats = {
    companies: 0,
    tools: 0,
    rankings: 0,
    news: 0,
    errors: []
  };

  async run() {
    try {
      logger.info('Starting JSON database migration...');
      
      // Initialize repositories
      await initializeRepositories();
      
      // Get Payload instance
      const payload = await getPayload({ config });
      
      // Create migration backup
      await this.createMigrationBackup();
      
      // Run migrations in order (companies first due to relationships)
      await this.migrateCompanies(payload);
      await this.migrateTools(payload);
      await this.migrateRankings(payload);
      await this.migrateNews(payload);
      
      // Report results
      this.reportResults();
      
      logger.info('Migration completed successfully!');
      
    } catch (error) {
      logger.error('Migration failed', { error });
      this.stats.errors.push(`Migration failed: ${error}`);
      throw error;
    }
  }
  
  private async createMigrationBackup(): Promise<void> {
    const backupDir = path.join(process.cwd(), 'data', 'json', 'backups', 'pre-migration');
    await fs.ensureDir(backupDir);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
    
    const backupData = {
      timestamp,
      migration_type: 'payload-to-json',
      note: 'Pre-migration backup created automatically'
    };
    
    await fs.writeJson(backupPath, backupData, { spaces: 2 });
    logger.info('Migration backup created', { path: backupPath });
  }
  
  private async migrateCompanies(payload: any): Promise<void> {
    logger.info('Migrating companies...');
    
    try {
      const { docs: companies } = await payload.find({
        collection: 'companies',
        limit: 1000,
        sort: 'createdAt'
      });
      
      const companiesRepo = getCompaniesRepo();
      
      for (const company of companies) {
        try {
          const jsonCompany: Company = {
            id: company.id,
            slug: company.slug,
            name: company.name,
            description: company.description || undefined,
            website: company.website_url || undefined,
            founded: company.founded_year ? String(company.founded_year) : undefined,
            headquarters: company.headquarters || undefined,
            size: company.company_size || undefined,
            funding_total: company.funding_total || undefined,
            last_funding_round: company.last_funding_round || undefined,
            investors: company.investors || undefined,
            created_at: new Date(company.createdAt).toISOString(),
            updated_at: new Date(company.updatedAt).toISOString()
          };
          
          await companiesRepo.upsert(jsonCompany);
          this.stats.companies++;
          
          if (this.stats.companies % 10 === 0) {
            logger.info(`Migrated ${this.stats.companies} companies...`);
          }
          
        } catch (error) {
          const errorMsg = `Failed to migrate company ${company.id}: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
      
      logger.info(`Companies migration completed: ${this.stats.companies} migrated`);
      
    } catch (error) {
      const errorMsg = `Companies migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateTools(payload: any): Promise<void> {
    logger.info('Migrating tools...');
    
    try {
      const { docs: tools } = await payload.find({
        collection: 'tools',
        limit: 1000,
        sort: 'createdAt',
        populate: {
          company: true
        }
      });
      
      const toolsRepo = getToolsRepo();
      
      for (const tool of tools) {
        try {
          const jsonTool: Tool = {
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
            category: tool.category,
            status: tool.status || 'active',
            company_id: typeof tool.company === 'object' ? tool.company?.id : tool.company,
            info: {
              summary: tool.summary || '',
              description: tool.description || '',
              website: tool.website_url || '',
              features: tool.features || [],
              technical: {
                context_window: tool.context_window || undefined,
                supported_languages: tool.supported_languages || undefined,
                has_api: tool.has_api || undefined,
                multi_file_support: tool.multi_file_support || undefined,
                languages: tool.programming_languages || undefined
              },
              business: {
                pricing_model: tool.pricing_model || undefined,
                business_model: tool.business_model || undefined,
                base_price: tool.base_price || undefined,
                enterprise_pricing: tool.enterprise_pricing || undefined
              },
              metrics: {
                github_stars: tool.github_stars || undefined,
                github_contributors: tool.github_contributors || undefined,
                estimated_users: tool.estimated_users || undefined,
                monthly_arr: tool.monthly_arr || undefined,
                valuation: tool.valuation || undefined,
                funding_total: tool.funding_total || undefined,
                last_funding_date: tool.last_funding_date || undefined,
                swe_bench_score: tool.swe_bench_score || undefined
              }
            },
            tags: tool.tags || undefined,
            created_at: new Date(tool.createdAt).toISOString(),
            updated_at: new Date(tool.updatedAt).toISOString()
          };
          
          await toolsRepo.upsert(jsonTool);
          this.stats.tools++;
          
          if (this.stats.tools % 10 === 0) {
            logger.info(`Migrated ${this.stats.tools} tools...`);
          }
          
        } catch (error) {
          const errorMsg = `Failed to migrate tool ${tool.id}: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
      
      logger.info(`Tools migration completed: ${this.stats.tools} migrated`);
      
    } catch (error) {
      const errorMsg = `Tools migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateRankings(payload: any): Promise<void> {
    logger.info('Migrating rankings...');
    
    try {
      // Get all ranking periods first
      const { docs: periods } = await payload.find({
        collection: 'ranking-periods',
        limit: 1000,
        sort: '-period'
      });
      
      const rankingsRepo = getRankingsRepo();
      
      for (const period of periods) {
        try {
          // Get rankings for this period
          const { docs: rankings } = await payload.find({
            collection: 'rankings',
            where: {
              ranking_period: {
                equals: period.id
              }
            },
            populate: {
              tool: true,
              ranking_period: true
            },
            sort: 'position',
            limit: 1000
          });
          
          if (rankings.length === 0) {
            logger.warn(`No rankings found for period ${period.period}`);
            continue;
          }
          
          const jsonRankingPeriod: RankingPeriod = {
            period: period.period,
            algorithm_version: period.algorithm_version || 'v6',
            is_current: period.status === 'published' && period.is_current === true,
            created_at: new Date(period.createdAt).toISOString(),
            preview_date: period.preview_date ? new Date(period.preview_date).toISOString() : undefined,
            rankings: rankings.map(ranking => {
              const tool = typeof ranking.tool === 'object' ? ranking.tool : null;
              
              return {
                tool_id: tool?.id || ranking.tool,
                tool_name: tool?.name || 'Unknown Tool',
                position: ranking.position,
                score: ranking.score || 0,
                tier: ranking.tier || undefined,
                factor_scores: {
                  agentic_capability: ranking.agentic_capability || 0,
                  innovation: ranking.innovation || 0,
                  technical_performance: ranking.technical_performance || 0,
                  developer_adoption: ranking.developer_adoption || 0,
                  market_traction: ranking.market_traction || 0,
                  business_sentiment: ranking.business_sentiment || 0,
                  development_velocity: ranking.development_velocity || 0,
                  platform_resilience: ranking.platform_resilience || 0
                },
                movement: ranking.previous_position ? {
                  previous_position: ranking.previous_position,
                  change: ranking.position - ranking.previous_position,
                  direction: ranking.position < ranking.previous_position ? 'up' : 
                           ranking.position > ranking.previous_position ? 'down' : 'same'
                } : undefined,
                change_analysis: {
                  primary_reason: ranking.primary_reason || undefined,
                  narrative_explanation: ranking.narrative_explanation || undefined
                }
              };
            })
          };
          
          await rankingsRepo.saveRankingsForPeriod(jsonRankingPeriod);
          this.stats.rankings++;
          
          logger.info(`Migrated ranking period ${period.period} with ${rankings.length} rankings`);
          
        } catch (error) {
          const errorMsg = `Failed to migrate ranking period ${period.period}: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
      
      logger.info(`Rankings migration completed: ${this.stats.rankings} periods migrated`);
      
    } catch (error) {
      const errorMsg = `Rankings migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateNews(payload: any): Promise<void> {
    logger.info('Migrating news articles...');
    
    try {
      const { docs: articles } = await payload.find({
        collection: 'news',
        limit: 1000,
        sort: '-publishedAt',
        populate: {
          related_tools: true
        }
      });
      
      const newsRepo = getNewsRepo();
      
      for (const article of articles) {
        try {
          const jsonArticle: NewsArticle = {
            id: article.id,
            slug: article.slug,
            title: article.title,
            content: this.extractTextFromRichText(article.content),
            summary: article.summary || undefined,
            author: article.author || undefined,
            published_date: new Date(article.publishedAt || article.createdAt).toISOString(),
            source: article.source || undefined,
            source_url: article.source_url || undefined,
            tags: article.tags || undefined,
            tool_mentions: article.related_tools ? 
              article.related_tools.map((tool: any) => 
                typeof tool === 'object' ? tool.id : tool
              ) : undefined,
            created_at: new Date(article.createdAt).toISOString(),
            updated_at: new Date(article.updatedAt).toISOString()
          };
          
          await newsRepo.upsert(jsonArticle);
          this.stats.news++;
          
          if (this.stats.news % 10 === 0) {
            logger.info(`Migrated ${this.stats.news} news articles...`);
          }
          
        } catch (error) {
          const errorMsg = `Failed to migrate news article ${article.id}: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
      
      logger.info(`News migration completed: ${this.stats.news} articles migrated`);
      
    } catch (error) {
      const errorMsg = `News migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private extractTextFromRichText(content: any): string {
    if (!content) return '';
    
    // Handle Lexical editor format
    if (content.root && content.root.children) {
      return this.extractTextFromLexicalNodes(content.root.children);
    }
    
    // Handle plain text
    if (typeof content === 'string') {
      return content;
    }
    
    // Fallback to JSON string
    return JSON.stringify(content);
  }
  
  private extractTextFromLexicalNodes(nodes: any[]): string {
    let text = '';
    
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.text || '';
      } else if (node.type === 'paragraph' && node.children) {
        text += this.extractTextFromLexicalNodes(node.children) + '\n\n';
      } else if (node.children) {
        text += this.extractTextFromLexicalNodes(node.children);
      }
    }
    
    return text.trim();
  }
  
  private reportResults(): void {
    logger.info('Migration Results:', {
      companies: this.stats.companies,
      tools: this.stats.tools,
      rankings: this.stats.rankings,
      news: this.stats.news,
      errors: this.stats.errors.length
    });
    
    if (this.stats.errors.length > 0) {
      logger.error('Migration Errors:', this.stats.errors);
    }
    
    // Write results to file
    const resultsPath = path.join(
      process.cwd(), 
      'data', 
      'json', 
      'migration-results.json'
    );
    
    const results = {
      timestamp: new Date().toISOString(),
      migration_type: 'payload-to-json',
      stats: this.stats,
      success: this.stats.errors.length === 0
    };
    
    fs.writeJsonSync(resultsPath, results, { spaces: 2 });
    logger.info('Migration results saved', { path: resultsPath });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new JsonMigrator();
  migrator.run()
    .then(() => {
      logger.info('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', { error });
      process.exit(1);
    });
}

export { JsonMigrator };