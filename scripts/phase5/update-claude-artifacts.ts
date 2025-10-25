import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Claude Artifacts - Interactive Code Generation
 * Update comprehensive content for Anthropic's code generation feature
 */

const claudeArtifactsData = {
  id: "claude-artifacts",
  name: "Claude Artifacts",
  company: "Anthropic",
  tagline: "Interactive code generation and preview with Claude Sonnet 4.5 achieving 77.2% on SWE-bench Verified",
  description: "Claude Artifacts is Anthropic's interactive code generation and preview feature integrated directly into Claude, enabling developers to create structured, visual content and code in a dedicated workspace alongside conversational AI interactions. Powered by Claude Sonnet 4.5 which achieves 77.2% on SWE-bench Verified benchmark (industry-leading performance for code generation), Artifacts enables creation of interactive applications, visualizations, and code projects that persist in a separate panel while maintaining conversational context for iterative refinement. Available on Claude Pro ($20/month), Max ($100-$200/month), and integrated with Claude Code (contributing $500M+ annualized revenue), Artifacts supports agentic coding capabilities allowing developers to spin up autonomous agents that work independently. The feature has evolved with Anthropic's web app launch for Claude Code bringing agentic capabilities beyond command-line to claude.ai and Claude iOS app, while Sonnet 4.5's API pricing starts at $3 per million input tokens and $15 per million output tokens with up to 90% cost savings through prompt caching and 50% savings via batch processing.",
  overview: "Claude Artifacts revolutionizes AI-assisted development by providing a persistent, interactive workspace where code, applications, and visualizations appear in a dedicated panel separate from the conversational interface, enabling developers to see live previews of their creations while iteratively refining through natural language instructions. Unlike traditional chat-based code generation that produces static snippets in messages, Artifacts creates living projects that persist across the conversation, allowing developers to make incremental improvements, add features, fix bugs, and refine functionality without losing context or starting from scratch each iteration. Powered by Claude Sonnet 4.5's breakthrough 77.2% performance on SWE-bench Verified benchmark (surpassing most competitors), Artifacts delivers production-grade code generation with multi-step edits, tool use, retries, and planning capabilities that handle complex software development tasks autonomously. The platform's agentic coding capabilities allow developers to spin up autonomous agents that work independently on tasks, with Claude Code accounting for more than $500M of Anthropic's revenue on an annualized basis as organizations adopt AI-powered development at scale. Artifacts supports creating interactive web applications with React components, data visualizations with charts and graphs, SVG graphics and diagrams, HTML/CSS/JavaScript projects, Markdown documents with live preview, and structured data outputs like JSON and YAML, all with immediate visual feedback and iterative refinement through conversational AI. Available on Claude Pro ($20/month with around $17/month annual pricing), Max plans ($100-$200/month for higher usage limits), and accessible via claude.ai web app and Claude iOS app with web search available at $10 per 1,000 searches plus token costs, Artifacts represents Anthropic's vision for collaborative AI development where code generation, preview, and refinement happen seamlessly in a unified interface. With Sonnet 4.5 API pricing at $3 per million input tokens and $15 per million output tokens, plus up to 90% cost savings with prompt caching and 50% savings via batch processing, Artifacts delivers enterprise-grade code generation at competitive pricing for developers and organizations seeking to accelerate development with AI assistance.",
  website: "https://www.anthropic.com/claude/sonnet",
  website_url: "https://www.anthropic.com/claude/sonnet",
  launch_year: 2024,
  updated_2025: true,
  category: "app-builder",
  pricing_model: "freemium",

  features: [
    "Claude Sonnet 4.5: 77.2% on SWE-bench Verified benchmark",
    "Interactive code generation in dedicated workspace",
    "Live preview of applications and visualizations",
    "Persistent projects across conversational iterations",
    "Agentic coding: Autonomous agents working independently",
    "Multi-step edits, tool use, retries, and planning",
    "React component creation with live preview",
    "Data visualizations with charts and graphs",
    "SVG graphics and diagram generation",
    "HTML/CSS/JavaScript project development",
    "Markdown documents with live rendering",
    "Structured data outputs (JSON, YAML)",
    "Web app access via claude.ai",
    "Claude iOS app integration",
    "Web search capability ($10 per 1,000 searches)",
    "Prompt caching (up to 90% cost savings)",
    "Batch processing (50% cost savings)"
  ],

  use_cases: [
    "Interactive web application prototyping",
    "Data visualization and chart creation",
    "React component development with live preview",
    "SVG graphics and diagram generation",
    "HTML/CSS/JavaScript project scaffolding",
    "Markdown documentation with live rendering",
    "Agentic coding for autonomous task completion",
    "Iterative refinement through conversational AI",
    "Structured data generation and validation",
    "Production-grade code generation at scale"
  ],

  integrations: [
    "Claude Pro subscription ($20/month)",
    "Claude Max subscription ($100-$200/month)",
    "Claude Code (web and iOS app)",
    "Claude API (Sonnet 4.5)",
    "React framework",
    "HTML/CSS/JavaScript",
    "Markdown rendering",
    "SVG graphics",
    "Web search ($10 per 1,000 searches)",
    "Prompt caching (90% savings)",
    "Batch processing API"
  ],

  pricing: {
    model: "Subscription with API pricing available",
    free_tier: false,
    tiers: [
      {
        name: "Pro",
        price: "$20/month",
        billing: "Monthly ($17/month annual)",
        target: "Individual developers and professionals",
        recommended: true,
        features: [
          "Claude Artifacts access",
          "Sonnet 4.5 model with 77.2% SWE-bench",
          "Interactive code generation workspace",
          "Live preview and iterative refinement",
          "Agentic coding capabilities",
          "Web and iOS app access",
          "Multi-step edits and planning",
          "React, HTML/CSS/JS, SVG support"
        ]
      },
      {
        name: "Max",
        price: "$100-$200/month",
        billing: "Monthly",
        target: "Power users and heavy development workflows",
        features: [
          "Everything in Pro",
          "5-10x higher usage limits",
          "Priority access during high demand",
          "Faster response times",
          "Extended context windows",
          "Advanced agentic capabilities"
        ]
      }
    ],
    api_pricing: {
      model: "Sonnet 4.5",
      input_tokens: "$3 per million tokens",
      output_tokens: "$15 per million tokens",
      prompt_caching: "Up to 90% cost savings",
      batch_processing: "50% cost savings",
      web_search: "$10 per 1,000 searches"
    }
  },

  differentiators: [
    "Sonnet 4.5: 77.2% on SWE-bench Verified (industry-leading)",
    "$500M+ annualized revenue from Claude Code",
    "Agentic coding: Autonomous agents working independently",
    "Persistent interactive workspace (not just chat)",
    "Live preview for instant visual feedback",
    "Multi-step edits, tool use, retries, planning",
    "React component creation with live rendering",
    "Prompt caching: Up to 90% cost savings",
    "Batch processing: 50% cost savings",
    "Web and iOS app access",
    "$3/$15 per million tokens API pricing",
    "Iterative refinement across conversational context",
    "Production-grade code generation at scale"
  ],

  target_audience: "Professional developers building with AI assistance; React developers prototyping components; data scientists creating visualizations; full-stack engineers scaffolding projects; organizations adopting agentic coding workflows; API developers integrating Claude capabilities; teams requiring high-performance code generation; and developers seeking live preview and iterative refinement",

  recent_updates_2025: [
    "Launched Claude Code web app (beyond CLI)",
    "Achieved 77.2% on SWE-bench Verified benchmark",
    "$500M+ annualized revenue from Claude Code",
    "Introduced agentic coding for autonomous agents",
    "Added Claude iOS app integration",
    "Launched prompt caching (90% cost savings)",
    "Introduced batch processing (50% cost savings)",
    "Added web search ($10 per 1,000 searches)",
    "Enhanced multi-step edits and planning",
    "Expanded to Max plans ($100-$200/month)"
  ],

  compliance: [
    "SOC 2 Type II certified",
    "Enterprise-grade security and privacy",
    "No customer data used for model training (opt-out)",
    "GDPR and CCPA compliant",
    "Data retention controls"
  ],

  parent_company: "Anthropic"
};

async function updateClaudeArtifacts() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Claude Artifacts with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: claudeArtifactsData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'claude-artifacts'));

    console.log('✅ Claude Artifacts updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Anthropic');
    console.log('   - Category: app-builder');
    console.log('   - Features: 17 comprehensive features');
    console.log('   - Pricing: 2 tiers + API (Pro $20, Max $100-200)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 11 platforms and frameworks');
    console.log('   - Metrics: $500M+ annualized revenue, 77.2% SWE-bench');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Claude Artifacts:', error);
    throw error;
  }
}

updateClaudeArtifacts();
