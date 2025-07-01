#!/usr/bin/env tsx
/**
 * JSON Database Migration Validation Script
 * 
 * Validates migrated JSON data integrity and completeness
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
import { loggers } from '../../src/lib/logger';
import path from 'path';
import fs from 'fs-extra';

// Load environment variables
configDotenv();

const logger = loggers.validation;

interface ValidationResult {
  collection: string;
  payload_count: number;
  json_count: number;
  missing_ids: string[];
  validation_errors: string[];
  success: boolean;
}

interface ValidationReport {
  timestamp: string;
  overall_success: boolean;
  results: ValidationResult[];
  summary: {
    total_payload_records: number;
    total_json_records: number;
    total_missing: number;
    total_errors: number;
  };
}

class MigrationValidator {
  private report: ValidationReport = {
    timestamp: new Date().toISOString(),
    overall_success: true,
    results: [],
    summary: {
      total_payload_records: 0,
      total_json_records: 0,
      total_missing: 0,
      total_errors: 0
    }
  };

  async validate(): Promise<ValidationReport> {
    try {
      logger.info('Starting migration validation...');
      
      // Initialize repositories
      await initializeRepositories();
      
      // Get Payload instance
      const payload = await getPayload({ config });
      
      // Validate each collection
      await this.validateCompanies(payload);
      await this.validateTools(payload);
      await this.validateRankings(payload);
      await this.validateNews(payload);
      
      // Calculate summary
      this.calculateSummary();
      
      // Save validation report
      await this.saveReport();
      
      logger.info('Validation completed', {
        success: this.report.overall_success,
        total_errors: this.report.summary.total_errors
      });
      
      return this.report;
      
    } catch (error) {
      logger.error('Validation failed', { error });
      this.report.overall_success = false;
      throw error;
    }
  }
  
  private async validateCompanies(payload: any): Promise<void> {
    logger.info('Validating companies...');
    
    const result: ValidationResult = {
      collection: 'companies',
      payload_count: 0,
      json_count: 0,
      missing_ids: [],
      validation_errors: [],
      success: true
    };
    
    try {
      // Get Payload data
      const { docs: payloadCompanies } = await payload.find({
        collection: 'companies',
        limit: 1000
      });
      result.payload_count = payloadCompanies.length;
      
      // Get JSON data
      const companiesRepo = getCompaniesRepo();
      const jsonCompanies = await companiesRepo.getAll();
      result.json_count = jsonCompanies.length;
      
      // Check for missing companies
      const jsonIds = new Set(jsonCompanies.map(c => c.id));
      for (const company of payloadCompanies) {
        if (!jsonIds.has(company.id)) {
          result.missing_ids.push(company.id);
          result.success = false;
        }
      }
      
      // Validate data integrity for existing records
      for (const company of payloadCompanies) {
        if (jsonIds.has(company.id)) {
          const jsonCompany = await companiesRepo.getById(company.id);
          if (jsonCompany) {
            this.validateCompanyData(company, jsonCompany, result);
          }
        }
      }
      
    } catch (error) {
      result.validation_errors.push(`Companies validation failed: ${error}`);
      result.success = false;
    }
    
    this.report.results.push(result);
    if (!result.success) {
      this.report.overall_success = false;
    }
    
    logger.info('Companies validation completed', {
      payload_count: result.payload_count,
      json_count: result.json_count,
      missing: result.missing_ids.length,
      errors: result.validation_errors.length
    });
  }
  
  private validateCompanyData(payload: any, json: any, result: ValidationResult): void {
    if (payload.name !== json.name) {
      result.validation_errors.push(`Company ${payload.id}: name mismatch`);
      result.success = false;
    }
    
    if (payload.slug !== json.slug) {
      result.validation_errors.push(`Company ${payload.id}: slug mismatch`);
      result.success = false;
    }
    
    if (payload.website_url !== json.website) {
      result.validation_errors.push(`Company ${payload.id}: website URL mismatch`);
      result.success = false;
    }
  }
  
  private async validateTools(payload: any): Promise<void> {
    logger.info('Validating tools...');
    
    const result: ValidationResult = {
      collection: 'tools',
      payload_count: 0,
      json_count: 0,
      missing_ids: [],
      validation_errors: [],
      success: true
    };
    
    try {
      // Get Payload data
      const { docs: payloadTools } = await payload.find({
        collection: 'tools',
        limit: 1000
      });
      result.payload_count = payloadTools.length;
      
      // Get JSON data
      const toolsRepo = getToolsRepo();
      const jsonTools = await toolsRepo.getAll();
      result.json_count = jsonTools.length;
      
      // Check for missing tools
      const jsonIds = new Set(jsonTools.map(t => t.id));
      for (const tool of payloadTools) {
        if (!jsonIds.has(tool.id)) {
          result.missing_ids.push(tool.id);
          result.success = false;
        }
      }
      
      // Validate data integrity
      for (const tool of payloadTools) {
        if (jsonIds.has(tool.id)) {
          const jsonTool = await toolsRepo.getById(tool.id);
          if (jsonTool) {
            this.validateToolData(tool, jsonTool, result);
          }
        }
      }
      
    } catch (error) {
      result.validation_errors.push(`Tools validation failed: ${error}`);
      result.success = false;
    }
    
    this.report.results.push(result);
    if (!result.success) {
      this.report.overall_success = false;
    }
    
    logger.info('Tools validation completed', {
      payload_count: result.payload_count,
      json_count: result.json_count,
      missing: result.missing_ids.length,
      errors: result.validation_errors.length
    });
  }
  
  private validateToolData(payload: any, json: any, result: ValidationResult): void {
    if (payload.name !== json.name) {
      result.validation_errors.push(`Tool ${payload.id}: name mismatch`);
      result.success = false;
    }
    
    if (payload.category !== json.category) {
      result.validation_errors.push(`Tool ${payload.id}: category mismatch`);
      result.success = false;
    }
    
    if (payload.website_url !== json.info.website) {
      result.validation_errors.push(`Tool ${payload.id}: website URL mismatch`);
      result.success = false;
    }
  }
  
  private async validateRankings(payload: any): Promise<void> {
    logger.info('Validating rankings...');
    
    const result: ValidationResult = {
      collection: 'rankings',
      payload_count: 0,
      json_count: 0,
      missing_ids: [],
      validation_errors: [],
      success: true
    };
    
    try {
      // Get Payload ranking periods
      const { docs: payloadPeriods } = await payload.find({
        collection: 'ranking-periods',
        limit: 1000
      });
      
      // Get JSON ranking periods
      const rankingsRepo = getRankingsRepo();
      const jsonPeriods = await rankingsRepo.getPeriods();
      
      result.payload_count = payloadPeriods.length;
      result.json_count = jsonPeriods.length;
      
      // Check for missing periods
      const jsonPeriodSet = new Set(jsonPeriods);
      for (const period of payloadPeriods) {
        if (!jsonPeriodSet.has(period.period)) {
          result.missing_ids.push(period.period);
          result.success = false;
        }
      }
      
      // Validate ranking data for each period
      for (const period of payloadPeriods) {
        if (jsonPeriodSet.has(period.period)) {
          await this.validateRankingPeriod(payload, period, result);
        }
      }
      
    } catch (error) {
      result.validation_errors.push(`Rankings validation failed: ${error}`);
      result.success = false;
    }
    
    this.report.results.push(result);
    if (!result.success) {
      this.report.overall_success = false;
    }
    
    logger.info('Rankings validation completed', {
      payload_count: result.payload_count,
      json_count: result.json_count,
      missing: result.missing_ids.length,
      errors: result.validation_errors.length
    });
  }
  
  private async validateRankingPeriod(payload: any, period: any, result: ValidationResult): Promise<void> {
    try {
      // Get Payload rankings for this period
      const { docs: payloadRankings } = await payload.find({
        collection: 'rankings',
        where: {
          ranking_period: {
            equals: period.id
          }
        },
        limit: 1000
      });
      
      // Get JSON rankings for this period
      const rankingsRepo = getRankingsRepo();
      const jsonRankingPeriod = await rankingsRepo.getRankingsForPeriod(period.period);
      
      if (!jsonRankingPeriod) {
        result.validation_errors.push(`Period ${period.period}: JSON data not found`);
        result.success = false;
        return;
      }
      
      // Check ranking count
      if (payloadRankings.length !== jsonRankingPeriod.rankings.length) {
        result.validation_errors.push(
          `Period ${period.period}: ranking count mismatch (Payload: ${payloadRankings.length}, JSON: ${jsonRankingPeriod.rankings.length})`
        );
        result.success = false;
      }
      
      // Validate individual rankings
      const jsonRankingsMap = new Map(jsonRankingPeriod.rankings.map(r => [r.tool_id, r]));
      
      for (const payloadRanking of payloadRankings) {
        const toolId = typeof payloadRanking.tool === 'object' ? payloadRanking.tool.id : payloadRanking.tool;
        const jsonRanking = jsonRankingsMap.get(toolId);
        
        if (!jsonRanking) {
          result.validation_errors.push(`Period ${period.period}: missing ranking for tool ${toolId}`);
          result.success = false;
          continue;
        }
        
        if (payloadRanking.position !== jsonRanking.position) {
          result.validation_errors.push(
            `Period ${period.period}, tool ${toolId}: position mismatch (${payloadRanking.position} vs ${jsonRanking.position})`
          );
          result.success = false;
        }
        
        if (Math.abs((payloadRanking.score || 0) - jsonRanking.score) > 0.001) {
          result.validation_errors.push(
            `Period ${period.period}, tool ${toolId}: score mismatch (${payloadRanking.score} vs ${jsonRanking.score})`
          );
          result.success = false;
        }
      }
      
    } catch (error) {
      result.validation_errors.push(`Period ${period.period} validation failed: ${error}`);
      result.success = false;
    }
  }
  
  private async validateNews(payload: any): Promise<void> {
    logger.info('Validating news...');
    
    const result: ValidationResult = {
      collection: 'news',
      payload_count: 0,
      json_count: 0,
      missing_ids: [],
      validation_errors: [],
      success: true
    };
    
    try {
      // Get Payload data
      const { docs: payloadNews } = await payload.find({
        collection: 'news',
        limit: 1000
      });
      result.payload_count = payloadNews.length;
      
      // Get JSON data
      const newsRepo = getNewsRepo();
      const jsonNews = await newsRepo.getAll();
      result.json_count = jsonNews.length;
      
      // Check for missing articles
      const jsonIds = new Set(jsonNews.map(n => n.id));
      for (const article of payloadNews) {
        if (!jsonIds.has(article.id)) {
          result.missing_ids.push(article.id);
          result.success = false;
        }
      }
      
      // Validate data integrity
      for (const article of payloadNews) {
        if (jsonIds.has(article.id)) {
          const jsonArticle = await newsRepo.getById(article.id);
          if (jsonArticle) {
            this.validateNewsData(article, jsonArticle, result);
          }
        }
      }
      
    } catch (error) {
      result.validation_errors.push(`News validation failed: ${error}`);
      result.success = false;
    }
    
    this.report.results.push(result);
    if (!result.success) {
      this.report.overall_success = false;
    }
    
    logger.info('News validation completed', {
      payload_count: result.payload_count,
      json_count: result.json_count,
      missing: result.missing_ids.length,
      errors: result.validation_errors.length
    });
  }
  
  private validateNewsData(payload: any, json: any, result: ValidationResult): void {
    if (payload.title !== json.title) {
      result.validation_errors.push(`News ${payload.id}: title mismatch`);
      result.success = false;
    }
    
    if (payload.slug !== json.slug) {
      result.validation_errors.push(`News ${payload.id}: slug mismatch`);
      result.success = false;
    }
  }
  
  private calculateSummary(): void {
    for (const result of this.report.results) {
      this.report.summary.total_payload_records += result.payload_count;
      this.report.summary.total_json_records += result.json_count;
      this.report.summary.total_missing += result.missing_ids.length;
      this.report.summary.total_errors += result.validation_errors.length;
    }
  }
  
  private async saveReport(): Promise<void> {
    const reportPath = path.join(
      process.cwd(),
      'data',
      'json',
      'validation-report.json'
    );
    
    await fs.writeJson(reportPath, this.report, { spaces: 2 });
    logger.info('Validation report saved', { path: reportPath });
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MigrationValidator();
  validator.validate()
    .then((report) => {
      logger.info('Validation script completed', {
        success: report.overall_success,
        total_errors: report.summary.total_errors
      });
      process.exit(report.overall_success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('Validation script failed', { error });
      process.exit(1);
    });
}

export { MigrationValidator, ValidationReport, ValidationResult };