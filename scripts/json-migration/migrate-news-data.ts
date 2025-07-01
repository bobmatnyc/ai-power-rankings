#!/usr/bin/env tsx
/**
 * News Data Migration Script
 * 
 * Migrates news data from exports to JSON database
 * Part of T-005: Migrate news data to JSON
 */

import {
  getNewsRepo,
  getToolsRepo,
  initializeRepositories
} from '../../src/lib/json-db';
import type { NewsArticle } from '../../src/lib/json-db/schemas';
import { loggers } from '../../src/lib/logger';
import path from 'path';
import fs from 'fs-extra';

const logger = loggers.migration;

interface NewsMigrationStats {
  articles: number;
  errors: string[];
}

class NewsMigrator {
  private stats: NewsMigrationStats = {
    articles: 0,
    errors: []
  };

  private exportsDir = path.join(process.cwd(), 'data', 'exports');

  async run() {
    try {
      logger.info('Starting news migration...');
      
      // Initialize repositories
      await initializeRepositories();
      
      // Migrate from production export
      await this.migrateFromProductionExport();
      
      // Migrate from incoming news samples
      await this.migrateFromIncomingSamples();
      
      // Report results
      this.reportResults();
      
      logger.info('News migration completed successfully!');
      
    } catch (error) {
      logger.error('News migration failed', { error });
      this.stats.errors.push(`Migration failed: ${error}`);
      throw error;
    }
  }
  
  private async migrateFromProductionExport(): Promise<void> {
    logger.info('Migrating from production export news data...');
    
    try {
      const prodExportDir = path.join(this.exportsDir, 'prod-export-2025-06-11');
      const newsPath = path.join(prodExportDir, 'news_updates.json');
      
      if (!await fs.pathExists(newsPath)) {
        logger.warn('Production news export not found, skipping production migration');
        return;
      }
      
      const newsData = await fs.readJson(newsPath);
      const newsRepo = getNewsRepo();
      const toolsRepo = getToolsRepo();
      
      // Get existing tools for ID mapping
      const existingTools = await toolsRepo.getAll();
      const toolsMap = new Map(existingTools.map(tool => [tool.slug, tool.id]));
      
      if (Array.isArray(newsData)) {
        for (const newsItem of newsData) {
          try {
            // Map related tools from slugs to IDs
            const relatedToolIds: string[] = [];
            if (newsItem.related_tools && Array.isArray(newsItem.related_tools)) {
              for (const toolSlug of newsItem.related_tools) {
                const toolId = toolsMap.get(toolSlug);
                if (toolId) {
                  relatedToolIds.push(toolId);
                } else {
                  // Try to find by name match
                  const toolByName = existingTools.find(t => 
                    t.name.toLowerCase().includes(toolSlug.toLowerCase()) ||
                    t.slug.toLowerCase().includes(toolSlug.toLowerCase())
                  );
                  if (toolByName) {
                    relatedToolIds.push(toolByName.id);
                  }
                }
              }
            }
            
            // Generate slug from title
            const slug = newsItem.title 
              ? newsItem.title.toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .trim()
              : `news-${Date.now()}`;

            const article: NewsArticle = {
              id: newsItem.id || `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              slug,
              title: newsItem.title || 'Unknown Title',
              content: newsItem.summary || newsItem.content || '',
              summary: newsItem.summary,
              author: newsItem.author,
              published_date: newsItem.published_at || new Date().toISOString(),
              source: newsItem.source,
              source_url: newsItem.url,
              tags: newsItem.tags || [],
              tool_mentions: relatedToolIds,
              created_at: newsItem.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            await newsRepo.upsert(article);
            this.stats.articles++;
            
          } catch (error) {
            const errorMsg = `Failed to migrate news article ${newsItem.id}: ${error}`;
            logger.error(errorMsg);
            this.stats.errors.push(errorMsg);
          }
        }
      }
      
      logger.info(`Migrated ${this.stats.articles} news articles from production export`);
      
    } catch (error) {
      const errorMsg = `Production news export migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateFromIncomingSamples(): Promise<void> {
    logger.info('Migrating from incoming news samples...');
    
    try {
      const incomingDir = path.join(process.cwd(), 'data', 'incoming');
      const sampleFiles = [
        'sample-news-upload.json',
        'sample-news-batch-2.json'
      ];
      
      const newsRepo = getNewsRepo();
      const toolsRepo = getToolsRepo();
      
      // Get existing tools for ID mapping
      const existingTools = await toolsRepo.getAll();
      const toolsMap = new Map(existingTools.map(tool => [tool.slug, tool.id]));
      
      for (const sampleFile of sampleFiles) {
        const samplePath = path.join(incomingDir, sampleFile);
        
        if (!await fs.pathExists(samplePath)) {
          logger.info(`Sample file ${sampleFile} not found, skipping`);
          continue;
        }
        
        const sampleData = await fs.readJson(samplePath);
        
        if (Array.isArray(sampleData)) {
          for (const newsItem of sampleData) {
            try {
              // Skip if we already have this article
              const existingArticle = await newsRepo.getById(newsItem.id);
              if (existingArticle) {
                continue;
              }
              
              // Map related tools
              const relatedToolIds: string[] = [];
              if (newsItem.related_tools && Array.isArray(newsItem.related_tools)) {
                for (const toolSlug of newsItem.related_tools) {
                  const toolId = toolsMap.get(toolSlug);
                  if (toolId) {
                    relatedToolIds.push(toolId);
                  }
                }
              }
              
              // Generate slug from title
              const slug = newsItem.title 
                ? newsItem.title.toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim()
                : `sample-${Date.now()}`;

              const article: NewsArticle = {
                id: newsItem.id || `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                slug,
                title: newsItem.title || 'Sample Article',
                content: newsItem.content || newsItem.summary || '',
                summary: newsItem.summary,
                author: newsItem.author,
                published_date: newsItem.published_at || new Date().toISOString(),
                source: newsItem.source || 'Sample Source',
                source_url: newsItem.url,
                tags: newsItem.tags || [],
                tool_mentions: relatedToolIds,
                created_at: newsItem.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              
              await newsRepo.upsert(article);
              this.stats.articles++;
              
            } catch (error) {
              const errorMsg = `Failed to migrate sample news article from ${sampleFile}: ${error}`;
              logger.error(errorMsg);
              this.stats.errors.push(errorMsg);
            }
          }
        }
      }
      
      logger.info(`Migrated additional articles from sample files`);
      
    } catch (error) {
      const errorMsg = `Sample news migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private reportResults(): void {
    logger.info('News Migration Results:', {
      articles: this.stats.articles,
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
      'news-migration-results.json'
    );
    
    const results = {
      timestamp: new Date().toISOString(),
      migration_type: 'news-to-json',
      stats: this.stats,
      success: this.stats.errors.length === 0,
      source: 'production exports and sample files'
    };
    
    fs.writeJsonSync(resultsPath, results, { spaces: 2 });
    logger.info('News migration results saved', { path: resultsPath });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new NewsMigrator();
  migrator.run()
    .then(() => {
      logger.info('News migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('News migration script failed', { error });
      process.exit(1);
    });
}

export { NewsMigrator };