#!/usr/bin/env tsx
/**
 * Companies Data Migration Script
 * 
 * Migrates companies data from exports to JSON database
 * Part of T-006: Migrate companies data to JSON
 */

import {
  getCompaniesRepo,
  initializeRepositories
} from '../../src/lib/json-db';
import type { Company } from '../../src/lib/json-db/schemas';
import { loggers } from '../../src/lib/logger';
import path from 'path';
import fs from 'fs-extra';

const logger = loggers.migration;

interface CompaniesMigrationStats {
  companies: number;
  errors: string[];
}

class CompaniesMigrator {
  private stats: CompaniesMigrationStats = {
    companies: 0,
    errors: []
  };

  private exportsDir = path.join(process.cwd(), 'data', 'exports');

  async run() {
    try {
      logger.info('Starting companies migration...');
      
      // Initialize repositories
      await initializeRepositories();
      
      // Migrate from production export
      await this.migrateFromProductionExport();
      
      // Migrate from import files
      await this.migrateFromImportFiles();
      
      // Report results
      this.reportResults();
      
      logger.info('Companies migration completed successfully!');
      
    } catch (error) {
      logger.error('Companies migration failed', { error });
      this.stats.errors.push(`Migration failed: ${error}`);
      throw error;
    }
  }
  
  private async migrateFromProductionExport(): Promise<void> {
    logger.info('Migrating from production export companies data...');
    
    try {
      const prodExportDir = path.join(this.exportsDir, 'prod-export-2025-06-11');
      const companiesPath = path.join(prodExportDir, 'companies.json');
      
      if (!await fs.pathExists(companiesPath)) {
        logger.warn('Production companies export not found, skipping production migration');
        return;
      }
      
      const companiesData = await fs.readJson(companiesPath);
      const companiesRepo = getCompaniesRepo();
      
      if (Array.isArray(companiesData)) {
        for (const companyItem of companiesData) {
          try {
            // Generate slug from name if not present
            const slug = companyItem.slug || this.generateSlug(companyItem.name);
            
            const company: Company = {
              id: companyItem.id || `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              slug,
              name: companyItem.name || 'Unknown Company',
              description: companyItem.description,
              website: companyItem.website_url,
              founded: companyItem.founded_year ? companyItem.founded_year.toString() : undefined,
              headquarters: companyItem.headquarters,
              size: this.mapCompanySize(companyItem.company_size),
              funding_total: companyItem.funding_total,
              last_funding_round: companyItem.last_funding_round,
              investors: companyItem.investors,
              created_at: companyItem.created_at || new Date().toISOString(),
              updated_at: companyItem.updated_at || new Date().toISOString()
            };
            
            await companiesRepo.upsert(company);
            this.stats.companies++;
            
          } catch (error) {
            const errorMsg = `Failed to migrate company ${companyItem.id}: ${error}`;
            logger.error(errorMsg);
            this.stats.errors.push(errorMsg);
          }
        }
      }
      
      logger.info(`Migrated ${this.stats.companies} companies from production export`);
      
    } catch (error) {
      const errorMsg = `Production companies export migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private async migrateFromImportFiles(): Promise<void> {
    logger.info('Migrating from import files...');
    
    try {
      const importsDir = path.join(process.cwd(), 'data', 'imports');
      const importFiles = [
        'companies-import.json',
        'company-tool-updates-june-2025.json'
      ];
      
      const companiesRepo = getCompaniesRepo();
      
      for (const importFile of importFiles) {
        const importPath = path.join(importsDir, importFile);
        
        if (!await fs.pathExists(importPath)) {
          logger.info(`Import file ${importFile} not found, skipping`);
          continue;
        }
        
        const importData = await fs.readJson(importPath);
        
        // Handle different import formats
        let companiesToProcess: any[] = [];
        
        if (Array.isArray(importData)) {
          companiesToProcess = importData;
        } else if (importData.companies && Array.isArray(importData.companies)) {
          companiesToProcess = importData.companies;
        }
        
        for (const companyItem of companiesToProcess) {
          try {
            // Skip if we already have this company
            const existingCompany = await companiesRepo.getById(companyItem.id);
            if (existingCompany) {
              continue;
            }
            
            // Generate slug from name if not present
            const slug = companyItem.slug || this.generateSlug(companyItem.name);
            
            const company: Company = {
              id: companyItem.id || `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              slug,
              name: companyItem.name || 'Unknown Company',
              description: companyItem.description,
              website: companyItem.website || companyItem.website_url,
              founded: companyItem.founded || (companyItem.founded_year ? companyItem.founded_year.toString() : undefined),
              headquarters: companyItem.headquarters,
              size: this.mapCompanySize(companyItem.size || companyItem.company_size),
              funding_total: companyItem.funding_total,
              last_funding_round: companyItem.last_funding_round,
              investors: companyItem.investors,
              created_at: companyItem.created_at || new Date().toISOString(),
              updated_at: companyItem.updated_at || new Date().toISOString()
            };
            
            await companiesRepo.upsert(company);
            this.stats.companies++;
            
          } catch (error) {
            const errorMsg = `Failed to migrate company from ${importFile}: ${error}`;
            logger.error(errorMsg);
            this.stats.errors.push(errorMsg);
          }
        }
        
        logger.info(`Processed import file: ${importFile}`);
      }
      
    } catch (error) {
      const errorMsg = `Import files migration failed: ${error}`;
      logger.error(errorMsg);
      this.stats.errors.push(errorMsg);
    }
  }
  
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  private mapCompanySize(size?: string): string | undefined {
    if (!size) return undefined;
    
    const sizeMap: Record<string, string> = {
      'startup': 'startup',
      'small': 'small',
      'medium': 'medium',
      'large': 'large',
      'enterprise': 'enterprise'
    };
    
    return sizeMap[size.toLowerCase()] || size;
  }
  
  private reportResults(): void {
    logger.info('Companies Migration Results:', {
      companies: this.stats.companies,
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
      'companies-migration-results.json'
    );
    
    const results = {
      timestamp: new Date().toISOString(),
      migration_type: 'companies-to-json',
      stats: this.stats,
      success: this.stats.errors.length === 0,
      source: 'production exports and import files'
    };
    
    fs.writeJsonSync(resultsPath, results, { spaces: 2 });
    logger.info('Companies migration results saved', { path: resultsPath });
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new CompaniesMigrator();
  migrator.run()
    .then(() => {
      logger.info('Companies migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Companies migration script failed', { error });
      process.exit(1);
    });
}

export { CompaniesMigrator };