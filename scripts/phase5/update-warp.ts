import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Warp - AI-Native Terminal
 * Update comprehensive content for the agentic development environment
 */

const warpData = {
  id: "warp",
  name: "Warp",
  company: "Warp",
  tagline: "AI-native terminal with 500K+ users, agentic development environment, and 5-15% weekly revenue growth",
  description: "Warp is the world's first AI-native terminal reimagined with a code-editing experience for commands, endless customization, and comprehensive AI assistance across macOS, Linux, and Windows with 500K+ users and revenue growing 5-15% per week during 2025. The platform launched an agentic development environment emphasizing terminal-style panes for typing prompts to AI agents with human-in-the-loop controls regulating when agents need approval to make code changes and restricting certain commands without explicit permission. Warp AI provides AI-generated command suggestions tailored to your terminal session and history, automatic error detection with suggested fixes, script writing for automating tasks like connecting to cloud instances or installing software, shared Warp Drive for collaborating on workflows and notebooks, and reusable global or project-based guidelines ensuring agents follow your coding standards. Available with Free plan (Warp AI with up to 20 requests per user per day), Pro plan ($15/month with 1,000 AI requests), Team plan ($12/member/month with up to 100 requests per user per day), and Enterprise plan with custom pricing including Zero Data Retention, SAML-based SSO, and support for teams up to 50 seats, Warp delivers the definitive AI-powered terminal experience combining traditional command-line power with modern AI assistance and collaboration features.",
  overview: "Warp revolutionizes terminal usage by reimagining the command-line interface as an AI-native development environment where developers interact with intelligent agents through natural language while maintaining full control over executed commands and code changes. Unlike traditional terminals that require memorizing complex command syntax, Warp AI generates command suggestions tailored to your specific terminal session and history, automatically detects errors and suggests fixes, and writes scripts for automating repetitive tasks like connecting to cloud instances or installing software packages. The platform's agentic development environment introduces terminal-style panes where developers type prompts to AI agents that can autonomously perform tasks while human-in-the-loop controls ensure developers approve code changes and explicitly permit potentially destructive commands before execution. Warp's collaboration features include shared Warp Drive for teams to collaborate on workflows, notebooks, and parameterized Agent Mode prompts, plus reusable global or project-based guidelines ensuring Warp's agents consistently follow your team's coding standards and best practices across all projects. The platform delivers a world-class terminal experience with code-editing capabilities for commands including syntax highlighting, inline autocomplete, and block-based command editing rather than line-by-line, while endless customization options allow developers to tailor appearance, keybindings, workflows, and AI behavior to their exact preferences. With 500K+ active users and revenue growing 5-15% per week during 2025 demonstrating strong market traction, Warp provides flexible pricing from Free (20 AI requests/day) to Pro ($15/month with 1,000 monthly AI requests) to Team ($12/member/month with 100 daily requests) to Enterprise (custom pricing with Zero Data Retention, SAML SSO, and dedicated support). Available on macOS, Linux, and Windows for comprehensive platform coverage, Warp represents the definitive evolution of the terminal from static command-line interface to intelligent, collaborative development environment where AI agents assist with complex tasks while developers maintain control and oversight through intuitive human-in-the-loop approval mechanisms.",
  website: "https://www.warp.dev/",
  website_url: "https://www.warp.dev/",
  launch_year: 2022,
  updated_2025: true,
  category: "autonomous-agent",
  pricing_model: "freemium",

  features: [
    "AI-native terminal with code-editing experience for commands",
    "Agentic development environment with terminal-style panes",
    "Human-in-the-loop controls for AI agent approvals",
    "AI-generated command suggestions tailored to session history",
    "Automatic error detection with suggested fixes",
    "Script writing for task automation (cloud, installations, etc.)",
    "Shared Warp Drive for team collaboration on workflows",
    "Reusable global or project-based coding guidelines",
    "Agents follow your coding standards automatically",
    "Syntax highlighting and inline autocomplete",
    "Block-based command editing (not line-by-line)",
    "Endless customization (appearance, keybindings, workflows)",
    "macOS, Linux, and Windows support",
    "Zero Data Retention option (Enterprise)",
    "SAML-based SSO (Enterprise)",
    "Team collaboration up to 50 seats"
  ],

  use_cases: [
    "AI-assisted command-line development",
    "Terminal command generation from natural language",
    "Automated script writing for cloud and DevOps tasks",
    "Error debugging with AI-suggested fixes",
    "Team collaboration on terminal workflows",
    "Reusable coding guidelines enforcement",
    "DevOps automation with AI assistance",
    "Cloud infrastructure management",
    "Custom workflow creation and sharing",
    "Terminal productivity with code-editing experience"
  ],

  integrations: [
    "macOS (native support)",
    "Linux (native support)",
    "Windows (native support)",
    "Warp Drive (cloud collaboration)",
    "SAML SSO (Enterprise)",
    "Git and version control systems",
    "Cloud platforms (AWS, GCP, Azure)",
    "Docker and container tools",
    "Package managers (npm, pip, brew, etc.)",
    "SSH and remote servers"
  ],

  pricing: {
    model: "Freemium with Pro, Team, and Enterprise tiers",
    free_tier: true,
    tiers: [
      {
        name: "Free",
        price: "$0",
        billing: "Forever",
        target: "Individual developers",
        features: [
          "Warp AI with 20 requests/user/day",
          "Code-editing terminal experience",
          "Syntax highlighting and autocomplete",
          "Basic customization",
          "macOS, Linux, Windows support",
          "Community support"
        ]
      },
      {
        name: "Pro",
        price: "$15/month",
        billing: "Monthly",
        target: "Power users and professionals",
        recommended: true,
        features: [
          "1,000 AI requests per month",
          "Everything in Free",
          "Advanced customization",
          "Priority support",
          "Enhanced AI capabilities"
        ]
      },
      {
        name: "Team",
        price: "$12/member/month",
        billing: "Monthly or Annual",
        target: "Development teams",
        features: [
          "100 AI requests/user/day",
          "Shared Warp Drive collaboration",
          "Reusable team guidelines",
          "Centralized billing",
          "Team analytics",
          "Priority support"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations",
        features: [
          "Zero Data Retention",
          "SAML-based SSO",
          "Up to 50 seats support",
          "Dedicated account management",
          "Custom AI request limits",
          "SLA guarantees",
          "Advanced security controls",
          "Priority enterprise support"
        ]
      }
    ]
  },

  differentiators: [
    "500K+ active users with 5-15% weekly revenue growth",
    "World's first AI-native terminal",
    "Agentic development environment with human-in-the-loop",
    "Code-editing experience (not traditional line-by-line)",
    "Block-based command editing",
    "AI command suggestions from session history",
    "Automatic error detection and fixes",
    "Shared Warp Drive for team collaboration",
    "Reusable coding guidelines for agents",
    "macOS, Linux, Windows support",
    "Zero Data Retention option (Enterprise)",
    "SAML SSO authentication (Enterprise)",
    "Endless customization options"
  ],

  target_audience: "Terminal power users and developers; DevOps engineers automating infrastructure; cloud platform users (AWS, GCP, Azure); development teams collaborating on workflows; system administrators managing servers; data engineers working with command-line tools; and organizations requiring secure, AI-assisted terminal environments",

  recent_updates_2025: [
    "Achieved 500K+ active users",
    "Growing revenue 5-15% per week",
    "Launched agentic development environment",
    "Added human-in-the-loop AI controls",
    "Introduced shared Warp Drive collaboration",
    "Added reusable coding guidelines for agents",
    "Enhanced Windows support",
    "Improved AI command suggestion accuracy",
    "Added Zero Data Retention (Enterprise)",
    "Expanded team collaboration features"
  ],

  compliance: [
    "Zero Data Retention option (Enterprise)",
    "SAML-based SSO authentication",
    "SOC 2 compliance ready",
    "Data privacy controls",
    "Enterprise-grade security"
  ],

  parent_company: "Warp"
};

async function updateWarp() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Warp with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: warpData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'warp'));

    console.log('✅ Warp updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Warp');
    console.log('   - Category: autonomous-agent');
    console.log('   - Features: 16 comprehensive features');
    console.log('   - Pricing: 4 tiers (Free, Pro $15, Team $12, Enterprise)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 10 platforms and tools');
    console.log('   - Metrics: 500K+ users, 5-15% weekly revenue growth');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Warp:', error);
    throw error;
  }
}

updateWarp();
