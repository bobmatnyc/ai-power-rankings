import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 5: Refact.ai - Self-Hosted AI Coding Assistant
 * Update comprehensive content for privacy-first enterprise solution
 */

const refactAiData = {
  id: "refact-ai",
  name: "Refact.ai",
  company: "Refact.ai (Small Cloud AI)",
  tagline: "Self-hosted AI coding agent with on-premise deployment, fine-tuning, and autonomous task handling for enterprise privacy",
  description: "Refact.ai is a privacy-first AI coding assistant offering self-hosted deployment that can run on your own infrastructure ensuring code never leaves your servers, with autonomous Agent capabilities handling engineering tasks end-to-end by breaking tasks into logical steps and completing them independently. Available as both cloud and self-hosted versions, Refact.ai provides team-level customization, organization-wide memory, and fine-tuning enabling the AI to learn your coding style, internal APIs, and tech stack to write up to 45% of code for developers. The platform connects with GitHub, GitLab, PostgreSQL, MySQL, Pdb, and Docker to autonomously handle operations across all projects, while understanding company context and standards by analyzing documentation and codebase, learning from each interaction and feedback to become smarter over time, and organizing experience into a knowledge base for quick collaboration across teams. Supporting a wide range of models for both cloud and self-hosted versions with flexibility to choose based on specific needs balancing performance, accuracy, and computational requirements, Refact.ai enables all processing to happen locally ensuring code never leaves your machine - particularly important for enterprises in regulated sectors like FinTech and HealthTech. The autonomous Agent thinks and acts like a developer, enabling teams to deliver more faster while focusing on high-impact work, making Refact.ai the definitive privacy-first AI coding platform for enterprises requiring on-premise deployment with complete data control.",
  overview: "Refact.ai revolutionizes enterprise AI coding by providing a self-hosted, privacy-first platform where organizations maintain complete control over code and data while accessing powerful autonomous AI capabilities that understand company-specific context and standards. Unlike cloud-only AI coding tools that send code to external servers, Refact.ai's self-hosted deployment runs directly on enterprise infrastructure ensuring code never leaves company servers, addressing critical privacy and compliance requirements for regulated industries like FinTech and HealthTech where data sovereignty is non-negotiable. The platform's autonomous Agent capabilities handle engineering tasks end-to-end by breaking complex assignments into logical steps and completing them independently, thinking and acting like a developer to enable teams to deliver more faster while focusing on high-impact strategic work rather than routine coding tasks. Refact.ai's fine-tuning and customization features allow the AI to learn your specific coding style, internal APIs, and tech stack through team-level customization and organization-wide memory, enabling the platform to write up to 45% of code for developers with suggestions that align perfectly with existing patterns and architectural decisions. The platform's deep integrations connect with GitHub, GitLab, PostgreSQL, MySQL, Pdb, and Docker to autonomously handle operations across all projects, while context awareness capabilities understand company standards by analyzing documentation and codebase, learning from each interaction and feedback to become smarter over time, and organizing accumulated experience into a knowledge base enabling quick collaboration and knowledge sharing across teams. Refact.ai's model flexibility supports a wide range of AI models for both cloud and self-hosted deployments, allowing organizations to tailor the assistant to specific needs balancing performance, accuracy, and computational requirements, while local processing ensures all operations happen on-machine without external data transmission. Available for free download and deployment with cloud options for teams not requiring self-hosted infrastructure, Refact.ai provides IDE integration for VS Code, JetBrains, and other popular environments, contextual code completion and chat assistance, automated code refactoring and improvement, documentation generation and maintenance, and bug detection with suggested fixes. As the definitive privacy-first AI coding platform for enterprises, Refact.ai combines self-hosted deployment for complete data control, autonomous Agent capabilities for end-to-end task handling, fine-tuning for company-specific customization, deep tool integrations for seamless workflows, and flexible model selection enabling organizations to optimize for their exact requirements while maintaining security and compliance.",
  website: "https://refact.ai/",
  website_url: "https://refact.ai/",
  launch_year: 2023,
  updated_2025: true,
  category: "autonomous-agent",
  pricing_model: "freemium",

  features: [
    "Self-hosted deployment on your own infrastructure",
    "Code never leaves your servers (on-premise security)",
    "Autonomous Agent handling tasks end-to-end",
    "Breaks tasks into logical steps for independent completion",
    "Team-level customization and organization-wide memory",
    "Fine-tuning to learn coding style, internal APIs, tech stack",
    "Writes up to 45% of code for developers",
    "GitHub, GitLab, PostgreSQL, MySQL, Pdb, Docker integration",
    "Analyzes documentation and codebase for context understanding",
    "Learns from interactions and feedback (continuous improvement)",
    "Knowledge base for team collaboration",
    "Wide range of model support (cloud and self-hosted)",
    "Local processing for complete privacy",
    "IDE integration (VS Code, JetBrains, others)",
    "Contextual code completion and chat assistance",
    "Automated code refactoring and improvement",
    "Documentation generation and maintenance",
    "Bug detection with suggested fixes"
  ],

  use_cases: [
    "Enterprise on-premise AI coding with complete data control",
    "FinTech and HealthTech regulated industry compliance",
    "Autonomous task handling for development teams",
    "Company-specific code style and API learning",
    "Team collaboration with shared AI knowledge base",
    "Multi-tool integration (GitHub, GitLab, databases, Docker)",
    "Local model deployment for air-gapped environments",
    "Code refactoring and technical debt reduction",
    "Documentation automation and maintenance",
    "Bug detection and automated fixing"
  ],

  integrations: [
    "VS Code (IDE integration)",
    "JetBrains IDEs (IDE integration)",
    "GitHub (version control)",
    "GitLab (version control)",
    "PostgreSQL (database)",
    "MySQL (database)",
    "Pdb (debugging)",
    "Docker (containerization)",
    "Self-hosted infrastructure",
    "Cloud deployment option",
    "Multiple AI model providers",
    "Custom AI models"
  ],

  pricing: {
    model: "Freemium with cloud and self-hosted options",
    free_tier: true,
    tiers: [
      {
        name: "Free",
        price: "$0",
        billing: "Forever",
        target: "Individual developers and evaluation",
        features: [
          "Cloud-based deployment",
          "Basic code completion and chat",
          "IDE integration (VS Code, JetBrains)",
          "Community support",
          "Limited model access"
        ]
      },
      {
        name: "Pro",
        price: "Custom",
        billing: "Monthly or Annual",
        target: "Professional developers and small teams",
        recommended: true,
        features: [
          "Enhanced cloud deployment",
          "Advanced code completion and autonomous Agent",
          "Multiple model access",
          "Priority support",
          "Team collaboration features"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Organizations requiring self-hosted deployment",
        features: [
          "Self-hosted on-premise deployment",
          "Complete data sovereignty",
          "Fine-tuning for company-specific customization",
          "Organization-wide memory and knowledge base",
          "GitHub, GitLab, database, Docker integration",
          "Custom model deployment",
          "Dedicated support and training",
          "SLA guarantees",
          "Air-gapped environment support"
        ]
      }
    ]
  },

  differentiators: [
    "Self-hosted deployment on your infrastructure",
    "Code never leaves your servers (complete privacy)",
    "Autonomous Agent for end-to-end task handling",
    "Fine-tuning learns your coding style and APIs",
    "Writes up to 45% of code for developers",
    "Organization-wide memory and knowledge base",
    "GitHub, GitLab, PostgreSQL, MySQL, Docker integration",
    "Local processing (no external data transmission)",
    "Continuous learning from interactions",
    "FinTech and HealthTech compliance-ready",
    "Wide model support (cloud and self-hosted)",
    "Air-gapped environment capability",
    "Team-level customization"
  ],

  target_audience: "Enterprise engineering teams requiring on-premise deployment; FinTech and HealthTech organizations with compliance requirements; teams needing complete data sovereignty; organizations with air-gapped environments; developers wanting privacy-first AI coding; teams seeking fine-tuned company-specific AI; and regulated industries requiring local processing",

  recent_updates_2025: [
    "Launched autonomous Agent available to everyone (January 2025)",
    "Enhanced self-hosted deployment capabilities",
    "Expanded fine-tuning for company-specific customization",
    "Added organization-wide memory and knowledge base",
    "Improved GitHub, GitLab, database integrations",
    "Enhanced context awareness from documentation",
    "Added continuous learning from interactions",
    "Expanded model support for self-hosted deployments",
    "Improved IDE integration (VS Code, JetBrains)",
    "Strengthened air-gapped environment support"
  ],

  compliance: [
    "On-premise deployment (complete data control)",
    "Code never leaves your infrastructure",
    "SOC 2 compliance ready (Enterprise)",
    "GDPR and CCPA compliant (self-hosted)",
    "FinTech and HealthTech regulatory compliance",
    "Air-gapped environment support",
    "Custom data retention policies"
  ],

  parent_company: "Small Cloud AI"
};

async function updateRefactAi() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating Refact.ai with Phase 5 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: refactAiData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'refact-ai'));

    console.log('✅ Refact.ai updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: Refact.ai (Small Cloud AI)');
    console.log('   - Category: autonomous-agent');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: 3 tiers (Free, Pro, Enterprise)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 12 platforms and tools');
    console.log('   - Metrics: Up to 45% code written by AI');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 10 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating Refact.ai:', error);
    throw error;
  }
}

updateRefactAi();
