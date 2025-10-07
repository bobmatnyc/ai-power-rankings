/**
 * Extract Nested Tool Data Migration Script
 *
 * Automatically extracts data from various nested paths in the `info` JSONB field
 * and promotes them to standard top-level fields for consistency.
 *
 * Features:
 * - Tries multiple nested paths for each field
 * - Non-destructive: only fills empty/null fields
 * - Handles arrays and strings appropriately
 * - Dry-run mode by default
 * - Detailed before/after reporting
 * - Validates extracted data
 *
 * Usage:
 *   npx tsx scripts/extract-nested-tool-data.ts [--execute] [--verbose]
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

// ============= Types =============

interface ToolDataFields {
  id?: string;
  description?: string;
  tagline?: string;
  logo_url?: string;
  website_url?: string;
  pricing_model?: string;
  pricing_details?: any;
  github_repo?: string;
  features?: string[] | string;
  supported_languages?: string[] | string;
  ide_support?: string[] | string;
  info?: {
    product?: {
      description?: string;
      tagline?: string;
      features?: string[] | string;
      summary?: string;
    };
    technical?: {
      language_support?: string[] | string;
      languages?: string[] | string;
      ide_integration?: string | string[];
    };
    links?: {
      website?: string;
      github?: string;
    };
    metadata?: {
      logo_url?: string;
      image_url?: string;
    };
    business?: {
      pricing_model?: string;
      pricing_details?: any;
    };
    features?: string[] | string;
    capabilities?: string[] | string;
    tagline?: string;
    summary?: string;
    languages?: string[] | string;
    supported_languages?: string[] | string;
    integrations?: string | string[];
    ide_support?: string[] | string;
    github_repo?: string;
    github?: string;
    repository?: string;
  };
  [key: string]: any;
}

interface ExtractionResult {
  toolId: string;
  toolName: string;
  toolSlug: string;
  extracted: {
    tagline?: string;
    features?: string[];
    supported_languages?: string[];
    ide_support?: string[];
    github_repo?: string;
    logo_url?: string;
  };
  extractionPaths: {
    [field: string]: string;
  };
  fieldsUpdated: string[];
}

interface MigrationStats {
  totalTools: number;
  toolsProcessed: number;
  toolsWithChanges: number;
  fieldCounts: {
    tagline: number;
    features: number;
    supported_languages: number;
    ide_support: number;
    github_repo: number;
    logo_url: number;
  };
  errors: Array<{
    toolName: string;
    error: string;
  }>;
}

// ============= Helper Functions =============

/**
 * Get nested value from object using dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Extract value by trying multiple possible paths
 */
function extractValue(obj: any, paths: string[]): any {
  for (const path of paths) {
    const value = getNestedValue(obj, path);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

/**
 * Normalize array field - convert string to array if needed
 */
function normalizeArray(value: any): string[] | null {
  if (!value) return null;

  // Already an array
  if (Array.isArray(value)) {
    return value.filter(v => v && typeof v === 'string' && v.trim() !== '');
  }

  // String - split by common delimiters
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    // Try to split by comma, semicolon, or pipe
    if (trimmed.includes(',') || trimmed.includes(';') || trimmed.includes('|')) {
      const delimiter = trimmed.includes(',') ? ',' : (trimmed.includes(';') ? ';' : '|');
      return trimmed.split(delimiter).map(s => s.trim()).filter(s => s !== '');
    }

    // Single value
    return [trimmed];
  }

  return null;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate GitHub repo URL
 */
function normalizeGithubUrl(value: any): string | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  // Already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return isValidUrl(trimmed) ? trimmed : null;
  }

  // Handle github.com/user/repo format
  if (trimmed.startsWith('github.com/')) {
    return `https://${trimmed}`;
  }

  // Handle user/repo format
  if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return `https://github.com/${trimmed}`;
  }

  return null;
}

/**
 * Extract all possible data from a tool's info field
 */
function extractToolData(data: ToolDataFields, verbose: boolean): {
  extracted: ExtractionResult['extracted'];
  paths: ExtractionResult['extractionPaths'];
} {
  const extracted: ExtractionResult['extracted'] = {};
  const paths: ExtractionResult['extractionPaths'] = {};

  // Extract tagline
  if (!data.tagline) {
    const taglineValue = extractValue(data, [
      'info.product.tagline',
      'info.tagline',
      'info.product.summary',
      'info.summary'
    ]);
    if (taglineValue && typeof taglineValue === 'string') {
      extracted.tagline = taglineValue.trim();
      paths.tagline = findPathUsed(data, taglineValue, [
        'info.product.tagline',
        'info.tagline',
        'info.product.summary',
        'info.summary'
      ]);
    }
  }

  // Extract features
  if (!data.features || (Array.isArray(data.features) && data.features.length === 0)) {
    const featuresValue = extractValue(data, [
      'info.features',
      'info.product.features',
      'info.capabilities'
    ]);
    const normalizedFeatures = normalizeArray(featuresValue);
    if (normalizedFeatures && normalizedFeatures.length > 0) {
      extracted.features = normalizedFeatures;
      paths.features = findPathUsed(data, featuresValue, [
        'info.features',
        'info.product.features',
        'info.capabilities'
      ]);
    }
  }

  // Extract supported_languages
  if (!data.supported_languages || (Array.isArray(data.supported_languages) && data.supported_languages.length === 0)) {
    const languagesValue = extractValue(data, [
      'info.technical.language_support',
      'info.technical.languages',
      'info.languages',
      'info.supported_languages'
    ]);
    const normalizedLanguages = normalizeArray(languagesValue);
    if (normalizedLanguages && normalizedLanguages.length > 0) {
      extracted.supported_languages = normalizedLanguages;
      paths.supported_languages = findPathUsed(data, languagesValue, [
        'info.technical.language_support',
        'info.technical.languages',
        'info.languages',
        'info.supported_languages'
      ]);
    }
  }

  // Extract ide_support
  if (!data.ide_support || (Array.isArray(data.ide_support) && data.ide_support.length === 0)) {
    const ideValue = extractValue(data, [
      'info.technical.ide_integration',
      'info.integrations',
      'info.ide_support'
    ]);
    const normalizedIde = normalizeArray(ideValue);
    if (normalizedIde && normalizedIde.length > 0) {
      extracted.ide_support = normalizedIde;
      paths.ide_support = findPathUsed(data, ideValue, [
        'info.technical.ide_integration',
        'info.integrations',
        'info.ide_support'
      ]);
    }
  }

  // Extract github_repo
  if (!data.github_repo) {
    const githubValue = extractValue(data, [
      'info.links.github',
      'info.github_repo',
      'info.github',
      'info.repository'
    ]);
    const normalizedGithub = normalizeGithubUrl(githubValue);
    if (normalizedGithub) {
      extracted.github_repo = normalizedGithub;
      paths.github_repo = findPathUsed(data, githubValue, [
        'info.links.github',
        'info.github_repo',
        'info.github',
        'info.repository'
      ]);
    }
  }

  // Extract logo_url
  if (!data.logo_url) {
    const logoValue = extractValue(data, [
      'info.metadata.logo_url',
      'info.logo_url',
      'info.metadata.image_url',
      'info.image_url'
    ]);
    if (logoValue && typeof logoValue === 'string' && isValidUrl(logoValue.trim())) {
      extracted.logo_url = logoValue.trim();
      paths.logo_url = findPathUsed(data, logoValue, [
        'info.metadata.logo_url',
        'info.logo_url',
        'info.metadata.image_url',
        'info.image_url'
      ]);
    }
  }

  return { extracted, paths };
}

/**
 * Find which path was actually used for extraction
 */
function findPathUsed(obj: any, value: any, paths: string[]): string {
  for (const path of paths) {
    const pathValue = getNestedValue(obj, path);
    if (pathValue === value) {
      return path;
    }
  }
  return 'unknown';
}

// ============= Main Migration Logic =============

async function extractNestedToolData(execute: boolean = false, verbose: boolean = false) {
  const db = getDb();
  if (!db) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║        Extract Nested Tool Data Migration                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const mode = execute ? '🚀 EXECUTE MODE' : '🔍 DRY-RUN MODE';
  console.log(`Mode: ${mode}\n`);

  if (!execute) {
    console.log('ℹ️  Running in dry-run mode. No changes will be made to the database.');
    console.log('   Use --execute flag to apply changes.\n');
  }

  // Initialize stats
  const stats: MigrationStats = {
    totalTools: 0,
    toolsProcessed: 0,
    toolsWithChanges: 0,
    fieldCounts: {
      tagline: 0,
      features: 0,
      supported_languages: 0,
      ide_support: 0,
      github_repo: 0,
      logo_url: 0,
    },
    errors: [],
  };

  const extractionResults: ExtractionResult[] = [];

  try {
    // Fetch all tools
    console.log('📥 Fetching all tools from database...\n');

    const allTools = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        data: tools.data,
      })
      .from(tools)
      .orderBy(tools.name);

    stats.totalTools = allTools.length;
    console.log(`Found ${stats.totalTools} tools\n`);

    // Process each tool
    for (const tool of allTools) {
      stats.toolsProcessed++;

      try {
        const data = tool.data as ToolDataFields;
        const toolId = data.id || tool.id;

        // Extract data
        const { extracted, paths } = extractToolData(data, verbose);
        const fieldsUpdated = Object.keys(extracted);

        if (fieldsUpdated.length === 0) {
          if (verbose) {
            console.log(`⏭️  ${tool.name}: No fields to extract (already populated)`);
          }
          continue;
        }

        // Track which fields were extracted
        stats.toolsWithChanges++;
        fieldsUpdated.forEach(field => {
          if (field in stats.fieldCounts) {
            stats.fieldCounts[field as keyof typeof stats.fieldCounts]++;
          }
        });

        // Create result record
        const result: ExtractionResult = {
          toolId,
          toolName: tool.name,
          toolSlug: tool.slug,
          extracted,
          extractionPaths: paths,
          fieldsUpdated,
        };

        extractionResults.push(result);

        // Display extraction info
        console.log(`✨ ${tool.name} (${tool.slug})`);
        console.log(`   Fields to extract: ${fieldsUpdated.join(', ')}`);

        if (verbose) {
          fieldsUpdated.forEach(field => {
            const value = extracted[field as keyof typeof extracted];
            const path = paths[field];
            console.log(`   • ${field}:`);
            console.log(`     Path: ${path}`);
            if (Array.isArray(value)) {
              console.log(`     Value: [${value.join(', ')}] (${value.length} items)`);
            } else {
              const displayValue = typeof value === 'string' && value.length > 60
                ? value.substring(0, 57) + '...'
                : value;
              console.log(`     Value: ${displayValue}`);
            }
          });
        }

        // Apply updates if in execute mode
        if (execute) {
          const updatedData = {
            ...data,
            ...extracted,
          };

          await db
            .update(tools)
            .set({
              data: updatedData,
              updatedAt: new Date()
            })
            .where(sql`${tools.data}->>'id' = ${toolId}`);

          console.log(`   ✅ Updated in database`);
        }

        console.log('');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          toolName: tool.name,
          error: errorMessage,
        });
        console.error(`   ❌ Error processing ${tool.name}: ${errorMessage}\n`);
      }
    }

    // ============= Summary Report =============

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      MIGRATION SUMMARY                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('📊 Overall Statistics:');
    console.log(`   Total tools in database:        ${stats.totalTools}`);
    console.log(`   Tools processed:                ${stats.toolsProcessed}`);
    console.log(`   Tools with extracted data:      ${stats.toolsWithChanges}`);
    console.log(`   Tools without changes:          ${stats.totalTools - stats.toolsWithChanges}`);
    console.log(`   Errors encountered:             ${stats.errors.length}\n`);

    console.log('📈 Fields Extracted:');
    Object.entries(stats.fieldCounts).forEach(([field, count]) => {
      const percentage = stats.totalTools > 0
        ? ((count / stats.totalTools) * 100).toFixed(1)
        : '0.0';
      console.log(`   ${field.padEnd(25)}: ${count.toString().padStart(3)} tools (${percentage}%)`);
    });

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      stats.errors.forEach(({ toolName, error }) => {
        console.log(`   • ${toolName}: ${error}`);
      });
    }

    // Success rate calculation
    const successRate = stats.toolsProcessed > 0
      ? ((stats.toolsProcessed - stats.errors.length) / stats.toolsProcessed * 100).toFixed(1)
      : '0.0';

    console.log(`\n✅ Success Rate: ${successRate}%`);

    // Tools still needing data
    const toolsStillMissingData = stats.totalTools - stats.toolsWithChanges;
    if (toolsStillMissingData > 0) {
      console.log(`\nℹ️  ${toolsStillMissingData} tools still have missing fields after extraction.`);
      console.log('   These tools may require manual data entry or have no nested data available.');
    }

    // Mode-specific messages
    console.log('\n' + '─'.repeat(68));
    if (!execute) {
      console.log('\n💡 This was a dry-run. To apply these changes, run:');
      console.log('   npx tsx scripts/extract-nested-tool-data.ts --execute\n');
    } else {
      console.log(`\n✅ Migration completed successfully!`);
      console.log(`   ${stats.toolsWithChanges} tools were updated with extracted data.\n`);
    }

    // Detailed results in verbose mode
    if (verbose && extractionResults.length > 0) {
      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║                   DETAILED EXTRACTION LOG                      ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      extractionResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.toolName} (${result.toolSlug})`);
        console.log(`   Tool ID: ${result.toolId}`);
        console.log(`   Fields updated: ${result.fieldsUpdated.length}`);
        result.fieldsUpdated.forEach(field => {
          const value = result.extracted[field as keyof typeof result.extracted];
          const path = result.extractionPaths[field];
          console.log(`\n   ${field}:`);
          console.log(`     Source path: ${path}`);
          if (Array.isArray(value)) {
            console.log(`     Value: [${value.join(', ')}]`);
          } else {
            console.log(`     Value: ${value}`);
          }
        });
        console.log('\n' + '─'.repeat(68) + '\n');
      });
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// ============= CLI Entry Point =============

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const verbose = args.includes('--verbose');

extractNestedToolData(execute, verbose);
