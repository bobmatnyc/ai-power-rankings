import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Bolt.new - Full-Stack App Builder
 * Update comprehensive content for StackBlitz's AI-powered app builder
 */

const boltNewData = {
  id: "bolt-new",
  name: "Bolt.new",
  company: "StackBlitz",
  tagline: "AI-powered full-stack app builder with 1M+ projects created and instant deployment",
  description: "Bolt.new is StackBlitz's revolutionary AI-powered full-stack development platform that integrates cutting-edge AI models with in-browser WebContainers technology, allowing developers to prompt, run, edit, and deploy complete web applications instantly. Valued at $700M following its $105.5M Series B funding round in January 2025 and backed by Emergence Capital and GV, Bolt.new has generated over 1 million websites in just five months since launch. The platform provides AI models with complete control over the entire development environment including filesystem, Node server, package manager, terminal, and browser console, enabling creation of both frontend and backend components with database integration, API endpoints, and server-side logic. Supporting React, Vue, Next.js, Astro, Svelte, Remix, Angular, and emerging frameworks with full npm ecosystem access and automatic dependency resolution, Bolt.new delivers seamless deployment to Netlify, Vercel, and Cloudflare while offering both public and private projects, built-in hosting, and generous token allocations starting at 10M tokens for $20/month on Pro tier with custom domains, SEO optimization, and admin controls for Teams and Enterprise.",
  overview: "Bolt.new revolutionizes web development by combining state-of-the-art AI language models with StackBlitz's WebContainers technology to deliver a complete in-browser IDE where developers can build, run, debug, and deploy full-stack applications without leaving their browser. Unlike traditional AI coding assistants that only generate code snippets, Bolt.new's AI has complete environmental control with access to filesystem, Node server, package manager, terminal, and browser console, enabling autonomous creation of complex applications with both frontend UI components and backend server logic, database integrations, and API endpoints. The platform's breakthrough comes from WebContainers running entire Node.js environments directly in the browser at near-native speed, eliminating the need for remote servers or containers while providing full npm package ecosystem access with automatic dependency installation and resolution. With support for React, Vue, Next.js, Astro, Svelte, Remix, Angular, and emerging frameworks, Bolt.new enables developers to start from natural language prompts and iterate through conversational AI interactions, with complete IDE features including syntax highlighting, error detection, debugging tools, and integrated terminal access for comprehensive development workflows. Bolt.new's token-based pricing model at 10M tokens for $20/month on Pro tier (versus fixed message limits) provides predictable costs while enabling both public and private projects with built-in hosting, and Pro/Teams/Enterprise tiers remove branding, lift daily limits, add custom domains and SEO optimization, plus layer admin controls, compliance features, and dedicated support for organizations. Backed by $105.5M Series B at $700M valuation from Emergence Capital and GV with over 1 million websites deployed in five months, Bolt.new represents the definitive platform for AI-powered rapid prototyping and full-stack development that keeps developers in flow.",
  website: "https://bolt.new/",
  website_url: "https://bolt.new/",
  launch_year: 2024,
  updated_2025: true,
  category: "app-builder",
  pricing_model: "subscription",

  features: [
    "AI models with complete environment control (filesystem, Node server, terminal)",
    "WebContainers technology: Full Node.js in browser at near-native speed",
    "Full-stack development: Frontend, backend, database, API endpoints",
    "Framework support: React, Vue, Next.js, Astro, Svelte, Remix, Angular",
    "Complete IDE with syntax highlighting, error detection, debugging",
    "Integrated terminal access with npm ecosystem",
    "Automatic dependency resolution and package installation",
    "Natural language prompts to working applications",
    "Conversational AI iterations and refinements",
    "Seamless deployment to Netlify, Vercel, Cloudflare",
    "Public and private projects on all tiers",
    "Built-in hosting with custom domains (Pro+)",
    "Token-based pricing (10M tokens = $20/month Pro)",
    "Token rollover between billing cycles (Pro+)",
    "SEO optimization and branding removal (Pro+)",
    "Admin controls and compliance features (Teams/Enterprise)"
  ],

  use_cases: [
    "Rapid prototyping and MVP development",
    "Full-stack web application creation from prompts",
    "Frontend UI component development and iteration",
    "Backend API and server logic implementation",
    "Database integration and data persistence",
    "Framework-agnostic web development",
    "Quick proof-of-concept demonstrations",
    "Educational coding projects and tutorials",
    "Client presentation prototypes",
    "Production-ready application scaffolding"
  ],

  integrations: [
    "Netlify (deployment)",
    "Vercel (deployment)",
    "Cloudflare (deployment)",
    "npm ecosystem (full package access)",
    "React framework",
    "Vue framework",
    "Next.js framework",
    "Astro framework",
    "Svelte framework",
    "Remix framework",
    "Angular framework",
    "Node.js runtime",
    "WebContainers (in-browser development)"
  ],

  pricing: {
    model: "Token-based subscription with tiered plans",
    free_tier: false,
    tiers: [
      {
        name: "Pro",
        price: "$20/month",
        billing: "Monthly",
        target: "Individual developers and rapid prototyping",
        recommended: true,
        features: [
          "10M tokens per month for AI generation",
          "Public and private projects",
          "Built-in hosting",
          "Custom domains",
          "Branding removal",
          "SEO optimization",
          "Token rollover between cycles",
          "Unlimited framework support",
          "npm ecosystem access"
        ]
      },
      {
        name: "Teams",
        price: "Custom",
        billing: "Monthly or Annual",
        target: "Development teams and agencies",
        features: [
          "Everything in Pro",
          "Team collaboration features",
          "Admin controls and permissions",
          "Centralized billing",
          "Usage analytics",
          "Priority support",
          "Compliance features"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations requiring advanced features",
        features: [
          "Everything in Teams",
          "Dedicated support and training",
          "Custom token allocations",
          "SLA guarantees",
          "Advanced security and compliance",
          "Custom integrations",
          "White-label options"
        ]
      }
    ]
  },

  differentiators: [
    "$700M valuation with $105.5M Series B (January 2025)",
    "1M+ websites deployed in 5 months",
    "Backed by Emergence Capital and GV",
    "WebContainers: Full Node.js in browser at near-native speed",
    "AI with complete environment control (filesystem, server, terminal)",
    "Token-based pricing vs fixed message limits",
    "Full-stack capabilities: Frontend + backend + database",
    "Support for 7+ major frameworks (React, Vue, Next.js, etc.)",
    "Instant deployment to Netlify, Vercel, Cloudflare",
    "Built-in hosting with custom domains",
    "No remote servers required (100% in-browser)",
    "npm ecosystem with automatic dependency resolution",
    "Token rollover between billing cycles"
  ],

  target_audience: "Web developers seeking rapid prototyping; full-stack engineers building MVPs; frontend developers experimenting with frameworks; agencies creating client demos; startup founders validating ideas; educators teaching web development; designers prototyping interactive UIs; and developers requiring instant deployment without DevOps overhead",

  recent_updates_2025: [
    "Raised $105.5M Series B at $700M valuation (January 2025)",
    "Achieved 1M+ websites deployed milestone",
    "Introduced token-based pricing model (10M tokens/$20)",
    "Expanded framework support to 7+ major frameworks",
    "Added token rollover between billing cycles",
    "Enhanced custom domain and SEO optimization features",
    "Launched Teams and Enterprise plans with admin controls",
    "Improved WebContainers performance for faster builds",
    "Added private project support on all tiers",
    "Expanded deployment integrations (Netlify, Vercel, Cloudflare)"
  ],

  compliance: [
    "SOC 2 compliance (Enterprise tier)",
    "Data privacy controls",
    "Secure deployment pipelines",
    "Team access controls and permissions"
  ],

  parent_company: "StackBlitz"
};

async function updateBoltNew() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Bolt.new with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: boltNewData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'bolt-new'));

    console.log('✅ Bolt.new updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: StackBlitz ($700M valuation, $105.5M Series B)');
    console.log('   - Category: app-builder');
    console.log('   - Features: 16 comprehensive features');
    console.log('   - Pricing: 3 tiers (Pro $20, Teams, Enterprise)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 13 platforms and frameworks');
    console.log('   - Metrics: 1M+ websites deployed');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Bolt.new:', error);
    throw error;
  }
}

updateBoltNew();
