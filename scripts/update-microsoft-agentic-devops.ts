import { db } from '../lib/db';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function updateMicrosoftAgenticDevOps() {
  console.log('Starting Microsoft Agentic DevOps update...');

  try {
    // First, get the current tool data
    const msTool = await db.select()
      .from(tools)
      .where(eq(tools.slug, 'microsoft-agentic-devops'))
      .limit(1);

    if (!msTool.length) {
      console.log('❌ Microsoft Agentic DevOps tool not found');
      return;
    }

    const currentData = msTool[0].data as any || {};

    // Update the data JSONB field with complete metadata
    const updatedData = {
      ...currentData,
      description: 'Open-source SDK and runtime for building, orchestrating, and deploying AI agents and multi-agent workflows with .NET and Python support',
      website_url: 'https://azure.microsoft.com/en-us/blog/agentic-devops-evolving-software-development-with-github-copilot-and-microsoft-azure/',
      documentation_url: 'https://learn.microsoft.com/en-us/azure/ai-foundry/',
      launch_date: '2025-10-01',
      pricing: {
        model: 'free',
        details: 'Open-source SDK, free to use. Azure AI Foundry integration available for enterprise features.'
      },
      features: [
        'Multi-agent workflow orchestration',
        'Agent-to-Agent (A2A) communication',
        'MCP (Model Context Protocol) support',
        '.NET and Python SDK',
        'Azure integration for enterprise deployment',
        'Open-source runtime',
        'Visual Studio integration',
        'GitHub Copilot integration'
      ],
      metadata: {
        ...(currentData.metadata || {}),
        description: 'Open-source SDK and runtime for building, orchestrating, and deploying AI agents and multi-agent workflows with .NET and Python support'
      }
    };

    // Also update the name and status at the top level
    const result = await db.update(tools)
      .set({
        name: 'Microsoft Agent Framework',
        status: 'preview',
        data: updatedData
      })
      .where(eq(tools.slug, 'microsoft-agentic-devops'))
      .returning();

    if (result.length > 0) {
      const data = result[0].data as any;
      console.log('✅ Microsoft Agentic DevOps updated successfully');
      console.log(`   - Name: ${result[0].name}`);
      console.log(`   - Description: ${data.description?.substring(0, 80)}...`);
      console.log(`   - Website: ${data.website_url}`);
      console.log(`   - Status: ${result[0].status}`);
      console.log(`   - Features: ${data.features?.length || 0} features added`);
    } else {
      console.log('❌ Failed to update Microsoft Agentic DevOps');
    }

    console.log('\n🎉 Microsoft Agentic DevOps update complete');
  } catch (error) {
    console.error('❌ Error updating Microsoft Agentic DevOps:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

updateMicrosoftAgenticDevOps();
