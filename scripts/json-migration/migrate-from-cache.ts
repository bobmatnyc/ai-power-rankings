#!/usr/bin/env tsx
/**
 * JSON Database Migration from Cache Files
 * 
 * Migrates data from existing cache files to new JSON database structure
 * Part of Epic EP-001: Migrate to Static JSON Database Architecture
 */

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

const logger = loggers.migration;

interface MigrationStats {
  companies: number;
  tools: number;
  rankings: number;
  news: number;
  errors: string[];
}

class CacheMigrator {
  private stats: MigrationStats = {
    companies: 0,
    tools: 0,
    rankings: 0,
    news: 0,
    errors: []
  };

  private cacheDir = path.join(process.cwd(), 'src', 'data', 'cache');

  async run() {
    try {
      logger.info('Starting JSON database migration from cache files...');
      
      // Initialize repositories
      await initializeRepositories();
      
      // Create migration backup
      await this.createMigrationBackup();
      
      // Run migrations in order (companies first due to relationships)
      await this.migrateFromToolsCache();
      await this.migrateFromRankingsCache();
      await this.migrateFromNewsCache();
      
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
      migration_type: 'cache-to-json',
      note: 'Pre-migration backup created automatically',
      source: 'cache files'
    };
    
    await fs.writeJson(backupPath, backupData, { spaces: 2 });
    logger.info('Migration backup created', { path: backupPath });
  }
  
  private async migrateFromToolsCache(): Promise<void> {
    logger.info('Migrating from tools cache...');
    
    try {
      const toolsCachePath = path.join(this.cacheDir, 'tools.json');
      
      if (!await fs.pathExists(toolsCachePath)) {
        logger.warn('Tools cache file not found, skipping tools migration');
        return;
      }
      
      const cacheData = await fs.readJson(toolsCachePath);
      const cachedTools = cacheData.tools || [];
      
      const toolsRepo = getToolsRepo();
      const companiesRepo = getCompaniesRepo();
      
      // Extract unique companies first
      const uniqueCompanies = new Map();
      
      for (const cachedTool of cachedTools) {
        if (cachedTool.company && cachedTool.company.id) {
          const company = cachedTool.company;
          const jsonCompany: Company = {
            id: company.id.toString(),
            slug: company.slug,
            name: company.name,
            description: company.description || undefined,
            website: company.website_url || undefined,
            founded: company.founded_year ? String(company.founded_year) : undefined,
            headquarters: company.headquarters || undefined,
            size: company.company_size || undefined,
            funding_total: undefined,
            last_funding_round: undefined,
            investors: undefined,
            created_at: company.createdAt || new Date().toISOString(),
            updated_at: company.updatedAt || new Date().toISOString()
          };
          
          uniqueCompanies.set(company.id, jsonCompany);
        }
      }
      
      // Migrate companies
      for (const company of uniqueCompanies.values()) {
        try {
          await companiesRepo.upsert(company);
          this.stats.companies++;
        } catch (error) {
          const errorMsg = `Failed to migrate company ${company.id}: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
      
      logger.info(`Companies migration completed: ${this.stats.companies} migrated`);
      
      // Now migrate tools
      for (const cachedTool of cachedTools) {
        try {
          const jsonTool: Tool = {
            id: cachedTool.id.toString(),
            slug: cachedTool.slug,
            name: cachedTool.name,
            category: cachedTool.category || 'unknown',
            status: cachedTool.status === 'active' ? 'active' : 
                   cachedTool.status === 'inactive' ? 'inactive' : 
                   cachedTool.status === 'deprecated' ? 'deprecated' : 'active',
            company_id: cachedTool.company?.id?.toString() || undefined,
            info: {
              summary: cachedTool.tagline || '',
              description: this.extractTextFromDescription(cachedTool.description) || '',
              website: cachedTool.website_url || '',
              features: cachedTool.features || [],
              technical: {
                context_window: cachedTool.context_window || undefined,
                supported_languages: cachedTool.supported_languages || undefined,
                has_api: cachedTool.has_api || undefined,
                multi_file_support: cachedTool.multi_file_support || undefined,
                languages: cachedTool.programming_languages || undefined
              },
              business: {
                pricing_model: cachedTool.pricing_model || undefined,
                business_model: cachedTool.business_model || undefined,
                base_price: cachedTool.base_price || undefined,
                enterprise_pricing: cachedTool.enterprise_pricing || undefined
              },
              metrics: {
                github_stars: cachedTool.github_stars || undefined,
                github_contributors: cachedTool.github_contributors || undefined,
                estimated_users: cachedTool.estimated_users || undefined,
                monthly_arr: cachedTool.monthly_arr || undefined,
                valuation: cachedTool.valuation || undefined,
                funding_total: cachedTool.funding_total || undefined,
                last_funding_date: cachedTool.last_funding_date || undefined,
                swe_bench_score: cachedTool.swe_bench_score || undefined
              }
            },
            tags: cachedTool.tags || undefined,
            created_at: cachedTool.createdAt || new Date().toISOString(),
            updated_at: cachedTool.updatedAt || new Date().toISOString()
          };
          
          await toolsRepo.upsert(jsonTool);
          this.stats.tools++;
          
          if (this.stats.tools % 10 === 0) {
            logger.info(`Migrated ${this.stats.tools} tools...`);
          }
          
        } catch (error) {
          const errorMsg = `Failed to migrate tool ${cachedTool.id}: ${error}`;
          logger.error(errorMsg);
          this.stats.errors.push(errorMsg);
        }
      }
      
      logger.info(`Tools migration completed: ${this.stats.tools} migrated`);
      
    } catch (error) {
      const errorMsg = `Tools cache migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateFromRankingsCache(): Promise<void> {
    logger.info('Migrating from rankings cache...');
    
    try {
      const rankingsCachePath = path.join(this.cacheDir, 'rankings.json');
      
      if (!await fs.pathExists(rankingsCachePath)) {
        logger.warn('Rankings cache file not found, skipping rankings migration');
        return;
      }
      
      const cacheData = await fs.readJson(rankingsCachePath);
      const rankingsRepo = getRankingsRepo();
      
      // Determine the period from the cache data or use current month
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      if (cacheData.rankings && Array.isArray(cacheData.rankings)) {
        const rankings = cacheData.rankings.map((ranking: any, index: number) => ({
          tool_id: ranking.tool_id?.toString() || ranking.id?.toString() || index.toString(),
          tool_name: ranking.tool_name || ranking.name || 'Unknown Tool',
          position: ranking.position || ranking.rank || index + 1,
          score: ranking.score || 0,
          tier: ranking.tier || undefined,
          factor_scores: {
            agentic_capability: ranking.agentic_capability || ranking.factor_scores?.agentic_capability || 0,
            innovation: ranking.innovation || ranking.factor_scores?.innovation || 0,
            technical_performance: ranking.technical_performance || ranking.factor_scores?.technical_performance || 0,
            developer_adoption: ranking.developer_adoption || ranking.factor_scores?.developer_adoption || 0,
            market_traction: ranking.market_traction || ranking.factor_scores?.market_traction || 0,
            business_sentiment: ranking.business_sentiment || ranking.factor_scores?.business_sentiment || 0,
            development_velocity: ranking.development_velocity || ranking.factor_scores?.development_velocity || 0,
            platform_resilience: ranking.platform_resilience || ranking.factor_scores?.platform_resilience || 0
          },
          movement: ranking.movement || undefined,
          change_analysis: ranking.change_analysis || undefined
        }));
        
        const jsonRankingPeriod: RankingPeriod = {
          period,
          algorithm_version: cacheData.algorithm_version || 'v6',
          is_current: true,
          created_at: new Date().toISOString(),
          preview_date: undefined,
          rankings
        };
        
        await rankingsRepo.saveRankingsForPeriod(jsonRankingPeriod);
        this.stats.rankings++;
        
        logger.info(`Migrated ranking period ${period} with ${rankings.length} rankings`);
      }
      
    } catch (error) {
      const errorMsg = `Rankings cache migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateFromNewsCache(): Promise<void> {
    logger.info('Migrating from news cache...');
    
    try {
      const newsCachePath = path.join(this.cacheDir, 'news.json');
      
      if (!await fs.pathExists(newsCachePath)) {
        logger.warn('News cache file not found, skipping news migration');
        return;
      }
      
      const cacheData = await fs.readJson(newsCachePath);
      const newsRepo = getNewsRepo();
      
      if (cacheData.articles && Array.isArray(cacheData.articles)) {
        for (const cachedArticle of cacheData.articles) {
          try {
            const jsonArticle: NewsArticle = {
              id: cachedArticle.id?.toString() || `article-${this.stats.news}`,
              slug: cachedArticle.slug || `article-${this.stats.news}`,
              title: cachedArticle.title || 'Untitled Article',
              content: this.extractTextFromDescription(cachedArticle.content) || '',
              summary: cachedArticle.summary || undefined,
              author: cachedArticle.author || undefined,
              published_date: cachedArticle.published_date || cachedArticle.createdAt || new Date().toISOString(),
              source: cachedArticle.source || undefined,
              source_url: cachedArticle.source_url || undefined,
              tags: cachedArticle.tags || undefined,
              tool_mentions: cachedArticle.tool_mentions || cachedArticle.related_tools || undefined,
              created_at: cachedArticle.createdAt || new Date().toISOString(),
              updated_at: cachedArticle.updatedAt || new Date().toISOString()
            };
            
            await newsRepo.upsert(jsonArticle);
            this.stats.news++;
            
            if (this.stats.news % 10 === 0) {
              logger.info(`Migrated ${this.stats.news} news articles...`);
            }
            
          } catch (error) {
            const errorMsg = `Failed to migrate news article ${cachedArticle.id}: ${error}`;
            logger.error(errorMsg);
            this.stats.errors.push(errorMsg);
          }
        }
      }
      
      logger.info(`News migration completed: ${this.stats.news} articles migrated`);
      
    } catch (error) {
      const errorMsg = `News cache migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private extractTextFromDescription(description: any): string {
    if (!description) return '';
    
    // Handle array of objects (Lexical format)
    if (Array.isArray(description)) {
      return description.map(item => {
        if (item.children && Array.isArray(item.children)) {
          return item.children.map((child: any) => child.text || '').join(' ');
        }
        return item.text || '';
      }).join(' ');
    }
    
    // Handle plain text
    if (typeof description === 'string') {
      return description;
    }
    
    // Handle object with text property
    if (description.text) {
      return description.text;
    }
    
    // Fallback to JSON string
    return JSON.stringify(description);
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
      migration_type: 'cache-to-json',
      stats: this.stats,
      success: this.stats.errors.length === 0,
      source: 'cache files'
    };
    
    fs.writeJsonSync(resultsPath, results, { spaces: 2 });
    logger.info('Migration results saved', { path: resultsPath });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new CacheMigrator();
  migrator.run()
    .then(() => {
      logger.info('Cache migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Cache migration script failed', { error });
      process.exit(1);
    });
}

export { CacheMigrator };