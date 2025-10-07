import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

interface ToolDataFields {
  description?: string;
  tagline?: string;
  logo_url?: string;
  website_url?: string;
  pricing_model?: string;
  pricing_details?: any;
  github_repo?: string;
  features?: string[];
  supported_languages?: string[];
  ide_support?: string[];
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
      pricing_model?: string;
      pricing_details?: any;
    };
  };
  autoCreated?: boolean;
  createdByArticleId?: string;
  firstMentionedDate?: string;
}

interface ToolAuditResult {
  name: string;
  slug: string;
  category: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  completenessScore: number;
  missingFields: string[];
  hasDescription: boolean;
  hasTagline: boolean;
  hasLogoUrl: boolean;
  hasWebsiteUrl: boolean;
  hasPricingModel: boolean;
  hasPricingDetails: boolean;
  hasGithubRepo: boolean;
  hasFeatures: boolean;
  hasSupportedLanguages: boolean;
  hasIdeSupport: boolean;
  isAutoCreated: boolean;
  mentionCount?: number;
  lastMentioned?: string;
  suggestedSources: string[];
}

async function getToolMentions() {
  const db = getDb();
  if (!db) return new Map();

  // Query to count tool mentions from news.tool_mentions JSONB field
  // Each article has tool_mentions as an array of {slug, name, etc}
  const mentionsQuery = sql`
    SELECT
      jsonb_array_elements(tool_mentions)->>'slug' as tool_slug,
      COUNT(*) as mention_count,
      MAX(published_at) as last_mentioned
    FROM news
    WHERE tool_mentions IS NOT NULL AND jsonb_array_length(tool_mentions) > 0
    GROUP BY tool_slug
  `;

  const mentions = await db.execute(mentionsQuery);
  const mentionMap = new Map();

  for (const row of mentions.rows) {
    if (row.tool_slug) {
      mentionMap.set(row.tool_slug, {
        count: parseInt(row.mention_count as string),
        lastMentioned: row.last_mentioned
      });
    }
  }

  return mentionMap;
}

async function getCurrentRankings() {
  const db = getDb();
  if (!db) return new Set();

  // Get tools currently in rankings from the rankings table
  // The rankings table stores complete ranking data in a JSONB field
  const rankingsQuery = sql`
    SELECT data
    FROM rankings
    WHERE is_current = true
    LIMIT 1
  `;

  const results = await db.execute(rankingsQuery);
  const toolSlugs = new Set<string>();

  if (results.rows.length > 0) {
    const rankingsData = results.rows[0].data as any[];
    if (Array.isArray(rankingsData)) {
      for (const item of rankingsData) {
        if (item.slug) {
          toolSlugs.add(item.slug);
        }
      }
    }
  }

  return toolSlugs;
}

function calculatePriority(
  tool: any,
  isInRankings: boolean,
  mentionCount: number,
  isPopular: boolean
): 'high' | 'medium' | 'low' {
  // High priority: In current rankings or has many mentions or is popular
  if (isInRankings || mentionCount >= 5 || isPopular) {
    return 'high';
  }

  // Medium priority: Has some mentions or is not auto-created
  if (mentionCount >= 2 || !tool.isAutoCreated) {
    return 'medium';
  }

  // Low priority: Everything else
  return 'low';
}

function suggestDataSources(toolName: string, slug: string, data: ToolDataFields): string[] {
  const sources: string[] = [];

  // If has website URL, start there
  const websiteUrl = data.website_url || data.info?.links?.website;
  if (websiteUrl) {
    sources.push(`Official website: ${websiteUrl}`);
  } else {
    sources.push(`Google search: "${toolName} AI tool official website"`);
  }

  // If has GitHub
  const githubUrl = data.github_repo || data.info?.links?.github;
  if (githubUrl) {
    sources.push(`GitHub: ${githubUrl}`);
  } else {
    sources.push(`GitHub search: https://github.com/search?q=${slug}`);
  }

  // Product Hunt
  sources.push(`Product Hunt: https://www.producthunt.com/search?q=${toolName}`);

  // Alternative sources
  sources.push(`G2: https://www.g2.com/search?query=${toolName}`);
  sources.push(`Capterra: https://www.capterra.com/search/?search_term=${toolName}`);

  return sources;
}

async function detailedToolsAudit() {
  const db = getDb();
  if (db === null) {
    console.log('No DB connection');
    return;
  }

  console.log('\n=== COMPREHENSIVE TOOLS DATA AUDIT ===\n');

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

  // Get mention counts and rankings
  const mentionMap = await getToolMentions();
  const rankingsSet = await getCurrentRankings();

  console.log(`📊 Total tools in database: ${allTools.length}`);
  console.log(`🏆 Tools in current rankings: ${rankingsSet.size}`);
  console.log(`💬 Tools with article mentions: ${mentionMap.size}\n`);

  // Popular tools list (well-known AI coding tools)
  const popularTools = new Set([
    'cursor', 'github-copilot', 'chatgpt', 'claude', 'gemini',
    'v0', 'devin', 'bolt-new', 'codeium', 'tabnine',
    'windsurf', 'replit', 'lovable', 'sourcegraph', 'cody'
  ]);

  // Audit each tool
  const auditResults: ToolAuditResult[] = [];

  for (const tool of allTools) {
    const data = tool.data as ToolDataFields;
    const mentions = mentionMap.get(tool.slug);
    const isInRankings = rankingsSet.has(tool.slug);
    const isPopular = popularTools.has(tool.slug);

    // Check all fields
    const hasDescription = !!(data?.description || data?.info?.product?.description);
    const hasTagline = !!(data?.tagline || data?.info?.product?.tagline);
    const hasLogoUrl = !!data?.logo_url;
    const hasWebsiteUrl = !!(data?.website_url || data?.info?.links?.website);
    const hasPricingModel = !!(data?.pricing_model || data?.info?.business?.pricing_model);
    const hasPricingDetails = !!(data?.pricing_details || data?.info?.business?.pricing_details);
    const hasGithubRepo = !!(data?.github_repo || data?.info?.links?.github);
    const hasFeatures = !!(data?.features || data?.info?.product?.features);
    const hasSupportedLanguages = !!data?.supported_languages;
    const hasIdeSupport = !!data?.ide_support;
    const isAutoCreated = !!data?.autoCreated;

    // Calculate completeness score (out of 10 required/recommended fields)
    const completenessScore = [
      hasDescription,
      hasTagline,
      hasLogoUrl,
      hasWebsiteUrl,
      hasPricingModel,
      hasPricingDetails,
      hasGithubRepo,
      hasFeatures,
      hasSupportedLanguages,
      hasIdeSupport
    ].filter(Boolean).length;

    // Identify missing fields
    const missingFields: string[] = [];
    if (!hasDescription) missingFields.push('description');
    if (!hasTagline) missingFields.push('tagline');
    if (!hasLogoUrl) missingFields.push('logo_url');
    if (!hasWebsiteUrl) missingFields.push('website_url');
    if (!hasPricingModel) missingFields.push('pricing_model');
    if (!hasPricingDetails) missingFields.push('pricing_details');
    if (!hasGithubRepo) missingFields.push('github_repo');
    if (!hasFeatures) missingFields.push('features');
    if (!hasSupportedLanguages) missingFields.push('supported_languages');
    if (!hasIdeSupport) missingFields.push('ide_support');

    auditResults.push({
      name: tool.name,
      slug: tool.slug,
      category: tool.category,
      status: tool.status,
      priority: calculatePriority(
        { isAutoCreated },
        isInRankings,
        mentions?.count || 0,
        isPopular
      ),
      completenessScore,
      missingFields,
      hasDescription,
      hasTagline,
      hasLogoUrl,
      hasWebsiteUrl,
      hasPricingModel,
      hasPricingDetails,
      hasGithubRepo,
      hasFeatures,
      hasSupportedLanguages,
      hasIdeSupport,
      isAutoCreated,
      mentionCount: mentions?.count || 0,
      lastMentioned: mentions?.lastMentioned as string,
      suggestedSources: suggestDataSources(tool.name, tool.slug, data)
    });
  }

  // Sort by priority and completeness
  const sortedResults = auditResults.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.completenessScore - b.completenessScore;
  });

  // Group by priority
  const highPriority = sortedResults.filter(t => t.priority === 'high');
  const mediumPriority = sortedResults.filter(t => t.priority === 'medium');
  const lowPriority = sortedResults.filter(t => t.priority === 'low');

  // Group by completeness
  const complete = sortedResults.filter(t => t.completenessScore >= 8);
  const partial = sortedResults.filter(t => t.completenessScore >= 4 && t.completenessScore < 8);
  const incomplete = sortedResults.filter(t => t.completenessScore < 4);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    SUMMARY STATISTICS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📊 Completeness Breakdown:');
  console.log(`   ✅ Complete (8-10 fields):   ${complete.length} tools (${(complete.length/allTools.length*100).toFixed(1)}%)`);
  console.log(`   🟡 Partial (4-7 fields):     ${partial.length} tools (${(partial.length/allTools.length*100).toFixed(1)}%)`);
  console.log(`   ❌ Incomplete (0-3 fields):  ${incomplete.length} tools (${(incomplete.length/allTools.length*100).toFixed(1)}%)`);

  console.log('\n🎯 Priority Breakdown:');
  console.log(`   🔴 High priority:   ${highPriority.length} tools (in rankings, popular, or high mentions)`);
  console.log(`   🟠 Medium priority: ${mediumPriority.length} tools (some mentions or manually added)`);
  console.log(`   🟢 Low priority:    ${lowPriority.length} tools (auto-created, few mentions)`);

  console.log('\n📋 Missing Fields Summary:');
  const fieldCounts = {
    description: sortedResults.filter(t => !t.hasDescription).length,
    tagline: sortedResults.filter(t => !t.hasTagline).length,
    logo_url: sortedResults.filter(t => !t.hasLogoUrl).length,
    website_url: sortedResults.filter(t => !t.hasWebsiteUrl).length,
    pricing_model: sortedResults.filter(t => !t.hasPricingModel).length,
    pricing_details: sortedResults.filter(t => !t.hasPricingDetails).length,
    github_repo: sortedResults.filter(t => !t.hasGithubRepo).length,
    features: sortedResults.filter(t => !t.hasFeatures).length,
    supported_languages: sortedResults.filter(t => !t.hasSupportedLanguages).length,
    ide_support: sortedResults.filter(t => !t.hasIdeSupport).length,
  };

  Object.entries(fieldCounts).forEach(([field, count]) => {
    const percentage = (count / allTools.length * 100).toFixed(1);
    console.log(`   ${field.padEnd(22)}: ${count} tools (${percentage}%)`);
  });

  // Detailed reports by priority
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('              🔴 HIGH PRIORITY TOOLS (Top 15)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  highPriority.slice(0, 15).forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   Completeness: ${tool.completenessScore}/10 fields`);
    console.log(`   Category: ${tool.category}`);
    console.log(`   Status: ${tool.status}`);
    console.log(`   Mentions: ${tool.mentionCount} articles`);
    console.log(`   In rankings: ${rankingsSet.has(tool.slug) ? '✅ Yes' : '❌ No'}`);
    console.log(`   Auto-created: ${tool.isAutoCreated ? '⚠️ Yes' : '✅ No'}`);
    console.log(`   Missing fields: ${tool.missingFields.join(', ') || 'None'}`);
    console.log(`   Data sources:`);
    tool.suggestedSources.slice(0, 3).forEach(source => {
      console.log(`     • ${source}`);
    });
    console.log('');
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('              🟠 MEDIUM PRIORITY TOOLS (Sample)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  mediumPriority.slice(0, 5).forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name} (${tool.slug})`);
    console.log(`   Completeness: ${tool.completenessScore}/10 fields`);
    console.log(`   Mentions: ${tool.mentionCount} articles`);
    console.log(`   Missing: ${tool.missingFields.join(', ')}`);
    console.log('');
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      ACTION PLAN');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📝 Immediate Actions (High Priority):');
  console.log(`   1. Focus on ${highPriority.length} high-priority tools`);
  console.log(`   2. Start with ${highPriority.filter(t => t.completenessScore < 4).length} incomplete high-priority tools`);
  console.log(`   3. Prioritize tools in current rankings: ${highPriority.filter(t => rankingsSet.has(t.slug)).length} tools`);

  console.log('\n🔍 Research Strategy:');
  console.log(`   • Tools needing manual research: ${highPriority.filter(t => !t.hasWebsiteUrl).length}`);
  console.log(`   • Tools with website (easier): ${highPriority.filter(t => t.hasWebsiteUrl).length}`);
  console.log(`   • Auto-created tools needing validation: ${highPriority.filter(t => t.isAutoCreated).length}`);

  console.log('\n⏱️ Effort Estimates:');
  console.log(`   • Quick wins (has website): ~5-10 min per tool × ${highPriority.filter(t => t.hasWebsiteUrl && t.completenessScore < 8).length} = ${highPriority.filter(t => t.hasWebsiteUrl && t.completenessScore < 8).length * 7.5} min`);
  console.log(`   • Research required: ~15-20 min per tool × ${highPriority.filter(t => !t.hasWebsiteUrl).length} = ${highPriority.filter(t => !t.hasWebsiteUrl).length * 17.5} min`);
  console.log(`   • Total estimated time: ~${Math.round((highPriority.filter(t => t.hasWebsiteUrl && t.completenessScore < 8).length * 7.5 + highPriority.filter(t => !t.hasWebsiteUrl).length * 17.5) / 60)} hours`);

  // Export JSON for further processing
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('                  DETAILED JSON EXPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const exportData = {
    summary: {
      totalTools: allTools.length,
      completeness: {
        complete: complete.length,
        partial: partial.length,
        incomplete: incomplete.length
      },
      priority: {
        high: highPriority.length,
        medium: mediumPriority.length,
        low: lowPriority.length
      },
      fieldCounts
    },
    highPriorityTools: highPriority.map(t => ({
      name: t.name,
      slug: t.slug,
      category: t.category,
      completenessScore: t.completenessScore,
      missingFields: t.missingFields,
      mentionCount: t.mentionCount,
      inRankings: rankingsSet.has(t.slug),
      suggestedSources: t.suggestedSources
    })),
    mediumPriorityTools: mediumPriority.map(t => ({
      name: t.name,
      slug: t.slug,
      completenessScore: t.completenessScore,
      missingFields: t.missingFields
    })),
    lowPriorityTools: lowPriority.map(t => ({
      name: t.name,
      slug: t.slug,
      completenessScore: t.completenessScore
    }))
  };

  console.log(JSON.stringify(exportData, null, 2));
}

detailedToolsAudit();
