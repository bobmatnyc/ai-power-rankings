import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';

interface ToolDataFields {
  description?: string;
  tagline?: string;
  logo_url?: string;
  website_url?: string;
  info?: {
    product?: {
      description?: string;
      tagline?: string;
      features?: string[];
    };
    links?: {
      website?: string;
      github?: string;
    };
    business?: {
      pricing_details?: any;
    };
  };
  autoCreated?: boolean;
  createdByArticleId?: string;
  firstMentionedDate?: string;
}

async function auditToolsData() {
  const db = getDb();
  if (db === null) {
    console.log('No DB connection');
    return;
  }

  // Get all tools
  const allTools = await db
    .select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      category: tools.category,
      status: tools.status,
      data: tools.data
    })
    .from(tools)
    .orderBy(tools.name);

  console.log(`\n=== TOOLS DATA COMPLETENESS AUDIT ===`);
  console.log(`Total tools: ${allTools.length}\n`);

  // Categorize tools by data completeness
  const toolsWithFullData: any[] = [];
  const toolsWithPartialData: any[] = [];
  const toolsWithMinimalData: any[] = [];
  const autoCreatedTools: any[] = [];

  const missingFields = {
    description: 0,
    tagline: 0,
    logo_url: 0,
    website_url: 0,
    info: 0,
    any_content: 0
  };

  allTools.forEach(tool => {
    const data = tool.data as ToolDataFields;

    // Check if auto-created
    if (data?.autoCreated) {
      autoCreatedTools.push({
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        createdByArticle: data.createdByArticleId,
        firstMentioned: data.firstMentionedDate
      });
    }

    // Check what fields are present
    const hasDescription = !!(data?.description || data?.info?.product?.description);
    const hasTagline = !!(data?.tagline || data?.info?.product?.tagline);
    const hasLogoUrl = !!data?.logo_url;
    const hasWebsiteUrl = !!(data?.website_url || data?.info?.links?.website);
    const hasInfo = !!data?.info;

    // Count missing fields
    if (!hasDescription) missingFields.description++;
    if (!hasTagline) missingFields.tagline++;
    if (!hasLogoUrl) missingFields.logo_url++;
    if (!hasWebsiteUrl) missingFields.website_url++;
    if (!hasInfo) missingFields.info++;

    const hasAnyContent = hasDescription || hasTagline || hasLogoUrl || hasWebsiteUrl || hasInfo;
    if (!hasAnyContent) {
      missingFields.any_content++;
    }

    // Categorize
    const fieldCount = [hasDescription, hasTagline, hasLogoUrl, hasWebsiteUrl, hasInfo].filter(Boolean).length;

    if (fieldCount >= 4) {
      toolsWithFullData.push(tool);
    } else if (fieldCount >= 2) {
      toolsWithPartialData.push(tool);
    } else {
      toolsWithMinimalData.push({
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        status: tool.status,
        hasDescription,
        hasTagline,
        hasLogoUrl,
        hasWebsiteUrl,
        hasInfo,
        data: data
      });
    }
  });

  // Print statistics
  console.log('=== DATA COMPLETENESS BREAKDOWN ===');
  console.log(`Tools with FULL data (4+ fields):     ${toolsWithFullData.length} (${(toolsWithFullData.length/allTools.length*100).toFixed(1)}%)`);
  console.log(`Tools with PARTIAL data (2-3 fields): ${toolsWithPartialData.length} (${(toolsWithPartialData.length/allTools.length*100).toFixed(1)}%)`);
  console.log(`Tools with MINIMAL data (0-1 fields): ${toolsWithMinimalData.length} (${(toolsWithMinimalData.length/allTools.length*100).toFixed(1)}%)`);

  console.log('\n=== MISSING FIELDS COUNT ===');
  console.log(`Missing Description:  ${missingFields.description} tools (${(missingFields.description/allTools.length*100).toFixed(1)}%)`);
  console.log(`Missing Tagline:      ${missingFields.tagline} tools (${(missingFields.tagline/allTools.length*100).toFixed(1)}%)`);
  console.log(`Missing Logo URL:     ${missingFields.logo_url} tools (${(missingFields.logo_url/allTools.length*100).toFixed(1)}%)`);
  console.log(`Missing Website URL:  ${missingFields.website_url} tools (${(missingFields.website_url/allTools.length*100).toFixed(1)}%)`);
  console.log(`Missing Info Object:  ${missingFields.info} tools (${(missingFields.info/allTools.length*100).toFixed(1)}%)`);
  console.log(`Missing ALL content:  ${missingFields.any_content} tools (${(missingFields.any_content/allTools.length*100).toFixed(1)}%)`);

  console.log('\n=== AUTO-CREATED TOOLS ===');
  console.log(`Auto-created tools: ${autoCreatedTools.length} (${(autoCreatedTools.length/allTools.length*100).toFixed(1)}%)`);

  // Show samples of tools with minimal data
  console.log('\n=== SAMPLE TOOLS WITH MINIMAL DATA (first 10) ===');
  toolsWithMinimalData.slice(0, 10).forEach(tool => {
    console.log(`\n${tool.name} (${tool.slug})`);
    console.log(`  Category: ${tool.category}`);
    console.log(`  Status: ${tool.status}`);
    console.log(`  Has Description: ${tool.hasDescription}`);
    console.log(`  Has Tagline: ${tool.hasTagline}`);
    console.log(`  Has Logo: ${tool.hasLogoUrl}`);
    console.log(`  Has Website: ${tool.hasWebsiteUrl}`);
    console.log(`  Has Info: ${tool.hasInfo}`);
    console.log(`  Data: ${JSON.stringify(tool.data, null, 2)}`);
  });

  // Show samples of full data tools
  console.log('\n\n=== SAMPLE TOOLS WITH FULL DATA (first 3) ===');
  toolsWithFullData.slice(0, 3).forEach(tool => {
    console.log(`\n${tool.name} (${tool.slug})`);
    console.log(`  Category: ${tool.category}`);
    const data = tool.data as ToolDataFields;
    console.log(`  Data structure: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
  });

  // Export summary
  console.log('\n\n=== EXPORT SUMMARY FOR REPORTING ===');
  console.log(JSON.stringify({
    totalTools: allTools.length,
    completeness: {
      full: toolsWithFullData.length,
      partial: toolsWithPartialData.length,
      minimal: toolsWithMinimalData.length
    },
    missingFields: missingFields,
    autoCreatedCount: autoCreatedTools.length,
    toolsNeedingContent: toolsWithMinimalData.map(t => ({
      name: t.name,
      slug: t.slug,
      category: t.category
    }))
  }, null, 2));
}

auditToolsData();
