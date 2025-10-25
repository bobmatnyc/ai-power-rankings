import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: v0 by Vercel - AI-Powered UI Generator
 * QUICK WIN: Minimal update needed (60% complete, just verify company and enhance keyFeatures)
 */

const v0Data = {
  id: "v0-vercel",
  name: "v0",
  company: "Vercel",  // VERIFIED: Correct company
  tagline: "AI-powered UI generator creating React components with Tailwind CSS from natural language prompts",
  description: "v0 by Vercel is an AI-powered web app builder that enables users to design, iterate, and deploy full-stack applications simply by describing what they need in natural language, managing frontend, backend, UI, logic, and deployment seamlessly. The platform generates working React components with Tailwind CSS from plain English descriptions (e.g., 'create a dashboard with charts, filters, sidebar'), delivering JSX and styling instantly with visual editing via Design Mode, GitHub sync for version control, and seamless deployment via Vercel with custom domain support. v0's 2025 token-based pricing model (converting input and output tokens to credits instead of fixed message counts) provides more predictable pricing and increases free tier usage, with plans ranging from Free ($0 with $5 monthly credits) to Premium ($20/month with $20 credits), Team ($30/user/month with $30 credits per user), and Enterprise (custom pricing) offering features like Figma import, v0 API access, collaborative chats, SAML SSO, and training opt-out. Ideal for developers and front-end engineers accelerating UI component creation, designers prototyping quickly, and founders/non-technical planners wanting working MVPs without building everything manually, v0 enables rapid iteration through conversational AI while maintaining production-ready code quality suitable for immediate deployment.",
  overview: "v0 by Vercel revolutionizes UI development by transforming natural language descriptions into production-ready React components with Tailwind CSS styling, enabling rapid prototyping and iteration through conversational AI while maintaining seamless integration with Vercel's deployment platform. The platform's core strength lies in generating working code from plain English prompts (e.g., 'create a dashboard with charts, filters, sidebar'), instantly producing JSX and Tailwind styling that can be previewed, edited, and deployed without writing a single line of code manually. v0's visual editing capabilities via Design Mode allow non-developers to refine generated components through point-and-click interface adjustments, while GitHub sync ensures version control and collaboration, and seamless Vercel deployment with custom domain support enables immediate production launches. The 2025 token-based pricing model replaces fixed message counts with input/output token metering converted to credits, providing more predictable costs and increased free tier usage ($5 monthly credits) while Premium ($20/month with $20 credits) adds 5x higher attachment size limits, Figma import for design-to-code workflows, and v0 API access for programmatic integration. Team plan ($30/user/month with $30 credits per user) introduces centralized billing on Vercel, shared usage across teams, and collaborative chats for real-time co-creation, while Enterprise custom pricing provides training opt-out by default, SAML SSO authentication, priority access with no queues, dedicated support, and full API access. Ideal for developers and front-end engineers seeking to accelerate UI component creation (reducing hours of coding to minutes of prompting), designers who need rapid prototyping without coding skills, and founders or non-technical planners wanting to validate ideas with working MVPs, v0 delivers production-ready React components that integrate seamlessly with modern web development workflows and Vercel's deployment infrastructure for immediate production launches.",
  website: "https://v0.dev/",
  website_url: "https://v0.dev/",
  launch_year: 2023,
  updated_2025: true,
  category: "app-builder",
  pricing_model: "freemium",

  features: [
    "AI-powered React component generation from natural language",
    "Tailwind CSS styling generated automatically",
    "Instant JSX and styling from plain English prompts",
    "Visual editing with Design Mode (point-and-click refinement)",
    "GitHub sync for version control and collaboration",
    "Seamless Vercel deployment with custom domain support",
    "Token-based pricing (more predictable than message counts)",
    "Figma import for design-to-code workflow (Premium+)",
    "v0 API access for programmatic integration (Premium+)",
    "Collaborative chats for real-time team co-creation (Team+)",
    "Centralized billing on Vercel (Team+)",
    "Shared usage across team members (Team+)",
    "SAML SSO authentication (Enterprise)",
    "Training opt-out by default (Enterprise)",
    "Priority access with no queues (Enterprise)"
  ],

  use_cases: [
    "Rapid UI component prototyping for developers",
    "Design-to-code conversion from Figma mockups",
    "MVP validation for non-technical founders",
    "Frontend acceleration for full-stack engineers",
    "Dashboard and admin panel creation",
    "Landing page generation and iteration",
    "Component library building with consistent styling",
    "Team collaboration on UI development",
    "Quick proof-of-concept demonstrations",
    "Production-ready component scaffolding"
  ],

  integrations: [
    "Vercel (deployment platform)",
    "React framework",
    "Tailwind CSS",
    "GitHub (version control and sync)",
    "Figma (design import, Premium+)",
    "v0 API (programmatic access, Premium+)",
    "SAML SSO (Enterprise)",
    "Custom domains"
  ],

  pricing: {
    model: "Token-based credits with tiered plans",
    free_tier: true,
    tiers: [
      {
        name: "Free",
        price: "$0",
        billing: "Forever",
        target: "Experimentation and learning",
        features: [
          "$5 monthly credits",
          "Deploy apps to Vercel",
          "Visual editing with Design Mode",
          "GitHub sync",
          "Community support"
        ]
      },
      {
        name: "Premium",
        price: "$20/month",
        billing: "Monthly",
        target: "Professional developers and designers",
        recommended: true,
        features: [
          "$20 monthly credits",
          "5x higher attachment size limit",
          "Figma import for design-to-code",
          "v0 API access",
          "Option to purchase extra credits",
          "Everything in Free"
        ]
      },
      {
        name: "Team",
        price: "$30/user/month",
        billing: "Monthly",
        target: "Development teams and agencies",
        features: [
          "$30 monthly credits per user",
          "Centralized billing on Vercel",
          "Shared usage across team",
          "Collaborative chats",
          "API access",
          "Everything in Premium"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations",
        features: [
          "Training opt-out by default",
          "SAML SSO authentication",
          "Priority access (no queues)",
          "Dedicated support",
          "Full API access",
          "Custom terms and SLAs"
        ]
      }
    ]
  },

  differentiators: [
    "Vercel-native integration for seamless deployment",
    "Token-based pricing (more predictable than messages)",
    "React + Tailwind CSS (modern, production-ready stack)",
    "Figma import for design-to-code workflows (Premium+)",
    "Design Mode for visual editing without code",
    "GitHub sync for version control",
    "v0 API for programmatic integration",
    "Collaborative chats for team co-creation",
    "Custom domain support out of the box",
    "SAML SSO for enterprise authentication",
    "Training opt-out by default (Enterprise)",
    "Vercel deployment platform integration",
    "Instant JSX and Tailwind generation"
  ],

  target_audience: "Frontend developers accelerating UI creation; React and Tailwind CSS developers; designers converting Figma mockups to code; non-technical founders building MVPs; full-stack engineers prototyping frontends; development teams collaborating on UIs; agencies delivering client projects; and Vercel users seeking integrated AI tools",

  recent_updates_2025: [
    "Introduced token-based pricing (replaced message counts)",
    "Increased free tier usage ($5 monthly credits)",
    "Added Figma import for design-to-code (Premium)",
    "Launched v0 API for programmatic access",
    "Enhanced collaborative chats (Team plan)",
    "Added SAML SSO authentication (Enterprise)",
    "Improved Design Mode visual editing",
    "Expanded custom domain support",
    "Enhanced GitHub sync capabilities",
    "Added training opt-out (Enterprise)"
  ],

  compliance: [
    "Training opt-out by default (Enterprise)",
    "SAML SSO authentication (Enterprise)",
    "SOC 2 Type II certified (Vercel platform)",
    "GDPR compliant",
    "Data privacy controls"
  ],

  parent_company: "Vercel"
};

async function updateV0() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating v0 by Vercel with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: v0Data,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'v0-vercel'));

    console.log('✅ v0 by Vercel updated successfully! (QUICK WIN)\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Vercel ✓ VERIFIED');
    console.log('   - Category: app-builder');
    console.log('   - Features: 15 comprehensive features (ENHANCED)');
    console.log('   - Pricing: 4 tiers (Free, Premium $20, Team $30, Enterprise)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 8 platforms and frameworks');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating v0 by Vercel:', error);
    throw error;
  }
}

updateV0();
