#!/usr/bin/env tsx

/**
 * Update Tabnine Tool with Comprehensive Enterprise Content
 *
 * This script updates the Tabnine tool with:
 * - Complete 2025 pricing information (Dev and Enterprise tiers)
 * - Comprehensive privacy-first features
 * - Enterprise on-premise and air-gapped deployment capabilities
 * - Complete metadata including target audience and use cases
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const TABNINE_SLUG = "tabnine";

const tabnineUpdateData = {
  company: "Tabnine (formerly Codota)",
  website: "https://www.tabnine.com/",
  overview: "Tabnine is the privacy-first enterprise AI coding assistant trusted by organizations in finance, defense, healthcare, and other highly regulated industries requiring absolute code confidentiality. Unlike cloud-dependent AI tools, Tabnine pioneered zero-data-retention AI with support for fully air-gapped deployments, on-premises Kubernetes installations, and private VPC cloud options. Achieving GDPR compliance in 2025 and partnering with Dell for turnkey, GPU-accelerated, air-gapped solutions showcased at NVIDIA GTC 2025, Tabnine delivers enterprise-grade AI without compromising security. The Enterprise tier features the Advanced Context Engine with unlimited codebase connections to Bitbucket, GitHub, GitLab, and Perforce, custom AI code validation rules via the Code Review Agent, and model flexibility supporting third-party providers, open-source models, and internally developed models. With IP indemnification, the Tabnine Protected model trained exclusively on permissively licensed code, and comprehensive security monitoring, Tabnine is the definitive AI assistant for organizations where code privacy is non-negotiable.",
  pricing: {
    model: "Professional and Enterprise subscription tiers",
    tiers: [
      {
        name: "Dev (formerly Basic - discontinued April 2025)",
        price: "$9-12/user/month",
        features: [
          "AI-powered code completions",
          "Support for 80+ programming languages",
          "IDE integration (VS Code, JetBrains, Visual Studio, etc.)",
          "Local processing option",
          "Basic privacy protections",
          "Community support",
          "Time-limited trial available"
        ],
        note: "Free Basic tier discontinued April 2025"
      },
      {
        name: "Enterprise",
        price: "$39/user/month",
        features: [
          "Fully private deployment (SaaS, VPC, on-premises, air-gapped)",
          "Advanced Context Engine with unlimited codebase connections",
          "Support for Bitbucket, GitHub, GitLab, Perforce",
          "Jira integration for issue-driven development",
          "Customized AI code validation rules via Code Review Agent",
          "Model flexibility - third-party, open-source, or internal models",
          "Tabnine Protected model trained on permissive licenses",
          "IP indemnification",
          "Zero data retention guarantee",
          "SSO/SCIM integration",
          "Usage analytics and reporting",
          "Priority support with dedicated team training",
          "Air-gapped and fully on-premises deployment options"
        ],
        recommended: true
      }
    ]
  },
  features: [
    "Zero data retention - code never stored on servers",
    "Fully air-gapped deployment support for maximum security",
    "On-premises Kubernetes installation",
    "Private VPC cloud deployment",
    "Advanced Context Engine with unlimited codebase connections",
    "Code Review Agent enforcing engineering standards",
    "Model flexibility - BYOM (bring your own model)",
    "Tabnine Protected model trained only on permissive licenses",
    "License conflict detection and blocking",
    "Support for 80+ programming languages",
    "IDE integration across VS Code, JetBrains, Visual Studio, Sublime, Atom, Vim",
    "Jira integration for workflow management",
    "IP indemnification for enterprises",
    "GDPR compliant (achieved 2025)"
  ],
  target_audience: "Financial services institutions, defense and government contractors, healthcare organizations, highly regulated enterprises, companies requiring air-gapped environments, privacy-conscious development teams, organizations with strict data residency requirements, and enterprises needing on-premises AI solutions",
  use_cases: [
    "Air-gapped development in defense and government sectors",
    "HIPAA-compliant healthcare application development",
    "Financial services with strict data governance (PCI DSS, SOX)",
    "On-premises enterprise development with no cloud dependency",
    "Code review automation with custom organizational standards",
    "Multi-repository development with unlimited codebase context",
    "License compliance enforcement during development",
    "Regulated industry development (pharma, legal, insurance)",
    "Custom model deployment for specialized domains",
    "Zero-trust security architecture development"
  ],
  integrations: [
    "Visual Studio Code",
    "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, GoLand, etc.)",
    "Visual Studio",
    "Sublime Text",
    "Atom",
    "Vim/Neovim",
    "Eclipse",
    "GitHub Enterprise",
    "GitLab",
    "Bitbucket",
    "Perforce",
    "Jira",
    "SSO providers (SAML, SCIM)",
    "On-premises infrastructure (Kubernetes)"
  ],
  launch_year: 2013,
  updated_2025: true,
  recent_updates_2025: [
    "Achieved GDPR compliance",
    "Discontinued free Basic tier (April 2025)",
    "Partnered with Dell for turnkey air-gapped GPU solutions (NVIDIA GTC 2025)",
    "Enhanced Code Review Agent with customizable validation rules",
    "Expanded Advanced Context Engine capabilities",
    "Improved model flexibility with BYOM support",
    "Added support for internal and custom-developed models",
    "Enhanced security monitoring and audit capabilities"
  ],
  enterprise_features: {
    privacy_security: [
      "Zero data retention - code never stored",
      "Fully air-gapped deployment support",
      "On-premises Kubernetes installation",
      "Private VPC cloud deployment",
      "No training on customer code",
      "TLS encrypted transmission",
      "GDPR compliance (2025)",
      "IP indemnification",
      "Continuous security monitoring and audits",
      "SOC 2, ISO compliance support"
    ],
    deployment_options: [
      "Secure SaaS",
      "Single-tenant VPC (AWS, Azure, GCP)",
      "On-premises Kubernetes",
      "Fully air-gapped environments",
      "Turnkey Dell GPU-accelerated solutions",
      "Hybrid deployment architectures"
    ],
    customization: [
      "Advanced Context Engine with unlimited codebase connections",
      "Custom AI code validation rules",
      "Code Review Agent for standards enforcement",
      "Model flexibility - third-party, open-source, internal",
      "Tabnine Protected model option",
      "Organizational pattern learning",
      "Custom license policy enforcement"
    ],
    administration: [
      "SSO/SCIM integration",
      "Centralized user management",
      "Usage analytics and reporting",
      "License compliance tracking",
      "Team training and onboarding",
      "Priority support with SLA",
      "Dedicated customer success"
    ]
  },
  compliance: [
    "GDPR (achieved 2025)",
    "SOC 2 Type II",
    "ISO 27001",
    "HIPAA eligible",
    "PCI DSS supportable",
    "Data residency controls",
    "Air-gapped environment certified"
  ],
  competitive_advantages: [
    "Industry-leading privacy with zero data retention",
    "Only major AI assistant supporting fully air-gapped deployments",
    "Turnkey air-gapped solutions with Dell partnership",
    "Tabnine Protected model trained only on permissive licenses",
    "No vendor lock-in with BYOM flexibility",
    "Proven in highly regulated industries (finance, defense, healthcare)",
    "Unlimited codebase connections vs. competitors' limitations",
    "Code Review Agent for automated standards enforcement"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, TABNINE_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateTabnineTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${TABNINE_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${TABNINE_SLUG}`);
    return { success: false, message: "Tool not found" };
  }

  console.log(`  ✓ Found tool: ${existingTool.name}`);
  console.log(`  Current category: ${existingTool.category}`);

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`\n📊 BEFORE UPDATE:`);
  console.log(`  Company: ${existingData.company || 'MISSING'}`);
  console.log(`  Website: ${existingData.website || 'MISSING'}`);
  console.log(`  Overview: ${existingData.overview ? existingData.overview.substring(0, 80) + '...' : 'MISSING'}`);

  // Update the tool data - merge with existing data
  const updatedData = {
    ...existingData,
    ...tabnineUpdateData,
    // Keep existing description if it's good
    description: existingData.description || tabnineUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, TABNINE_SLUG))
    .returning();

  if (result.length > 0) {
    const updatedTool = result[0];
    const updatedToolData = updatedTool.data as Record<string, any>;

    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`  Company: ${updatedToolData.company}`);
    console.log(`  Website: ${updatedToolData.website}`);
    console.log(`  Overview: ${updatedToolData.overview.substring(0, 100)}...`);
    console.log(`  Features: ${updatedToolData.features.length} features added`);
    console.log(`  Pricing tiers: ${updatedToolData.pricing.tiers.length} tiers configured`);
    console.log(`  Target audience: ${updatedToolData.target_audience.substring(0, 80)}...`);
    console.log(`  Enterprise features: ${Object.keys(updatedToolData.enterprise_features).length} categories`);
    console.log(`  Compliance: ${updatedToolData.compliance.length} standards`);
    console.log(`  Competitive advantages: ${updatedToolData.competitive_advantages.length} listed`);

    console.log(`\n✅ Successfully updated ${TABNINE_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${TABNINE_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Tabnine tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Tabnine");
  console.log("Slug: tabnine");
  console.log("Category: Privacy-First Enterprise AI Coding Assistant");
  console.log("Website: https://www.tabnine.com/");
  console.log("=".repeat(80));

  try {
    const result = await updateTabnineTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Tabnine tool now has:");
      console.log("  ✅ Company: Tabnine");
      console.log("  ✅ Website: https://www.tabnine.com/");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 14 key features");
      console.log("  ✅ 2 pricing tiers (Dev, Enterprise)");
      console.log("  ✅ Enterprise features detailed (4 categories)");
      console.log("  ✅ Compliance standards (7 listed)");
      console.log("  ✅ Competitive advantages (8 listed)");
      console.log("  ✅ Target audience defined");
      console.log("  ✅ 10 use cases listed");
      console.log("  ✅ 14 integrations documented");
      console.log("  ✅ 2025 recent updates included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Tabnine tool:", error);
    process.exit(1);
  }
}

// Run the script
main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
