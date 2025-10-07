/**
 * Verify Extraction Results
 *
 * Compare tool data before and after running the extraction script.
 * Shows specific examples of what was extracted from nested paths.
 *
 * Usage:
 *   npx tsx scripts/verify-extraction-results.ts [tool-slug]
 *
 * Examples:
 *   npx tsx scripts/verify-extraction-results.ts           # Shows all tools with extractions
 *   npx tsx scripts/verify-extraction-results.ts cursor    # Shows details for Cursor
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

interface ToolData {
  id?: string;
  tagline?: string;
  features?: string[];
  supported_languages?: string[];
  ide_support?: string[];
  github_repo?: string;
  logo_url?: string;
  info?: {
    product?: {
      tagline?: string;
      features?: string[];
    };
    technical?: {
      language_support?: string[];
      ide_integration?: string | string[];
    };
    links?: {
      github?: string;
    };
    metadata?: {
      logo_url?: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

async function verifyExtractionResults(targetSlug?: string) {
  const db = getDb();
  if (!db) {
    console.error('❌ Database connection failed');
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           Extraction Results Verification                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Fetch tools
  let allTools;
  if (targetSlug) {
    console.log(`🔍 Searching for tool: ${targetSlug}\n`);
    allTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        data: tools.data,
      })
      .from(tools)
      .where(eq(tools.slug, targetSlug));

    if (allTools.length === 0) {
      console.error(`❌ Tool not found: ${targetSlug}`);
      process.exit(1);
    }
  } else {
    allTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        data: tools.data,
      })
      .from(tools)
      .orderBy(tools.name);
  }

  let toolsWithExtractions = 0;
  let totalExtractions = 0;

  for (const tool of allTools) {
    const data = tool.data as ToolData;
    const extractionInfo: string[] = [];

    // Check tagline
    if (data.tagline && data.info?.product?.tagline) {
      extractionInfo.push(`  ✅ tagline: "${data.tagline}" (from info.product.tagline)`);
    } else if (data.tagline && data.info?.tagline) {
      extractionInfo.push(`  ✅ tagline: "${data.tagline}" (from info.tagline)`);
    }

    // Check features
    if (data.features && Array.isArray(data.features) && data.features.length > 0) {
      if (data.info?.features || data.info?.product?.features) {
        const count = data.features.length;
        extractionInfo.push(`  ✅ features: ${count} items extracted from info.features`);
      }
    }

    // Check supported_languages
    if (data.supported_languages && Array.isArray(data.supported_languages) && data.supported_languages.length > 0) {
      if (data.info?.technical?.language_support) {
        const count = data.supported_languages.length;
        extractionInfo.push(`  ✅ supported_languages: ${count} languages from info.technical.language_support`);
      }
    }

    // Check ide_support
    if (data.ide_support && Array.isArray(data.ide_support) && data.ide_support.length > 0) {
      if (data.info?.technical?.ide_integration) {
        const count = data.ide_support.length;
        extractionInfo.push(`  ✅ ide_support: ${count} IDEs from info.technical.ide_integration`);
      }
    }

    // Check github_repo
    if (data.github_repo && data.info?.links?.github) {
      extractionInfo.push(`  ✅ github_repo: ${data.github_repo} (from info.links.github)`);
    }

    // Check logo_url
    if (data.logo_url && data.info?.metadata?.logo_url) {
      extractionInfo.push(`  ✅ logo_url: ${data.logo_url} (from info.metadata.logo_url)`);
    }

    if (extractionInfo.length > 0) {
      toolsWithExtractions++;
      totalExtractions += extractionInfo.length;

      console.log(`📦 ${tool.name} (${tool.slug})`);
      extractionInfo.forEach(info => console.log(info));

      // In detailed mode, show the actual data
      if (targetSlug) {
        console.log('\n  📊 Current Top-Level Data:');
        if (data.tagline) console.log(`     tagline: "${data.tagline}"`);
        if (data.features) console.log(`     features: [${data.features.slice(0, 3).join(', ')}${data.features.length > 3 ? ', ...' : ''}] (${data.features.length} total)`);
        if (data.supported_languages) console.log(`     supported_languages: [${data.supported_languages.slice(0, 5).join(', ')}${data.supported_languages.length > 5 ? ', ...' : ''}] (${data.supported_languages.length} total)`);
        if (data.ide_support) console.log(`     ide_support: [${data.ide_support.join(', ')}]`);
        if (data.github_repo) console.log(`     github_repo: ${data.github_repo}`);
        if (data.logo_url) console.log(`     logo_url: ${data.logo_url}`);

        console.log('\n  🔍 Nested Data Still in info:');
        if (data.info?.product?.tagline) console.log(`     info.product.tagline: "${data.info.product.tagline}"`);
        if (data.info?.features) console.log(`     info.features: ${Array.isArray(data.info.features) ? `[...] (${data.info.features.length} items)` : 'present'}`);
        if (data.info?.technical?.language_support) console.log(`     info.technical.language_support: [...] (${Array.isArray(data.info.technical.language_support) ? data.info.technical.language_support.length : '?'} items)`);
        if (data.info?.technical?.ide_integration) console.log(`     info.technical.ide_integration: ${data.info.technical.ide_integration}`);
        if (data.info?.links?.github) console.log(`     info.links.github: ${data.info.links.github}`);
      }

      console.log('');
    }
  }

  // Summary
  console.log('═'.repeat(68));
  console.log('\n📊 Verification Summary:\n');
  console.log(`   Total tools analyzed:          ${allTools.length}`);
  console.log(`   Tools with extractions:        ${toolsWithExtractions}`);
  console.log(`   Total fields extracted:        ${totalExtractions}`);
  console.log(`   Tools without extractions:     ${allTools.length - toolsWithExtractions}`);

  if (!targetSlug) {
    console.log('\n💡 Tip: Run with a specific tool slug to see detailed data:');
    console.log('   npx tsx scripts/verify-extraction-results.ts cursor\n');
  } else {
    console.log('\n✅ Detailed verification complete\n');
  }
}

// CLI Entry Point
const targetSlug = process.argv[2];
verifyExtractionResults(targetSlug);
