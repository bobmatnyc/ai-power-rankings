import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 6: Devin - Revolutionary AI Software Engineer
 * Enhanced comprehensive content with 2025 updates
 */

const devinData = {
  id: "devin",
  name: "Devin",
  company: "Cognition AI (Cognition Labs)",
  tagline: "Revolutionary AI software engineer with 96% price reduction to $20/month, parallel workspaces, and $10.2B valuation from Founders Fund and Peter Thiel",
  description: "Devin is the world's first autonomous AI software engineer from Cognition AI (Cognition Labs), capable of planning, coding, debugging, and deploying complete software projects with minimal human oversight, now democratized with revolutionary 96% price reduction from $500 to $20 per month through Devin 2.0's flexible pay-as-you-go model powered by Agent Compute Units (ACUs). The platform delivers parallel workspace capabilities allowing developers to spin up multiple Devins simultaneously in cloud-based IDEs, each working autonomously on different tasks while human-in-the-loop controls ensure developers approve code changes and explicitly permit destructive commands before execution. Devin 2.0 introduces Interactive Planning for collaborating with broad ideas to create detailed task plans within seconds, Devin Search for agentic codebase exploration with cited answers, automatic repository indexing creating comprehensive architecture diagrams and wikis, MultiDevin manager coordinating teams of up to 10 worker Devins for large backlogs and migrations, Custom Devins fine-tuned for proprietary datasets, and VPC deployment ensuring all data remains within organizational infrastructure for security and compliance. Available with Entry tier ($20 minimum for ~9 ACUs then pay-as-you-go at $2.25/ACU), Team tier (custom pricing with centralized admin controls), and Enterprise tier (VPC deployment, Custom Devins, MultiDevin, machine snapshots, dedicated support), backed by $575M+ total funding reaching $10.2B valuation led by Founders Fund and Peter Thiel with participation from Lux Capital, 8VC, and Bain Capital Ventures, Devin delivers the definitive autonomous coding experience combining revolutionary accessibility through democratized pricing with enterprise-grade capabilities including parallel workspaces, agentic codebase analysis, and team management orchestration.",
  overview: "Devin revolutionizes software development as the world's first autonomous AI software engineer capable of independently planning, coding, debugging, and deploying complete projects while maintaining human oversight through intelligent approval mechanisms. Unlike traditional AI coding assistants that merely suggest code snippets, Devin operates as a fully autonomous agent that can tackle multi-step engineering tasks end-to-end, from analyzing requirements and planning architecture to writing comprehensive test suites and deploying production-ready applications. Cognition AI achieved a revolutionary 96% price reduction with Devin 2.0's launch in April 2025, dropping from $500 to $20 per month minimum entry point with flexible pay-as-you-go billing based on Agent Compute Units (ACUs) priced at $2.25 each, democratizing access to autonomous AI software engineering for individual developers and small teams previously priced out of the market. The platform's parallel workspace capabilities enable developers to spin up multiple Devins simultaneously in cloud-based interactive IDEs, each working autonomously on different tasks while developers maintain control through human-in-the-loop approval mechanisms that require explicit permission for code changes and potentially destructive commands. Devin 2.0's Interactive Planning transforms broad or incomplete ideas into detailed task plans within seconds by automatically analyzing codebases, identifying relevant files, and proposing comprehensive implementation strategies developers can refine collaboratively. Devin Search delivers agentic codebase exploration enabling developers to ask natural language questions and receive detailed answers with cited code references, while automatic repository indexing every couple hours creates comprehensive wikis with architecture diagrams, direct source links, and comprehensive documentation. Enterprise capabilities include MultiDevin manager orchestrating teams of up to 10 worker Devins distributing tasks and merging changes for large-scale migrations and refactors, Custom Devins fine-tuned on proprietary datasets for specialized domains, VPC deployment keeping all organizational data within controlled infrastructure, and machine snapshots simplifying login workflows with centralized admin controls for managing multiple Devin workspaces. Backed by extraordinary $575M+ funding reaching $10.2B valuation (from $2B in 2024 to $10.2B by September 2025) led by Founders Fund and Peter Thiel with participation from Lux Capital, 8VC, and Bain Capital Ventures, Cognition AI demonstrates unprecedented investor confidence in autonomous AI software engineering despite competitive pressures. Available on Entry tier ($20 minimum for approximately 9 ACUs with pay-as-you-go scaling), Team tier (custom pricing with centralized billing and admin), and Enterprise tier (VPC, Custom Devins, MultiDevin, dedicated support), Devin represents the definitive autonomous coding platform combining revolutionary democratized pricing with enterprise-grade team orchestration, specialized fine-tuning, and comprehensive security controls for organizations requiring complete data sovereignty.",
  website: "https://cognition.ai/",
  website_url: "https://cognition.ai/",
  launch_year: 2024,
  updated_2025: true,
  category: "autonomous-agent",
  pricing_model: "paid",

  features: [
    "Autonomous AI software engineer for complete projects",
    "96% price reduction: $500 → $20/month (Devin 2.0)",
    "Parallel workspace capabilities (multiple Devins simultaneously)",
    "Cloud-based interactive IDEs per Devin instance",
    "Human-in-the-loop approval mechanisms for code changes",
    "Interactive Planning: Broad ideas to detailed task plans in seconds",
    "Devin Search: Agentic codebase exploration with cited answers",
    "Automatic repository indexing with architecture diagrams",
    "Comprehensive wiki generation with source links",
    "MultiDevin: Manager coordinating up to 10 worker Devins",
    "Custom Devins: Fine-tuned for proprietary datasets",
    "VPC deployment for complete data sovereignty",
    "Machine snapshots for simplified login workflows",
    "Centralized admin controls for workspace management",
    "Pay-as-you-go ACU-based billing flexibility",
    "Planning, coding, debugging, and deployment automation",
    "End-to-end multi-step engineering task completion",
    "Enterprise-grade security and compliance controls"
  ],

  use_cases: [
    "Autonomous complete project development from requirements to deployment",
    "Parallel development with multiple Devins on different features",
    "Large-scale codebase migrations and refactoring (MultiDevin)",
    "Rapid prototyping from broad ideas to detailed implementations",
    "Agentic codebase exploration and documentation generation",
    "Enterprise development with proprietary dataset fine-tuning",
    "Secure VPC-deployed autonomous coding for regulated industries",
    "Team coordination with centralized admin workspace management",
    "Automated architecture diagram and wiki creation",
    "Complex debugging and production deployment automation",
    "Custom domain-specific AI engineering with specialized training",
    "Individual developer projects now affordable at $20 entry point",
    "Startup rapid development with flexible pay-as-you-go scaling",
    "Enterprise-scale concurrent task execution across worker Devins"
  ],

  integrations: [
    "Cloud-based interactive IDE environments",
    "GitHub and version control systems",
    "Multiple cloud platforms (VPC deployment support)",
    "CI/CD pipeline integration",
    "Proprietary dataset fine-tuning (Custom Devins)",
    "Enterprise SSO and authentication systems",
    "Centralized admin dashboards",
    "Machine snapshot systems",
    "Architecture documentation tools",
    "Repository indexing systems"
  ],

  pricing: {
    model: "Pay-as-you-go with Entry, Team, and Enterprise tiers",
    free_tier: false,
    tiers: [
      {
        name: "Entry",
        price: "$20 minimum",
        billing: "Pay-as-you-go",
        target: "Individual developers and small teams",
        recommended: true,
        features: [
          "$20 minimum gets ~9 Agent Compute Units (ACUs)",
          "Pay-as-you-go: $2.25 per ACU beyond included",
          "Single Devin workspace",
          "Interactive Planning capabilities",
          "Devin Search codebase exploration",
          "Automatic repository indexing",
          "Architecture diagrams and wiki generation",
          "Human-in-the-loop approval controls",
          "Cloud-based interactive IDE",
          "Email support"
        ]
      },
      {
        name: "Team",
        price: "Custom",
        billing: "Monthly subscription",
        target: "Development teams and growing organizations",
        features: [
          "Everything in Entry",
          "Multiple team member seats",
          "Centralized billing",
          "Admin controls for workspace management",
          "Machine snapshots for simplified logins",
          "Team collaboration features",
          "Priority support",
          "Custom ACU allocations"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations and regulated industries",
        features: [
          "Everything in Team",
          "MultiDevin: Manager + up to 10 worker Devins",
          "Custom Devins: Fine-tuned on proprietary datasets",
          "VPC deployment for complete data sovereignty",
          "Dedicated account management",
          "SLA guarantees",
          "Advanced security and compliance controls",
          "Custom integration support",
          "White-glove onboarding",
          "24/7 priority enterprise support"
        ]
      }
    ]
  },

  differentiators: [
    "World's first autonomous AI software engineer",
    "Revolutionary 96% price reduction: $500 → $20/month",
    "$10.2B valuation (up from $2B in 2024)",
    "$575M+ total funding from Founders Fund, Peter Thiel, Lux, 8VC",
    "Parallel workspace capabilities (multiple simultaneous Devins)",
    "Interactive Planning: Ideas to plans in seconds",
    "Devin Search: Agentic codebase exploration",
    "Automatic architecture diagrams and comprehensive wikis",
    "MultiDevin: Team of up to 10 coordinated worker Devins",
    "Custom Devins: Fine-tuned for proprietary datasets",
    "VPC deployment for complete data sovereignty",
    "Pay-as-you-go ACU flexibility",
    "End-to-end autonomous project completion"
  ],

  target_audience: "Software development teams requiring autonomous coding capabilities; individual developers now affordable at $20 entry point; enterprises needing VPC deployment and data sovereignty; organizations with large-scale migration and refactoring projects (MultiDevin); companies requiring domain-specific fine-tuning (Custom Devins); startups needing rapid prototyping with flexible pay-as-you-go scaling; and regulated industries requiring comprehensive security and compliance controls with human-in-the-loop oversight",

  recent_updates_2025: [
    "Devin 2.0 launched April 2025 with revolutionary pricing",
    "96% price reduction: $500/month → $20/month entry",
    "Reached $10.2B valuation (September 2025)",
    "Raised $400M Series B led by Founders Fund (September 2025)",
    "Introduced pay-as-you-go ACU-based billing",
    "Launched parallel workspace capabilities",
    "Released Interactive Planning feature",
    "Introduced Devin Search for agentic exploration",
    "Automatic repository indexing with architecture diagrams",
    "MultiDevin team orchestration (up to 10 workers)",
    "Custom Devins for proprietary dataset fine-tuning",
    "VPC deployment for enterprise data sovereignty",
    "Machine snapshots for simplified workflows",
    "Centralized admin controls"
  ],

  compliance: [
    "VPC deployment option for data sovereignty",
    "Enterprise-grade security controls",
    "Human-in-the-loop approval mechanisms",
    "Machine snapshot security",
    "Centralized admin management",
    "SOC 2 compliance ready (Enterprise)",
    "Custom integration security protocols"
  ],

  parent_company: "Cognition AI (also known as Cognition Labs)",
  headquarters: "San Francisco, California, USA",

  metrics: {
    valuation: "$10.2B (September 2025)",
    funding: "$575M+ total raised",
    growth: "5x valuation increase in 18 months (2024-2025)",
    pricing_democratization: "96% price reduction with Devin 2.0"
  }
};

async function updateDevin() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Devin with Phase 6 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: devinData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'devin'));

    console.log('✅ Devin updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Cognition AI (Cognition Labs)');
    console.log('   - Category: autonomous-agent');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: 3 tiers (Entry $20, Team, Enterprise)');
    console.log('   - Use Cases: 14 specialized scenarios');
    console.log('   - Integrations: 10 platforms and tools');
    console.log('   - Valuation: $10.2B (September 2025)');
    console.log('   - Funding: $575M+ total raised');
    console.log('   - Key Update: 96% price reduction ($500 → $20)');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 14 major enhancements');

  } catch (error) {
    console.error('❌ Error updating Devin:', error);
    throw error;
  }
}

updateDevin();
