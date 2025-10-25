import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Augment Code - AI Pair Programmer
 * Update comprehensive content for $227M funded enterprise coding assistant
 */

const augmentCodeData = {
  id: "augment-code",
  name: "Augment Code",
  company: "Augment",
  tagline: "AI pair programmer with $227M funding, 200K-token context, and ISO 42001/SOC 2 Type II certifications",
  description: "Augment Code is an AI-powered coding assistant startup that raised $227 million in funding at a $977 million valuation (just shy of unicorn status), positioning itself as a GitHub Copilot rival with enterprise-grade capabilities including 200,000-token context engine, automatic memory updates that persist across conversations, and ISO 42001 and SOC 2 Type II certifications. Founded in 2022 and launching out of stealth in April 2024, Augment Agent delivers high-quality code from brand new apps to monorepos with over 100K files, with integration for VS Code, JetBrains, and Vim/Neovim allowing the AI to run terminal commands and apply multi-file edits. The platform switched from per-message to credit-based pricing in October 2025 with plans including Trial (free with 30,000 credits), Indie ($20/month with 40,000 credits), Standard ($60/month with 130,000 credits), Max ($200/month with 450,000 credits), and Enterprise (custom pricing), where small tasks use approximately 293 credits, medium tasks 860 credits, and complex tasks 4,261 credits with credits resetting each billing cycle without rollover. Augment Code's Memories feature automatically updates as you work and persists across conversations to constantly improve generated code, while Code Checkpoints provide peace of mind as the agent tackles tasks, making it suitable for enterprises and regulated industries requiring the best AI platform for large, complex codebases.",
  overview: "Augment Code revolutionizes AI-assisted development for enterprise teams by providing a context-aware pair programmer that deeply understands massive codebases with its industry-leading 200,000-token context engine - over 3x larger than GitHub Copilot's 64,000 tokens - enabling the AI to comprehend entire application architectures, dependencies, and patterns across repositories with 100K+ files. Unlike tools that forget context between sessions, Augment's Memories feature automatically updates as developers work, persisting knowledge across conversations to continuously improve code generation quality by learning project-specific patterns, coding standards, team preferences, and architectural decisions without requiring manual configuration. The platform's autonomous Augment Agent can deliver production-ready code from greenfield applications to sprawling monorepos, with VS Code, JetBrains, and Vim/Neovim integration enabling the AI to run terminal commands, apply multi-file edits, and execute complex refactoring operations that span entire codebases while developers maintain oversight through Code Checkpoints providing rollback capabilities and peace of mind. Augment's enterprise-ready security and compliance infrastructure includes ISO 42001 certification (AI management systems standard) and SOC 2 Type II compliance, making it suitable for regulated industries like finance and healthcare where code security and data governance are critical requirements that disqualify many consumer-focused AI coding tools. The platform's credit-based pricing model introduced in October 2025 replaces per-message limits with transparent usage tracking where small tasks (~293 credits), medium tasks (~860 credits), and complex tasks (~4,261 credits) provide predictable costs that scale with actual AI usage rather than arbitrary message counts. Available with Trial (free 30,000 credits for evaluation), Indie ($20/month with 40,000 credits for individual developers), Standard ($60/month with 130,000 credits for professional use), Max ($200/month with 450,000 credits for power users), and Enterprise (custom pricing with advanced features), Augment Code delivers the definitive AI pair programmer for organizations working with large, complex codebases requiring enterprise security, compliance, and performance. Backed by $227M funding at $977M valuation and emerging from stealth in April 2024, Augment Code has quickly established itself as the best AI coding platform for developers working in large, complex enterprise environments where context depth, security certifications, and continuous learning from codebase-specific patterns are non-negotiable requirements.",
  website: "https://www.augmentcode.com/",
  website_url: "https://www.augmentcode.com/",
  launch_year: 2022,
  updated_2025: true,
  category: "ide-assistant",
  pricing_model: "freemium",

  features: [
    "200,000-token context engine (3x GitHub Copilot's 64K)",
    "Memories: Automatic updates persisting across conversations",
    "Code Checkpoints for rollback and peace of mind",
    "Augment Agent: High-quality code from new apps to 100K+ file monorepos",
    "Multi-file edits and complex refactoring operations",
    "Terminal command execution within IDE",
    "VS Code, JetBrains, Vim/Neovim integration",
    "ISO 42001 certification (AI management systems)",
    "SOC 2 Type II compliance",
    "Credit-based pricing with transparent usage tracking",
    "Continuous learning from codebase-specific patterns",
    "Enterprise-grade security and data governance",
    "Support for massive codebases (100K+ files)",
    "Autonomous agent capabilities",
    "7-day free trial available"
  ],

  use_cases: [
    "Enterprise codebase development (100K+ files)",
    "Large monorepo management and refactoring",
    "Regulated industry development (finance, healthcare)",
    "Multi-file editing and complex refactoring",
    "Team collaboration with shared AI knowledge",
    "Continuous learning from project-specific patterns",
    "Production-ready code generation at scale",
    "Terminal automation within IDE",
    "Code checkpoint rollback for safety",
    "SOC 2 and ISO 42001 compliant development"
  ],

  integrations: [
    "VS Code (native integration)",
    "JetBrains IDEs (IntelliJ, PyCharm, WebStorm, etc.)",
    "Vim/Neovim (terminal editors)",
    "Git and version control systems",
    "Terminal commands (within IDE)",
    "Enterprise SSO (Enterprise tier)",
    "Custom integrations (Enterprise tier)"
  ],

  pricing: {
    model: "Credit-based with tiered plans",
    free_trial: true,
    trial_duration: "7 days",
    credit_usage: {
      small_task: "~293 credits",
      medium_task: "~860 credits",
      complex_task: "~4,261 credits"
    },
    tiers: [
      {
        name: "Trial",
        price: "$0",
        billing: "7-day free trial",
        target: "Evaluation and testing",
        features: [
          "30,000 credits",
          "Full Augment Agent access",
          "VS Code, JetBrains, Vim/Neovim",
          "200K-token context",
          "Memories and Code Checkpoints",
          "7-day trial period"
        ]
      },
      {
        name: "Indie",
        price: "$20/month",
        billing: "Monthly (credits reset each cycle)",
        target: "Individual developers",
        recommended: true,
        features: [
          "40,000 credits per month",
          "~136 small tasks or ~10 complex tasks",
          "Everything in Trial",
          "No credit rollover"
        ]
      },
      {
        name: "Standard",
        price: "$60/month",
        billing: "Monthly (credits reset each cycle)",
        target: "Professional developers",
        features: [
          "130,000 credits per month",
          "~443 small tasks or ~30 complex tasks",
          "Everything in Indie",
          "Enhanced support"
        ]
      },
      {
        name: "Max",
        price: "$200/month",
        billing: "Monthly (credits reset each cycle)",
        target: "Power users and heavy development",
        features: [
          "450,000 credits per month",
          "~1,536 small tasks or ~105 complex tasks",
          "Everything in Standard",
          "Priority support"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations",
        features: [
          "Custom credit allocations",
          "ISO 42001 and SOC 2 Type II compliance",
          "Enterprise SSO integration",
          "Dedicated account management",
          "Custom integrations",
          "SLA guarantees",
          "Advanced security controls",
          "Priority enterprise support"
        ]
      }
    ]
  },

  differentiators: [
    "$227M funding at $977M valuation (near-unicorn status)",
    "200,000-token context (3x GitHub Copilot's 64K)",
    "ISO 42001 and SOC 2 Type II certified",
    "Memories: Automatic codebase learning across conversations",
    "Code Checkpoints for rollback safety",
    "Handles monorepos with 100K+ files",
    "Multi-file edits and complex refactoring",
    "Terminal command execution within IDE",
    "VS Code, JetBrains, Vim/Neovim support",
    "Credit-based transparent pricing",
    "Enterprise-ready security and compliance",
    "Launched from stealth in April 2024",
    "Best for large, complex codebases"
  ],

  target_audience: "Enterprise development teams with large codebases; organizations in regulated industries (finance, healthcare); developers working with 100K+ file monorepos; teams requiring SOC 2 and ISO 42001 compliance; professional developers needing deep context understanding; power users requiring multi-file refactoring; and organizations seeking Eric Schmidt-backed AI coding solutions",

  recent_updates_2025: [
    "Switched to credit-based pricing (October 2025)",
    "Introduced transparent task-based credit usage",
    "Added Code Checkpoints for rollback safety",
    "Achieved ISO 42001 certification",
    "Maintained SOC 2 Type II compliance",
    "Enhanced Memories for continuous learning",
    "Expanded IDE support (Vim/Neovim)",
    "Improved multi-file editing capabilities",
    "Added 7-day free trial",
    "Launched Enterprise tier with custom pricing"
  ],

  compliance: [
    "ISO 42001 certified (AI management systems)",
    "SOC 2 Type II compliant",
    "Enterprise SSO integration",
    "Data governance controls",
    "Suitable for regulated industries (finance, healthcare)",
    "SLA guarantees (Enterprise)",
    "Advanced security controls (Enterprise)"
  ],

  parent_company: "Augment"
};

async function updateAugmentCode() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Augment Code with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: augmentCodeData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'augment-code'));

    console.log('✅ Augment Code updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Augment');
    console.log('   - Category: ide-assistant');
    console.log('   - Features: 15 comprehensive features');
    console.log('   - Pricing: 5 tiers (Trial free, Indie $20, Standard $60, Max $200, Enterprise)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 7 platforms and tools');
    console.log('   - Metrics: $227M funding, $977M valuation, 200K-token context');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Augment Code:', error);
    throw error;
  }
}

updateAugmentCode();
