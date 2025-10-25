import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 6: JetBrains AI Assistant - Enterprise IDE AI with Free Tier
 * Enhanced comprehensive content with 2025 updates
 */

const jetbrainsAiData = {
  id: "jetbrains-ai-assistant",
  name: "JetBrains AI Assistant",
  company: "JetBrains",
  tagline: "Enterprise AI coding assistant recognized in 2025 Gartner Magic Quadrant with free tier, Junie coding agent (53.6% SWEBench), and deep IntelliJ Platform integration serving 25M+ developers",
  description: "JetBrains AI Assistant is the comprehensive AI-powered development companion deeply integrated across JetBrains' IntelliJ Platform serving 25+ million developers worldwide, now featuring free tier with unlimited code completion and local AI models launched in 2025.1 release, Junie autonomous coding agent achieving 53.6% success on SWEBench Verified benchmark, and official recognition in 2025 Gartner Magic Quadrant for AI Code Assistants published September 2025 validating enterprise leadership. The platform delivers context-aware AI chat leveraging project context for intelligent question-answering, code generation across Java, Kotlin, Python with internally-trained LLMs reducing latency, automated test generation, commit message and documentation creation, code translations and explanations, runtime error analysis, SQL query and regex explanations, name suggestions, intelligent refactorings, and proactive issue detection integrated seamlessly into IDE workflows including editor suggestions, VCS assistance, and debugging support. Junie coding agent operates like a junior software engineer tackling complex long-form work including exploring, writing, and refactoring projects, acting as coding partner for testing and debugging, generating optimized code with best practice summaries, and solving 53.6% of SWEBench Verified tasks on single runs, available in IntelliJ IDEA Ultimate, PyCharm Professional, WebStorm, GoLand with PhpStorm, RustRover, RubyMine support coming soon. Enterprise capabilities include AI Enterprise with provider choice (OpenAI, Anthropic, Google, Azure/OpenAI-compatible), local/on-premises model deployment, centralized policies and audit logs, SSO provisioning, enterprise-grade security, IDE Services on-premises deployment ensuring complete data control, AI usage statistics and reporting, and All Products Pack inclusion ($28.90/user/month) bundling AI Pro with complete JetBrains tooling. Available through AI Free tier (unlimited code completion, local AI models, credit-based cloud features and Junie access with 30-day AI Pro trial), AI Pro ($10/user/month with increased quotas included in All Products Pack), and AI Ultimate ($20/user/month with maximum capacity), supporting IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, RustRover, RubyMine, Android Studio (paid tiers only), and excluding Community Editions and PyCharm Unified free usage, JetBrains AI Assistant delivers the definitive enterprise IDE AI experience combining Gartner-recognized leadership with accessible free tier democratization, autonomous Junie agent capabilities, comprehensive language support with custom-trained models, and enterprise deployment flexibility serving individual developers through Fortune 500 organizations.",
  overview: "JetBrains AI Assistant revolutionizes IDE-integrated AI assistance by combining deep native integration across the IntelliJ Platform serving 25+ million developers with enterprise-grade capabilities validated through 2025 Gartner Magic Quadrant recognition and accessible free tier democratizing AI coding tools. Unlike standalone AI assistants requiring context switching, JetBrains AI operates seamlessly within familiar IDE workflows leveraging complete project context for intelligent code completion, chat-based question answering, automated test generation, documentation creation, refactoring suggestions, and runtime error explanations integrated into editor, VCS, debugging, and code review interfaces developers already use daily. The 2025.1 release transformed accessibility by introducing AI Free tier providing unlimited code completion and local AI model access plus credit-based usage of cloud-powered features and Junie coding agent with 30-day AI Pro trial, eliminating barriers for individual developers and students while maintaining professional capabilities previously requiring paid subscriptions. Junie autonomous coding agent represents JetBrains' entry into agentic AI development, operating like a junior software engineer capable of complex long-form work including project exploration, code writing and refactoring, testing and debugging assistance, optimized code generation with best practice summaries, and achieving impressive 53.6% success rate on SWEBench Verified benchmark's 500 curated developer tasks on single runs. The platform leverages JetBrains' internally-trained large language models for Java, Kotlin, and Python delivering significantly improved code completion quality and reduced latency compared to generic models, while supporting comprehensive language coverage across JavaScript/TypeScript, Go, PHP, Rust, Ruby, and database-specific features ensuring broad applicability across polyglot development environments. Enterprise capabilities address organizational requirements through AI Enterprise offering provider choice (OpenAI, Anthropic, Google, Azure/OpenAI-compatible endpoints), local and on-premises model deployment for air-gapped environments, centralized policies and audit logs for compliance and governance, SSO provisioning for streamlined authentication, and complete IDE Services on-premises installation ensuring all data and AI operations remain within organizational infrastructure boundaries. Recognition in 2025 Gartner Magic Quadrant for AI Code Assistants (published September 15, 2025) validates JetBrains' enterprise positioning and comprehensive capabilities, while strategic pricing including AI Pro bundled with All Products Pack ($28.90/user/month total providing complete JetBrains tooling plus AI Pro capabilities) delivers exceptional value for teams already invested in JetBrains ecosystem. Available across IntelliJ IDEA, PyCharm Professional, WebStorm, GoLand, PhpStorm, RustRover, RubyMine with Android Studio paid tier support, JetBrains AI Assistant represents the definitive enterprise IDE AI solution combining Gartner-validated leadership, accessible free tier democratization, autonomous Junie agent capabilities achieving 53.6% SWEBench success, custom-trained models for reduced latency, and flexible enterprise deployment options serving individual developers, professional teams, and Fortune 500 organizations requiring comprehensive governance, compliance, and on-premises deployment capabilities.",
  website: "https://www.jetbrains.com/ai/",
  website_url: "https://www.jetbrains.com/ai/",
  launch_year: 2023,
  updated_2025: true,
  category: "ide-assistant",
  pricing_model: "freemium",

  features: [
    "Deep integration across IntelliJ Platform (25M+ developers)",
    "2025 Gartner Magic Quadrant recognition",
    "AI Free tier: Unlimited code completion + local models",
    "Junie autonomous coding agent (53.6% SWEBench success)",
    "Context-aware AI chat with project intelligence",
    "Code generation with internally-trained LLMs (Java/Kotlin/Python)",
    "Automated test generation and execution",
    "Commit message and documentation creation",
    "Code translation across languages",
    "Runtime error explanation and debugging assistance",
    "SQL query and regex explanations",
    "Intelligent refactoring suggestions",
    "Proactive issue detection",
    "AI Enterprise: Provider choice (OpenAI/Anthropic/Google/Azure)",
    "Local and on-premises model deployment",
    "Centralized policies and audit logs",
    "SSO provisioning and enterprise authentication",
    "IDE Services on-premises for complete data control"
  ],

  use_cases: [
    "Enterprise development with Gartner-validated AI assistance",
    "Free tier adoption for students and individual developers",
    "Autonomous coding with Junie agent for complex long-form work",
    "Multi-language development across Java, Kotlin, Python ecosystems",
    "Automated test generation and quality assurance",
    "Runtime debugging with AI-powered error explanations",
    "Code refactoring and technical debt reduction",
    "Documentation and commit message automation",
    "On-premises deployment for air-gapped environments (AI Enterprise)",
    "Compliance-driven development with audit logs and policies",
    "Team collaboration with All Products Pack integration",
    "Database development with SQL AI assistance",
    "Polyglot projects across JavaScript, Go, PHP, Rust, Ruby",
    "Educational coding with free tier unlimited completion"
  ],

  integrations: [
    "IntelliJ IDEA (Ultimate and Community*)",
    "PyCharm (Professional and Community*)",
    "WebStorm",
    "GoLand",
    "PhpStorm",
    "RustRover",
    "RubyMine",
    "Android Studio (paid tiers only)",
    "JetBrains IDE Services (on-premises)",
    "OpenAI (AI Enterprise)",
    "Anthropic Claude (AI Enterprise)",
    "Google AI (AI Enterprise)",
    "Azure OpenAI (AI Enterprise)",
    "Local AI models (AI Free)",
    "SSO providers (AI Enterprise)",
    "Git and VCS systems",
    "CI/CD pipelines"
  ],

  pricing: {
    model: "Freemium with AI Pro, AI Ultimate, and AI Enterprise tiers",
    free_tier: true,
    tiers: [
      {
        name: "AI Free",
        price: "$0",
        billing: "Forever",
        target: "Individual developers, students, and open source",
        features: [
          "Unlimited code completion",
          "Access to local AI models",
          "Credit-based cloud AI features",
          "Junie coding agent access (credits)",
          "30-day AI Pro trial included",
          "All JetBrains IDEs except Android Studio",
          "Not available in Community Editions",
          "Not available in PyCharm Unified free usage",
          "Context-aware assistance",
          "Basic refactoring suggestions"
        ]
      },
      {
        name: "AI Pro",
        price: "$10/user/month",
        billing: "Monthly or Annual",
        target: "Professional developers and teams",
        recommended: true,
        features: [
          "Everything in AI Free",
          "Increased usage quotas for cloud features",
          "Enhanced Junie coding agent capacity",
          "Priority support",
          "Included in All Products Pack ($28.90/user/month)",
          "Android Studio support",
          "Advanced code generation",
          "Full documentation automation",
          "Team collaboration features"
        ]
      },
      {
        name: "AI Ultimate",
        price: "$20/user/month",
        billing: "Monthly or Annual",
        target: "Power users and intensive AI development",
        features: [
          "Everything in AI Pro",
          "Maximum usage quotas",
          "Highest Junie agent capacity",
          "Premium support",
          "Advanced analytics",
          "Extended AI capabilities"
        ]
      },
      {
        name: "AI Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations and regulated industries",
        features: [
          "Provider choice: OpenAI, Anthropic, Google, Azure",
          "Local and on-premises model deployment",
          "Centralized policies and governance",
          "Audit logs and compliance reporting",
          "SSO provisioning",
          "IDE Services on-premises installation",
          "Complete data sovereignty",
          "AI usage statistics and reports",
          "Dedicated account management",
          "24/7 priority enterprise support",
          "Custom SLA guarantees"
        ]
      }
    ]
  },

  differentiators: [
    "2025 Gartner Magic Quadrant recognition (Sep 15, 2025)",
    "25+ million developers on IntelliJ Platform",
    "AI Free tier: Unlimited completion + local models (2025.1)",
    "Junie agent: 53.6% SWEBench Verified success",
    "Internally-trained LLMs for Java, Kotlin, Python",
    "Deep native IDE integration across workflows",
    "AI Enterprise: Provider choice and on-premises deployment",
    "All Products Pack bundling: AI Pro + all tools ($28.90/user/month)",
    "Centralized policies and audit logs",
    "SSO provisioning for enterprise authentication",
    "Complete data control with IDE Services on-premises",
    "30-day AI Pro trial with free tier",
    "Comprehensive language support (8+ languages)"
  ],

  target_audience: "Enterprise development teams requiring Gartner-validated AI tools; JetBrains IDE users across IntelliJ, PyCharm, WebStorm, GoLand ecosystems (25M+ developers); individual developers and students leveraging free tier with unlimited completion; organizations needing on-premises deployment and data sovereignty (AI Enterprise); compliance-driven industries requiring audit logs and policies; polyglot development teams across Java, Kotlin, Python, JavaScript, Go, PHP, Rust, Ruby; and teams using All Products Pack seeking integrated AI Pro capabilities",

  recent_updates_2025: [
    "Recognized in 2025 Gartner Magic Quadrant (Sep 15, 2025)",
    "2025.1 release: AI Free tier launched",
    "Junie coding agent public availability",
    "53.6% SWEBench Verified benchmark achievement",
    "Internally-trained LLMs for Java, Kotlin, Python",
    "Unlimited code completion in free tier",
    "Local AI model support in free tier",
    "AI Enterprise with provider choice",
    "On-premises IDE Services deployment",
    "Centralized policies and audit logs",
    "SSO provisioning capabilities",
    "30-day AI Pro trial for free tier users",
    "Android Studio paid tier support",
    "PhpStorm, RustRover, RubyMine Junie support (coming soon)"
  ],

  compliance: [
    "SOC 2 compliance",
    "On-premises deployment option (IDE Services)",
    "Complete data sovereignty (AI Enterprise)",
    "Audit logs and compliance reporting",
    "Centralized governance policies",
    "SSO integration",
    "GDPR compliance",
    "Local AI model execution (no cloud dependency)"
  ],

  parent_company: "JetBrains",
  headquarters: "Prague, Czech Republic",

  junie_capabilities: {
    benchmark_performance: "53.6% success on SWEBench Verified (500 tasks)",
    task_types: [
      "Complex long-form project work",
      "Code writing and refactoring",
      "Testing and debugging assistance",
      "Optimized code generation",
      "Best practice summaries"
    ],
    availability: "IntelliJ IDEA Ultimate, PyCharm Professional, WebStorm, GoLand (PhpStorm, RustRover, RubyMine coming soon)"
  },

  platform_support: {
    intellij_platform_users: "25+ million developers",
    supported_ides: [
      "IntelliJ IDEA (Ultimate and Community*)",
      "PyCharm (Professional and Community*)",
      "WebStorm",
      "GoLand",
      "PhpStorm",
      "RustRover",
      "RubyMine",
      "Android Studio (paid tiers only)"
    ],
    limitations: [
      "Not available in Android Studio on free tier",
      "Not available in Community Editions on free tier",
      "Not available in PyCharm Unified free usage"
    ]
  }
};

async function updateJetBrainsAI() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating JetBrains AI Assistant with Phase 6 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: jetbrainsAiData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'jetbrains-ai-assistant'));

    console.log('✅ JetBrains AI Assistant updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: JetBrains');
    console.log('   - Category: ide-assistant');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: 4 tiers (Free, Pro $10, Ultimate $20, Enterprise)');
    console.log('   - Use Cases: 14 specialized scenarios');
    console.log('   - Integrations: 17 platforms and tools');
    console.log('   - Platform Users: 25+ million developers');
    console.log('   - Gartner Recognition: 2025 Magic Quadrant');
    console.log('   - Junie Performance: 53.6% SWEBench success');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 14 major enhancements');

  } catch (error) {
    console.error('❌ Error updating JetBrains AI Assistant:', error);
    throw error;
  }
}

updateJetBrainsAI();
