import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Lovable - AI-First App Builder (GPT Engineer Evolution)
 * Update comprehensive content for the $1.8B valuation AI app builder
 */

const lovableData = {
  id: "lovable",
  name: "Lovable",
  company: "Lovable (formerly GPT Engineer)",
  tagline: "AI co-engineer building full-stack apps with $120M ARR, $1.8B valuation, and 10K+ custom domains connected",
  description: "Lovable is an AI-powered full-stack app builder valued at $1.8 billion following its $200M Series A led by Accel with participation from Creandum and 20VC, achieving $120M in ARR just nine months after launching in November 2024. Evolved from the popular open-source gpt-engineer project, Lovable positions itself as an 'AI co-engineer' that constructs complete web applications based on user descriptions in plain English, with the AI engine generating underlying code, user interface, and foundational functionality within seconds or minutes. Building front-end using React, Tailwind, and Vite with Supabase integration for data persistence, Lovable provides full code ownership with automatic GitHub sync enabling users to edit in any code editor and hand off projects easily. The platform features security scanning that automatically detects issues like missing Row-Level Security (RLS) policies or exposed data, built-in custom domain buying and connecting with 10K+ domains connected to Lovable apps, and Dev Mode allowing direct code editing within Lovable. Pricing starts with Free plan (5 messages/day, 30 monthly max) with unlimited public projects, GitHub sync, and one-click deployment, while Starter ($20/month) provides 100 monthly messages plus unlimited private projects and custom domains, with Launch ($50/month) and Scale 1 ($100/month) growing message limits 2.5x and 5x respectively, plus usage-based AI generation fees ($1 for basic game, $50+ for complex applications) and promotional $25 Cloud and $1 AI credits monthly through end of 2025.",
  overview: "Lovable revolutionizes application development by providing an AI co-engineer that transforms natural language descriptions into complete, production-ready web applications with full code ownership, seamless GitHub integration, and managed deployment infrastructure. Unlike code generation tools that produce disconnected snippets, Lovable's platform includes user-friendly interface, managed Supabase backend integration for data persistence, built-in deployment and hosting, collaboration features, and dedicated support creating a comprehensive development environment where non-technical users can articulate ideas and watch applications materialize instantly. The platform's code ownership model sets it apart by giving users full ownership of everything Lovable builds, syncing codebases to GitHub automatically, enabling editing in any code editor, and facilitating easy project handoffs without vendor lock-in or proprietary dependencies. Lovable's security-first approach includes automatic security scanning detecting issues like missing RLS policies or unintentionally exposed data, ensuring applications meet basic security standards from day one rather than requiring manual audits after deployment. With 10K+ custom domains connected demonstrating real-world usage and production deployments, Lovable provides built-in domain buying and connection features eliminating external DNS configuration, while Dev Mode empowers advanced users to edit code directly within Lovable for fine-tuning AI-generated applications. The platform's explosive growth from November 2024 launch to $120M ARR in just nine months (August 2025) and $1.8B valuation with $200M Series A from premier investors (Accel, Creandum, 20VC) validates market demand for AI-first application development that democratizes software creation beyond traditional developer audiences. Lovable's pricing balances accessibility with sustainability: Free plan (5 messages/day, 30 monthly max) enables experimentation with unlimited public projects, GitHub sync, and one-click deployment, Starter ($20/month) adds 100 monthly messages, unlimited private projects, and custom domains, while Launch ($50/month) and Scale 1 ($100/month) provide 2.5x and 5x message capacity for heavy usage, complemented by usage-based AI generation fees ($1 for basic apps, $50+ for complex) and promotional $25 Cloud/$1 AI monthly credits through end of 2025 for all workspaces including Free tier. As an evolution of the open-source gpt-engineer with roots in community-driven development, Lovable combines open-source DNA with commercial SaaS features including managed integrations, deployment infrastructure, collaboration tools, and dedicated support creating a platform suitable for individuals prototyping ideas, founders validating MVPs, agencies delivering client projects, and teams rapidly deploying production applications.",
  website: "https://lovable.dev/",
  website_url: "https://lovable.dev/",
  launch_year: 2024,
  updated_2025: true,
  category: "app-builder",
  pricing_model: "freemium",

  features: [
    "AI co-engineer building apps from plain English descriptions",
    "Full-stack: React, Tailwind, Vite frontend with Supabase backend",
    "Complete code ownership with automatic GitHub sync",
    "Edit in any code editor after generation",
    "Security scan detecting missing RLS policies and exposed data",
    "Built-in custom domain buying and connecting (10K+ domains connected)",
    "Dev Mode for direct code editing within Lovable",
    "Managed Supabase integration for data persistence",
    "One-click deployment and built-in hosting",
    "Unlimited public projects (Free tier)",
    "Unlimited private projects (Starter+)",
    "Collaboration features for teams",
    "Real-time AI code generation (seconds to minutes)",
    "Usage-based AI generation fees ($1-$50+ per app)",
    "$25 Cloud and $1 AI monthly credits (through end 2025)"
  ],

  use_cases: [
    "Rapid MVP development for startup validation",
    "Full-stack web application prototyping",
    "Client project delivery for agencies",
    "Non-technical founder app creation",
    "Team collaboration on production apps",
    "Custom internal tool development",
    "SaaS product scaffolding",
    "E-commerce platform creation",
    "Dashboard and admin panel building",
    "Data-driven application development with Supabase"
  ],

  integrations: [
    "GitHub (automatic sync)",
    "Supabase (managed backend integration)",
    "React framework",
    "Tailwind CSS",
    "Vite build tool",
    "Custom domains (built-in DNS)",
    "One-click deployment hosting",
    "Any code editor (after export)"
  ],

  pricing: {
    model: "Freemium with message-based tiers plus usage fees",
    free_tier: true,
    promotional_credits: "$25 Cloud + $1 AI monthly through end 2025",
    tiers: [
      {
        name: "Free",
        price: "$0",
        billing: "Forever",
        target: "Experimentation and public projects",
        features: [
          "5 messages per day (30 monthly max)",
          "Unlimited public projects",
          "GitHub sync",
          "One-click deployment",
          "$25 Cloud + $1 AI credits/month (2025)",
          "Community support"
        ]
      },
      {
        name: "Starter",
        price: "$20/month",
        billing: "Monthly",
        target: "Individual developers and founders",
        recommended: true,
        features: [
          "100 messages per month",
          "Unlimited private projects",
          "Custom domains",
          "Everything in Free",
          "$25 Cloud + $1 AI credits/month (2025)",
          "Email support"
        ]
      },
      {
        name: "Launch",
        price: "$50/month",
        billing: "Monthly",
        target: "Active development and agencies",
        features: [
          "250 messages per month (2.5x Starter)",
          "Everything in Starter",
          "$25 Cloud + $1 AI credits/month (2025)",
          "Priority support"
        ]
      },
      {
        name: "Scale 1",
        price: "$100/month",
        billing: "Monthly",
        target: "Heavy usage and production deployments",
        features: [
          "500 messages per month (5x Starter)",
          "Everything in Launch",
          "$25 Cloud + $1 AI credits/month (2025)",
          "Dedicated support"
        ]
      }
    ],
    usage_fees: {
      basic_app: "~$1 in AI credits",
      complex_app: "$50+ in AI credits",
      note: "Usage-based fees for AI code generation tasks"
    }
  },

  differentiators: [
    "$1.8B valuation with $200M Series A (Accel, Creandum, 20VC)",
    "$120M ARR achieved in 9 months (Nov 2024 to Aug 2025)",
    "Full code ownership with automatic GitHub sync",
    "10K+ custom domains connected (production usage)",
    "Evolved from popular open-source gpt-engineer",
    "Security scanning for RLS and data exposure",
    "Managed Supabase integration",
    "Dev Mode for direct code editing",
    "$25 Cloud + $1 AI monthly credits through 2025",
    "Edit in any code editor after generation",
    "Built-in custom domain management",
    "One-click deployment and hosting",
    "React, Tailwind, Vite, Supabase stack"
  ],

  target_audience: "Startup founders validating MVPs; non-technical entrepreneurs building apps; web development agencies delivering client projects; indie developers prototyping ideas; teams rapidly deploying production apps; SaaS founders creating platforms; designers converting mockups to functional apps; and product managers building internal tools",

  recent_updates_2025: [
    "Raised $200M Series A at $1.8B valuation (July 2025)",
    "Achieved $120M ARR in 9 months (August 2025)",
    "10K+ custom domains connected milestone",
    "Added Dev Mode for direct code editing",
    "Launched security scanning for RLS and data exposure",
    "Introduced promotional $25 Cloud + $1 AI credits",
    "Expanded from Free to Scale 1 pricing tiers",
    "Enhanced Supabase integration capabilities",
    "Improved GitHub sync automation",
    "Strengthened collaboration features"
  ],

  compliance: [
    "Full code ownership (no vendor lock-in)",
    "GitHub sync for code backup and version control",
    "Security scanning for common vulnerabilities",
    "Data privacy with Supabase controls",
    "SOC 2 compliance (Enterprise tier)"
  ],

  parent_company: "Lovable (formerly GPT Engineer)"
};

async function updateLovable() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Lovable with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: lovableData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'lovable'));

    console.log('✅ Lovable updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Lovable (formerly GPT Engineer)');
    console.log('   - Category: app-builder');
    console.log('   - Features: 15 comprehensive features');
    console.log('   - Pricing: 4 tiers (Free, Starter $20, Launch $50, Scale $100)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 8 platforms and frameworks');
    console.log('   - Metrics: $120M ARR, $1.8B valuation, 10K+ domains');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Lovable:', error);
    throw error;
  }
}

updateLovable();
