import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 4: CodeRabbit - AI Code Review Specialist
 * Update comprehensive content for code review tool
 */

const coderabbitData = {
  id: "coderabbit",
  name: "CodeRabbit",
  company: "CodeRabbit Inc.",
  tagline: "AI-powered code review platform that delivers context-aware pull request reviews at enterprise scale",
  description: "CodeRabbit is the most-installed AI code review app on GitHub and GitLab, delivering automated, context-aware pull request reviews at enterprise scale. With over 2 million repositories and 13 million pull requests reviewed, CodeRabbit combines advanced language models with AST (Abstract Syntax Tree) analysis to provide inline code suggestions, detect bugs and security vulnerabilities, and enforce coding standards. The platform learns from your codebase and team interactions to deliver increasingly accurate reviews with industry-leading signal-to-noise ratios. Backed by $60M Series B funding (September 2025, $550M valuation) and trusted by 8,000+ customers, CodeRabbit integrates seamlessly with GitHub, GitLab, and Azure DevOps while maintaining SOC2 Type II compliance and offering ephemeral review environments with zero data retention for maximum security.",
  overview: "CodeRabbit revolutionizes code review by combining AI-powered automation with deep codebase understanding to deliver context-aware pull request reviews that help teams ship higher quality code faster. As the most-installed AI app on both GitHub and GitLab, CodeRabbit has processed over 13 million pull requests across 2 million repositories, catching bugs, security vulnerabilities, and coding standard violations before they reach production. The platform's AI engine generates detailed PR summaries, validates linked issues (Jira and Linear), suggests relevant reviewers, provides code flow visualizations with sequence diagrams, and offers one-click fixes that follow your team's coding guidelines. Unlike generic code review tools, CodeRabbit's conversational AI chat enables multi-step interactions for generating code, unit tests, and creating issues while continuously learning and improving from user feedback. With flexible deployment options (cloud or self-hosted), industry-leading security (SOC2 Type II, end-to-end encryption), and public repository reviews free forever, CodeRabbit is the definitive AI code review platform for modern development teams at any scale.",
  website: "https://www.coderabbit.ai/",
  website_url: "https://www.coderabbit.ai/",
  launch_year: 2023,
  updated_2025: true,
  category: "code-review",
  pricing_model: "freemium",

  info: {
    business: {
      company: "CodeRabbit Inc.",
      founded: "2023",
      funding: "$60M Series B (September 2025)",
      valuation: "$550M",
      metrics: {
        repositories: "2,000,000+",
        pull_requests_reviewed: "13,000,000+",
        customers: "8,000+",
        monthly_growth: "20%",
        arr: "$15M+"
      },
      pricing_model: "freemium",
      pricing_details: {
        Free: {
          price: "$0",
          description: "Public repositories - Free forever",
          features: [
            "Unlimited PR reviews for public repos",
            "Line-by-line code reviews",
            "AI chatbot assistance",
            "Community support"
          ]
        },
        Lite: {
          price: "$12/developer/month (annual) or $15/month",
          description: "For individual developers and small teams",
          features: [
            "Unlimited pull request reviews",
            "Line-by-line code reviews with inline suggestions",
            "AI chatbot for code assistance",
            "PR summaries and sequence diagrams",
            "Jira & Linear issue validation",
            "Email support",
            "14-day free trial (no credit card required)"
          ]
        },
        Pro: {
          price: "$24/developer/month (annual) or $30/month",
          description: "For professional development teams",
          features: [
            "Everything in Lite, plus:",
            "Linters and SAST tools integration",
            "Jira & Linear deep integrations",
            "Product analytics dashboards",
            "Customizable reports",
            "Docstrings generation",
            "Code graph analysis for enhanced context",
            "Auto-generated daily standup reports",
            "Sprint review automation",
            "Priority support",
            "14-day free trial (no credit card required)"
          ],
          recommended: true
        },
        Enterprise: {
          price: "Custom pricing",
          description: "For large enterprises requiring advanced security and compliance",
          features: [
            "Everything in Pro, plus:",
            "Self-hosting options (on-premise deployment)",
            "Service Level Agreements (SLAs)",
            "Onboarding assistance and training",
            "Dedicated Customer Success Manager",
            "AWS/GCP marketplace payment options",
            "Contract redlines and custom terms",
            "Vendor security review support",
            "Advanced access controls",
            "Custom integrations",
            "24/7 premium support"
          ]
        }
      }
    },

    product: {
      tagline: "AI-powered code review platform that delivers context-aware pull request reviews at enterprise scale",
      description: "CodeRabbit is the most-installed AI code review app on GitHub and GitLab, delivering automated, context-aware pull request reviews at enterprise scale with over 2 million repositories and 13 million pull requests reviewed.",

      features: [
        "Automated pull request reviews for GitHub, GitLab, and Azure DevOps",
        "Line-by-line code analysis with inline suggestions and one-click fixes",
        "Advanced code graph analysis for deep codebase understanding",
        "Bug detection and security vulnerability identification",
        "Coding standards enforcement and anti-pattern detection",
        "Auto-generated PR summaries and sequence diagrams",
        "Jira and Linear issue validation and linking",
        "Intelligent reviewer selection suggestions",
        "Conversational AI chat for multi-step code tasks",
        "Automated test generation and code improvement",
        "Daily standup reports and sprint review automation",
        "Docstrings and documentation generation",
        "Custom linters and SAST tools integration",
        "Product analytics dashboards and customizable reports",
        "Free AI code reviews in VS Code IDE",
        "SOC2 Type II certified with end-to-end encryption",
        "Ephemeral review environments (zero data retention option)"
      ],

      use_cases: [
        "Automated pull request review and quality assurance",
        "Security vulnerability detection before production",
        "Coding standards enforcement across teams",
        "Onboarding new developers with consistent feedback",
        "Reducing code review bottlenecks and wait times",
        "Catching bugs and anti-patterns early in development",
        "Generating documentation and test coverage",
        "Sprint reporting and team productivity analytics",
        "Enterprise-scale code quality at startups",
        "Compliance-driven code review for regulated industries"
      ]
    },

    technical: {
      platforms: ["GitHub", "GitLab", "Azure DevOps"],
      ide_support: ["VS Code"],
      ai_models: ["Advanced language models with AST analysis"],
      deployment: ["Cloud (SaaS)", "Self-hosted (Enterprise)"],
      security: {
        certifications: ["SOC2 Type II"],
        encryption: "End-to-end SSL encryption",
        data_retention: "Ephemeral review environments available",
        compliance: ["GDPR compliant"]
      },
      integration_types: [
        "Git hosting platforms (GitHub, GitLab, Azure DevOps)",
        "Issue tracking (Jira, Linear)",
        "Linters and SAST tools",
        "CI/CD pipelines",
        "Cloud marketplaces (AWS, GCP)"
      ],
      api_available: true,
      context_window: "Full repository context",
      learning_capability: "Continuous learning from user interactions"
    },

    links: {
      website: "https://www.coderabbit.ai/",
      pricing: "https://www.coderabbit.ai/pricing",
      documentation: "https://www.coderabbit.ai/docs",
      ide_extension: "https://www.coderabbit.ai/ide"
    }
  },

  features: [
    "Automated pull request reviews for GitHub, GitLab, and Azure DevOps",
    "Line-by-line code analysis with inline suggestions and one-click fixes",
    "Advanced code graph analysis for deep codebase understanding",
    "Bug detection and security vulnerability identification",
    "Coding standards enforcement and anti-pattern detection",
    "Auto-generated PR summaries and sequence diagrams",
    "Jira and Linear issue validation and linking",
    "Intelligent reviewer selection suggestions",
    "Conversational AI chat for multi-step code tasks",
    "Automated test generation and code improvement",
    "Daily standup reports and sprint review automation",
    "Docstrings and documentation generation",
    "Custom linters and SAST tools integration",
    "Product analytics dashboards and customizable reports",
    "Free AI code reviews in VS Code IDE",
    "SOC2 Type II certified with end-to-end encryption",
    "Ephemeral review environments (zero data retention option)"
  ],

  use_cases: [
    "Automated pull request review and quality assurance",
    "Security vulnerability detection before production",
    "Coding standards enforcement across teams",
    "Onboarding new developers with consistent feedback",
    "Reducing code review bottlenecks and wait times",
    "Catching bugs and anti-patterns early in development",
    "Generating documentation and test coverage",
    "Sprint reporting and team productivity analytics",
    "Enterprise-scale code quality at startups",
    "Compliance-driven code review for regulated industries"
  ],

  integrations: [
    "GitHub (pull requests and workflows)",
    "GitLab (merge requests and CI/CD)",
    "Azure DevOps (pull requests and pipelines)",
    "Jira (issue tracking and validation)",
    "Linear (issue tracking and project management)",
    "VS Code (IDE code reviews)",
    "Linters (ESLint, Pylint, RuboCop, etc.)",
    "SAST tools (static application security testing)",
    "AWS Marketplace",
    "GCP Marketplace",
    "Slack (notifications)",
    "CI/CD pipelines (GitHub Actions, GitLab CI, Azure Pipelines)"
  ],

  target_audience: "Software development teams of all sizes, from startups to enterprises; engineering managers seeking to improve code quality and review efficiency; DevOps teams requiring security and compliance; open-source project maintainers; organizations using GitHub, GitLab, or Azure DevOps; teams needing SOC2 compliance; and developers seeking faster PR review cycles",

  differentiators: [
    "Most-installed AI code review app on GitHub & GitLab",
    "2M+ repositories and 13M+ pull requests reviewed",
    "Industry-leading signal-to-noise ratio with code graph analysis",
    "Conversational AI for multi-step code generation and testing",
    "Auto-generated sprint reports and daily standups",
    "Jira & Linear issue validation and linking",
    "Free forever for public repositories",
    "SOC2 Type II certified with ephemeral review environments",
    "20% month-over-month growth with $15M+ ARR",
    "$550M valuation backed by leading investors",
    "Self-hosting options for enterprise security",
    "One-click fixes following team coding guidelines",
    "Continuous learning from team feedback and interactions"
  ],

  recent_updates_2025: [
    "Raised $60M Series B at $550M valuation (September 2025)",
    "Achieved 20% month-over-month growth with $15M+ ARR",
    "Expanded to 2M+ repositories and 13M+ pull requests reviewed",
    "Added code graph analysis for enhanced context understanding",
    "Launched free AI code reviews in VS Code IDE",
    "Integrated Jira and Linear issue validation",
    "Added automated daily standup and sprint review reports",
    "Enhanced conversational AI chat for multi-step tasks",
    "Expanded enterprise features with self-hosting options",
    "Achieved SOC2 Type II certification",
    "Added AWS and GCP marketplace payment options"
  ],

  pricing: {
    model: "Freemium with Lite, Pro, and Enterprise tiers",
    free_tier: true,
    starting_price: "$12/developer/month (Lite tier, annual)",
    tiers: [
      {
        name: "Free",
        price: "$0",
        billing: "Forever",
        target: "Public repositories and open-source projects",
        features: [
          "Unlimited PR reviews for public repos",
          "Line-by-line code reviews",
          "AI chatbot assistance",
          "Community support"
        ]
      },
      {
        name: "Lite",
        price: "$12/developer/month",
        billing: "Annual ($15/month monthly)",
        target: "Individual developers and small teams",
        features: [
          "Unlimited pull request reviews",
          "Line-by-line code reviews with inline suggestions",
          "AI chatbot for code assistance",
          "PR summaries and sequence diagrams",
          "Jira & Linear issue validation",
          "Email support",
          "14-day free trial (no credit card required)"
        ]
      },
      {
        name: "Pro",
        price: "$24/developer/month",
        billing: "Annual ($30/month monthly)",
        target: "Professional development teams",
        recommended: true,
        features: [
          "Everything in Lite",
          "Linters and SAST tools integration",
          "Jira & Linear deep integrations",
          "Product analytics dashboards",
          "Customizable reports",
          "Docstrings generation",
          "Code graph analysis",
          "Auto-generated daily standup reports",
          "Sprint review automation",
          "Priority support",
          "14-day free trial (no credit card required)"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom pricing",
        billing: "Annual contract",
        target: "Large enterprises requiring advanced security",
        features: [
          "Everything in Pro",
          "Self-hosting options",
          "Service Level Agreements (SLAs)",
          "Onboarding assistance",
          "Dedicated Customer Success Manager",
          "AWS/GCP marketplace payments",
          "Contract redlines and custom terms",
          "Vendor security review support",
          "Advanced access controls",
          "Custom integrations",
          "24/7 premium support"
        ]
      }
    ]
  },

  compliance: [
    "SOC2 Type II certified",
    "GDPR compliant",
    "End-to-end SSL encryption",
    "Ephemeral review environments (zero data retention)",
    "Enterprise access controls and permissions",
    "Vendor security review support"
  ],

  parent_company: "CodeRabbit Inc.",

  enterprise_features: {
    security: [
      "SOC2 Type II certification",
      "Self-hosting and on-premise deployment",
      "Ephemeral review environments with zero data retention",
      "End-to-end encryption and SSL",
      "Advanced access controls and permissions",
      "Vendor security review support"
    ],
    customization: [
      "Custom linters and SAST tools integration",
      "Customizable coding standards and rules",
      "Team-specific learning and feedback loops",
      "Custom reports and analytics dashboards",
      "Tailored onboarding and training"
    ],
    administration: [
      "Dedicated Customer Success Manager",
      "Service Level Agreements (SLAs)",
      "AWS and GCP marketplace billing",
      "Contract redlines and custom terms",
      "24/7 premium support",
      "Product analytics and usage tracking"
    ]
  }
};

async function updateCodeRabbit() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating CodeRabbit with Phase 4 specialized content...\n');

    // Update the tool
    await db
      .update(tools)
      .set({
        data: coderabbitData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'coderabbit'));

    console.log('✅ CodeRabbit updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: CodeRabbit Inc. ($550M valuation, $60M Series B)');
    console.log('   - Tagline: AI-powered code review platform');
    console.log('   - Description: Comprehensive overview with metrics');
    console.log('   - Features: 17 specialized features');
    console.log('   - Pricing: 4 tiers (Free, Lite $12, Pro $24, Enterprise)');
    console.log('   - Use Cases: 10 specialized scenarios');
    console.log('   - Integrations: 12+ platforms and tools');
    console.log('   - Metrics: 2M+ repos, 13M+ PRs, 8K+ customers');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 11 recent enhancements');

  } catch (error) {
    console.error('❌ Error updating CodeRabbit:', error);
    throw error;
  }
}

updateCodeRabbit();
