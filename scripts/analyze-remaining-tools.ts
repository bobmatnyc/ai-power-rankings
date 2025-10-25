/**
 * Analyze Remaining Tools for Phase 7 (FINAL PHASE)
 *
 * Queries database to identify all tools and their content completeness
 * to complete the final 10 tools for 100% database coverage.
 */

import { db } from '../lib/db';
import { tools } from '../lib/db/schema';

// Phases 1-6 completed tools (40 tools)
const COMPLETED_TOOLS = [
  // Phase 1: Market Leaders (6 tools)
  'cursor', 'github-copilot', 'codeium', 'supermaven', 'amazon-q-developer', 'tabnine',

  // Phase 2: Rising Stars (6 tools)
  'windsurf', 'continue', 'claude-sonnet-4-5', 'replit-agent', 'v0', 'bolt-new',

  // Phase 3: Specialized Tools (8 tools)
  'aider', 'gptengineer', 'lovable', 'pieces', 'pythagora', 'cody',
  'cursor-composer', 'sourcegraph-cody',

  // Phase 4: Emerging Players (6 tools)
  'cline', 'blackbox', 'plandex', 'greptile', 'fine', 'codegen',

  // Phase 5: Niche & Enterprise (7 tools)
  'anysphere-cursor', 'augment-code', 'devzero', 'mutable', 'sweep',
  'qodo-merge', 'stackblitz',

  // Phase 6: Testing & Quality (7 tools)
  'poolside', 'devin', 'jules', 'magic', 'factory', 'codiumate', 'cursor-agent'
];

interface ToolAnalysis {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  contentCompleteness: number;
  hasDescription: boolean;
  hasFeatures: boolean;
  hasPricing: boolean;
  hasUseCases: boolean;
  hasIntegrations: boolean;
  dataKeys: string[];
}

async function analyzeTools() {
  try {
    console.log('🔍 Analyzing all tools in database for Phase 7 (FINAL PHASE)...\n');

    const allTools = await db.select().from(tools).orderBy(tools.name);

    console.log(`📊 Total tools in database: ${allTools.length}`);
    console.log(`✅ Completed in Phases 1-6: ${COMPLETED_TOOLS.length}`);
    console.log(`📋 Remaining tools (FINAL PHASE 7): ${allTools.length - COMPLETED_TOOLS.length}\n`);

    // Analyze each tool
    const toolAnalysis: ToolAnalysis[] = allTools.map(tool => {
      const data = tool.data as any || {};
      const dataKeys = Object.keys(data);

      const hasDescription = !!(data.description || data.tagline || data.overview);
      const hasFeatures = !!(data.features?.length > 0 || data.keyFeatures?.length > 0);
      const hasPricing = !!(data.pricing || data.pricingModel || data.plans);
      const hasUseCases = !!(data.useCases?.length > 0 || data.examples?.length > 0);
      const hasIntegrations = !!(data.integrations?.length > 0 || data.platforms?.length > 0);

      // Calculate completeness percentage
      const completenessFactors = [
        hasDescription,
        hasFeatures,
        hasPricing,
        hasUseCases,
        hasIntegrations
      ];
      const contentCompleteness = (completenessFactors.filter(Boolean).length / completenessFactors.length) * 100;

      return {
        id: tool.id,
        name: tool.name,
        slug: tool.slug,
        category: tool.category || 'Unknown',
        status: tool.status || 'active',
        contentCompleteness: Math.round(contentCompleteness),
        hasDescription,
        hasFeatures,
        hasPricing,
        hasUseCases,
        hasIntegrations,
        dataKeys
      };
    });

    // Filter remaining tools
    const remainingTools = toolAnalysis.filter(
      tool => !COMPLETED_TOOLS.includes(tool.slug)
    );

    console.log('=' .repeat(80));
    console.log('REMAINING TOOLS FOR PHASE 7 (FINAL COMPLETION PHASE)');
    console.log('='.repeat(80));
    console.log();

    // Group by completeness
    const criticallyIncomplete = remainingTools.filter(t => t.contentCompleteness < 20);
    const partiallyComplete = remainingTools.filter(t => t.contentCompleteness >= 20 && t.contentCompleteness < 60);
    const mostlyComplete = remainingTools.filter(t => t.contentCompleteness >= 60);

    console.log(`🔴 Critically Incomplete (<20%): ${criticallyIncomplete.length} tools`);
    console.log(`🟡 Partially Complete (20-59%): ${partiallyComplete.length} tools`);
    console.log(`🟢 Mostly Complete (60%+): ${mostlyComplete.length} tools\n`);

    // Display all remaining tools with details
    console.log('\n📋 DETAILED REMAINING TOOLS LIST:\n');
    remainingTools
      .sort((a, b) => b.contentCompleteness - a.contentCompleteness)
      .forEach((tool, index) => {
        const statusEmoji = tool.status === 'active' ? '✅' :
                          tool.status === 'inactive' ? '⚠️' :
                          tool.status === 'deprecated' ? '❌' : '❓';
        const completenessEmoji = tool.contentCompleteness >= 60 ? '🟢' :
                                 tool.contentCompleteness >= 20 ? '🟡' : '🔴';

        console.log(`${index + 1}. ${tool.name} (${tool.slug})`);
        console.log(`   Status: ${statusEmoji} ${tool.status}`);
        console.log(`   Category: ${tool.category}`);
        console.log(`   Completeness: ${completenessEmoji} ${tool.contentCompleteness}%`);
        console.log(`   Content: ${tool.hasDescription ? '✓' : '✗'} Desc | ${tool.hasFeatures ? '✓' : '✗'} Features | ${tool.hasPricing ? '✓' : '✗'} Pricing | ${tool.hasUseCases ? '✓' : '✗'} Use Cases | ${tool.hasIntegrations ? '✓' : '✗'} Integrations`);
        console.log(`   Data keys: ${tool.dataKeys.length > 0 ? tool.dataKeys.join(', ') : 'none'}`);
        console.log();
      });

    // Output JSON for further analysis
    console.log('\n' + '='.repeat(80));
    console.log('JSON OUTPUT FOR ANALYSIS');
    console.log('='.repeat(80));
    console.log(JSON.stringify({
      summary: {
        total: allTools.length,
        completed: COMPLETED_TOOLS.length,
        remaining: remainingTools.length,
        criticallyIncomplete: criticallyIncomplete.length,
        partiallyComplete: partiallyComplete.length,
        mostlyComplete: mostlyComplete.length
      },
      remainingTools: remainingTools.map(t => ({
        name: t.name,
        slug: t.slug,
        category: t.category,
        status: t.status,
        completeness: t.contentCompleteness,
        hasContent: {
          description: t.hasDescription,
          features: t.hasFeatures,
          pricing: t.hasPricing,
          useCases: t.hasUseCases,
          integrations: t.hasIntegrations
        }
      }))
    }, null, 2));

  } catch (error) {
    console.error('❌ Error analyzing tools:', error);
    throw error;
  }
}

// Run analysis
analyzeTools()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
