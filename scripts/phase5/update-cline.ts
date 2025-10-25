import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Cline - Agentic VS Code Extension
 * Update comprehensive content for autonomous coding agent
 */

const clineData = {
  id: "cline",
  name: "Cline",
  company: "Cline (Open Source)",
  tagline: "Free open-source agentic VS Code extension with 500K+ installs and autonomous file editing, terminal commands, and browser automation",
  description: "Cline is a free, open-source autonomous coding agent for VS Code that leverages Claude Sonnet's agentic capabilities to handle complex software development tasks step-by-step with tools for creating and editing files, exploring large projects, using the browser, and executing terminal commands after user permission. With 500K+ installs and position as a top agentic AI tool for VS Code, Cline provides a human-in-the-loop GUI requiring approval for every file change and terminal command while taking workspace snapshots at each step with Compare and Restore buttons to see diffs and roll back changes. Supporting API providers including OpenRouter, Anthropic, OpenAI, Google Gemini, AWS Bedrock, Azure, GCP Vertex, Cerebras, Groq, plus any OpenAI-compatible API or local models through LM Studio/Ollama, Cline tracks total tokens and API usage cost for entire task loops and individual requests with users paying only for AI models at exactly provider prices with no markups or subscriptions. Cline analyzes file structure and source code ASTs, runs regex searches, and reads relevant files to understand existing projects, while its web development capabilities include launching sites in headless browser to click, type, scroll, and capture screenshots plus console logs for fixing runtime errors and visual bugs.",
  overview: "Cline revolutionizes VS Code development by bringing true agentic AI capabilities directly into the IDE, enabling developers to delegate complex multi-step tasks to an autonomous agent that can create and edit files, execute terminal commands, use browsers for testing, and leverage the Model Context Protocol (MCP) to create new tools and extend its own capabilities. Unlike passive code completion tools, Cline actively monitors linter and compiler errors after editing files, proactively fixing issues like missing imports and syntax errors while executing commands in the terminal and monitoring output to react to dev server issues and runtime problems. The platform's sophisticated project understanding comes from analyzing file structure and source code Abstract Syntax Trees (ASTs), running regex searches across the codebase, and reading relevant files to get up to speed in existing projects rather than just working with isolated code snippets. For web development workflows, Cline can launch sites in a headless browser, click elements, type into forms, scroll through pages, and capture screenshots plus console logs to identify and fix runtime errors and visual bugs without requiring manual testing. Cline's safety-first approach provides a human-in-the-loop GUI requiring developer approval for every file change and terminal command, while taking snapshots of the workspace at each step with Compare and Restore buttons allowing developers to see exact diffs and roll back changes if needed, ensuring developers maintain full control while benefiting from autonomous capabilities. The platform's model flexibility supports major API providers including OpenRouter, Anthropic, OpenAI, Google Gemini, AWS Bedrock, Azure, GCP Vertex, Cerebras, and Groq, plus any OpenAI-compatible API or local models through LM Studio and Ollama, with transparent cost tracking showing total tokens and API usage for entire task loops and individual requests. Free and open-source with users paying only for AI models at exactly the provider's price with no markups or subscription fees, Cline supports adding images to convert mockups into functional apps or fix bugs with screenshots, uses MCP to create custom tools and extend capabilities, and provides complete transparency into token usage and costs. As one of the top agentic AI tools for VS Code by install count with 500K+ installations, Cline represents the definitive open-source approach to autonomous coding agents where developers maintain control while delegating complex, multi-step development tasks to AI that understands entire project context and can take autonomous actions with permission.",
  website: "https://cline.bot/",
  website_url: "https://cline.bot/",
  launch_year: 2024,
  updated_2025: true,
  category: "open-source-framework",
  pricing_model: "free",

  features: [
    "Autonomous coding agent with step-by-step task handling",
    "Create and edit files with linter/compiler error monitoring",
    "Proactive fixing of missing imports and syntax errors",
    "Execute terminal commands with output monitoring",
    "React to dev server issues after editing files",
    "Headless browser automation (click, type, scroll)",
    "Screenshot and console log capture for debugging",
    "Runtime error and visual bug fixing",
    "Model Context Protocol (MCP) for creating custom tools",
    "File structure and AST analysis for project understanding",
    "Regex searches across codebase",
    "Human-in-the-loop GUI for approvals",
    "Workspace snapshots with Compare and Restore",
    "Support for mockup-to-app with image input",
    "Multi-provider support (OpenRouter, Anthropic, OpenAI, Gemini, Bedrock, Azure, Vertex, Cerebras, Groq)",
    "Local model support (LM Studio, Ollama)",
    "Token and cost tracking per task and request",
    "No markups or subscription fees"
  ],

  use_cases: [
    "Autonomous multi-step development tasks",
    "File creation and editing with error monitoring",
    "Terminal command execution and automation",
    "Web development with browser automation testing",
    "Runtime error debugging with screenshots",
    "Visual bug fixing with console log analysis",
    "Mockup-to-functional app conversion",
    "Large project exploration and understanding",
    "Custom tool creation via MCP",
    "Cost-effective AI coding with local models"
  ],

  integrations: [
    "VS Code (native extension)",
    "Claude Sonnet (agentic capabilities)",
    "OpenRouter API",
    "Anthropic API",
    "OpenAI API",
    "Google Gemini API",
    "AWS Bedrock",
    "Azure OpenAI",
    "GCP Vertex AI",
    "Cerebras",
    "Groq",
    "LM Studio (local models)",
    "Ollama (local models)",
    "Model Context Protocol (MCP)",
    "Any OpenAI-compatible API"
  ],

  pricing: {
    model: "Free open-source with pay-as-you-go AI model costs",
    free_tier: true,
    tiers: [
      {
        name: "Free (Open Source)",
        price: "$0",
        billing: "Forever",
        target: "All developers",
        recommended: true,
        features: [
          "Complete Cline functionality",
          "Autonomous coding agent",
          "File and terminal operations",
          "Browser automation",
          "MCP tool creation",
          "Multi-provider AI support",
          "Local model support",
          "Token and cost tracking",
          "No subscription fees",
          "Pay only for AI models at provider prices"
        ]
      }
    ],
    ai_costs: {
      note: "Users pay AI providers directly at their exact rates",
      providers: "OpenRouter, Anthropic, OpenAI, Gemini, Bedrock, Azure, Vertex, Cerebras, Groq",
      local_option: "Free with LM Studio or Ollama local models",
      transparency: "Complete token and cost tracking shown in UI"
    }
  },

  differentiators: [
    "500K+ VS Code installs (top agentic AI tool)",
    "Free and open-source (no subscription fees)",
    "Autonomous agent with multi-step task handling",
    "Headless browser automation for web development",
    "Human-in-the-loop with workspace snapshots",
    "Compare and Restore for easy rollbacks",
    "MCP support for custom tool creation",
    "AST analysis for deep project understanding",
    "Multi-provider flexibility (10+ AI providers)",
    "Local model support (LM Studio, Ollama)",
    "No markups on AI costs (exact provider pricing)",
    "Proactive error fixing (linter/compiler monitoring)",
    "Screenshot and console log debugging"
  ],

  target_audience: "VS Code developers seeking autonomous coding assistance; full-stack engineers automating development tasks; web developers requiring browser testing automation; cost-conscious developers using local AI models; teams needing transparent AI cost tracking; open-source enthusiasts; developers wanting control over AI provider choice; and engineers building custom tools via MCP",

  recent_updates_2025: [
    "Achieved 500K+ VS Code installations",
    "Added Model Context Protocol (MCP) support",
    "Enhanced browser automation capabilities",
    "Improved AST analysis for project understanding",
    "Expanded AI provider support (Cerebras, Groq)",
    "Added workspace snapshot Compare and Restore",
    "Enhanced token and cost tracking UI",
    "Improved proactive error fixing",
    "Added image input for mockup conversion",
    "Strengthened human-in-the-loop controls"
  ],

  compliance: [
    "Open-source transparency (GitHub repository)",
    "User controls all data and AI provider choice",
    "Local model option for complete privacy",
    "No data sent to Cline (direct to AI providers)",
    "Workspace snapshot data stays local"
  ],

  parent_company: "Open Source Community"
};

async function updateCline() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Cline with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: clineData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'cline'));

    console.log('✅ Cline updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Cline (Open Source)');
    console.log('   - Category: open-source-framework');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: Free open-source (pay AI providers directly)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 15 AI providers and platforms');
    console.log('   - Metrics: 500K+ VS Code installs');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Cline:', error);
    throw error;
  }
}

updateCline();
