import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 6: CodeRabbit - #1 GitHub AI Code Review
 * Enhanced comprehensive content with 2025 Series B updates
 */

const coderabbitData = {
  id: "coderabbit",
  name: "CodeRabbit",
  company: "CodeRabbit",
  tagline: "#1 GitHub AI app with $60M Series B, 8K+ paying customers, 30-40% monthly growth, and free tier in VS Code/Cursor/Windsurf for instant inline code reviews",
  description: "CodeRabbit is the #1 ranked AI application on GitHub and GitLab Marketplace delivering AI-powered code reviews that address the quality crisis from AI code generation proliferation, raising $60 million Series B at $550 million valuation led by Scale Venture Partners with NVentures (NVIDIA Venture Capital) participation bringing total funding to $88 million as the company demonstrates exceptional 30-40% monthly revenue growth, $15+ million annual recurring revenue, and 8,000+ paying customers including Chegg, Groupon, Life360, and Mercury while serving 100,000+ open source projects. The platform tackles vibe coding quality challenges where 96% of developers use AI coding assistants like GitHub Copilot, ChatGPT, and Claude yet 63% of code reviews find AI-generated bugs creating critical need for new quality gates ensuring AI-written code meets production standards through automated contextual reviews analyzing security vulnerabilities, performance issues, best practice violations, and logical errors before human review. CodeRabbit delivers comprehensive features including AI-powered pull request analysis, automated code review comments, security vulnerability detection, performance optimization suggestions, best practice enforcement, multi-language support across 150+ programming languages, GitHub and GitLab marketplace integration, free tier in VS Code/Cursor/Windsurf IDEs providing instant inline feedback on committed and uncommitted changes, team collaboration tools, custom rules and policies, automated fix suggestions, and real-time notifications enabling developers to catch issues at earliest development stages. Available through free tier (individual developers with rate limits, community support), Team plans (starting at $19/month per user with higher rate limits), and Enterprise plans (custom pricing with dedicated support, SSO, on-premises options), with free IDE integration in VS Code, Cursor, and Windsurf launched May 2025 providing lightweight in-editor reviews catching bugs before comprehensive PR analysis, CodeRabbit delivers the definitive AI code review platform combining GitHub/GitLab marketplace #1 ranking with exceptional growth trajectory ($60M Series B, 30-40% monthly growth, $15M+ ARR), enterprise customer traction (8K+ paying including Fortune 500), and accessible free tier democratizing AI code quality assurance for individual developers and side projects while addressing critical quality gates needed as AI code generation becomes ubiquitous across development workflows.",
  overview: "CodeRabbit revolutionizes code review by addressing the critical quality crisis emerging from widespread AI code generation adoption, where 96% of developers now use AI coding assistants yet 63% of code reviews still uncover AI-generated bugs requiring new quality gates to ensure AI-written code meets production standards. As the #1 ranked AI application on both GitHub and GitLab marketplaces, CodeRabbit provides automated contextual code reviews analyzing security vulnerabilities, performance bottlenecks, best practice violations, and logical errors across 150+ programming languages before human reviewers examine pull requests, dramatically reducing review cycles and catching issues that slip through traditional manual reviews. The company's exceptional momentum demonstrated through September 2025's $60 million Series B at $550 million valuation led by Scale Venture Partners with NVIDIA Venture Capital (NVentures) participation, bringing total funding to $88 million, validates market demand for AI-powered quality assurance as organizations struggle with quality challenges from AI code proliferation requiring systematic quality gates. With 30-40% monthly revenue growth, $15+ million annual recurring revenue, 8,000+ paying customers including enterprise clients like Chegg, Groupon, Life360, and Mercury, plus 100,000+ open source projects relying on CodeRabbit, the platform demonstrates product-market fit addressing genuine pain points in modern AI-assisted development workflows where speed of AI code generation must be balanced with quality assurance and security compliance. CodeRabbit's comprehensive capabilities include AI-powered pull request analysis providing detailed review comments, automated security vulnerability detection identifying potential exploits, performance optimization suggestions highlighting inefficient code patterns, best practice enforcement ensuring code adheres to organizational standards, multi-language support spanning 150+ programming languages and frameworks, GitHub and GitLab marketplace integration for seamless workflow adoption, and automated fix suggestions providing concrete remediation guidance developers can apply immediately. The May 2025 launch of free IDE integration in VS Code, Cursor, and Windsurf brings CodeRabbit's AI code reviews directly into editors providing instant inline feedback on both committed and uncommitted changes, catching bugs at earliest development stages before code reaches pull requests, creating lightweight in-editor review layer complementing comprehensive PR-level analysis. This free IDE tier enables individual developers and side projects to access CodeRabbit's quality assurance capabilities without subscription costs, democratizing AI code review while maintaining premium PR-level features for team and enterprise plans starting at $19/month per user with higher rate limits, dedicated support, custom rules, SSO integration, and on-premises deployment options for regulated industries. CodeRabbit's strategic positioning addresses fundamental shift in software development where AI code generation tools like GitHub Copilot, ChatGPT, and Claude enable unprecedented coding velocity creating corresponding need for AI-powered quality gates ensuring generated code meets security, performance, and best practice standards before production deployment. The platform serves as essential quality layer in modern development workflows where human reviewers focus on architectural decisions and business logic while CodeRabbit automatically identifies security vulnerabilities, performance issues, and code quality problems across massive PRs that would overwhelm traditional manual review processes. Available on GitHub and GitLab marketplaces as #1 ranked AI application, with free IDE integration in VS Code/Cursor/Windsurf (May 2025), Team plans ($19/month+ per user), and Enterprise plans (custom pricing), backed by $88 million total funding including $60M Series B at $550M valuation demonstrating exceptional 30-40% monthly growth, CodeRabbit represents the definitive AI code review platform addressing critical quality assurance needs in AI-assisted development era combining automated security/performance/quality analysis with accessible free tier and enterprise-grade features for organizations requiring SOC 2 compliance, SSO integration, and on-premises deployment.",
  website: "https://www.coderabbit.ai/",
  website_url: "https://www.coderabbit.ai/",
  launch_year: 2023,
  updated_2025: true,
  category: "code-review",
  pricing_model: "freemium",

  features: [
    "#1 ranked AI app on GitHub and GitLab Marketplace",
    "AI-powered pull request analysis and review",
    "Automated code review comments with context",
    "Security vulnerability detection and alerts",
    "Performance optimization suggestions",
    "Best practice enforcement across 150+ languages",
    "Multi-language support (150+ programming languages)",
    "Free IDE integration: VS Code, Cursor, Windsurf (May 2025)",
    "Instant inline feedback on committed/uncommitted changes",
    "Lightweight in-editor reviews before PR submission",
    "Automated fix suggestions with remediation guidance",
    "Custom rules and organizational policies",
    "Team collaboration tools and workflows",
    "GitHub and GitLab deep integration",
    "Real-time notifications and alerts",
    "SOC 2 compliance and enterprise security",
    "SSO integration for enterprise authentication",
    "On-premises deployment options"
  ],

  use_cases: [
    "AI-generated code quality assurance (addresses 63% bug rate)",
    "Security vulnerability detection before production",
    "Performance optimization in large codebases",
    "Best practice enforcement across development teams",
    "Open source project maintenance (100K+ projects)",
    "Enterprise code review automation (8K+ paying customers)",
    "In-editor bug detection with free VS Code/Cursor/Windsurf tier",
    "Multi-language polyglot project reviews (150+ languages)",
    "Compliance-driven code quality for regulated industries",
    "Rapid PR review cycles reducing bottlenecks",
    "Side project quality assurance with free IDE tier",
    "Team collaboration on code quality standards",
    "Automated security scanning in CI/CD pipelines",
    "Fortune 500 enterprise code review (Chegg, Groupon, Life360, Mercury)"
  ],

  integrations: [
    "GitHub (Marketplace #1 AI app)",
    "GitLab (Marketplace #1 AI app)",
    "VS Code (free tier IDE integration)",
    "Cursor (free tier IDE integration)",
    "Windsurf (free tier IDE integration)",
    "Git version control systems",
    "CI/CD pipelines",
    "SSO providers (enterprise)",
    "Slack and communication tools",
    "JIRA and project management",
    "150+ programming languages and frameworks",
    "On-premises infrastructure (enterprise)",
    "Pull request workflows",
    "Code review platforms"
  ],

  pricing: {
    model: "Freemium with Team and Enterprise tiers",
    free_tier: true,
    tiers: [
      {
        name: "Free (IDE)",
        price: "$0",
        billing: "Forever",
        target: "Individual developers and side projects",
        features: [
          "VS Code, Cursor, Windsurf integration",
          "Instant inline feedback in editor",
          "Committed and uncommitted change reviews",
          "Lightweight bug detection before PR",
          "Rate limits apply",
          "Community support",
          "150+ language support",
          "Basic security vulnerability detection"
        ]
      },
      {
        name: "Team",
        price: "From $19/user/month",
        billing: "Monthly or Annual",
        target: "Development teams and startups",
        recommended: true,
        features: [
          "Everything in Free",
          "Higher rate limits",
          "Full PR-level comprehensive reviews",
          "Advanced security vulnerability detection",
          "Performance optimization analysis",
          "Custom rules and policies",
          "Team collaboration tools",
          "Priority support",
          "GitHub/GitLab Marketplace integration",
          "Automated fix suggestions",
          "Real-time notifications"
        ]
      },
      {
        name: "Enterprise",
        price: "Custom",
        billing: "Annual contract",
        target: "Large organizations and regulated industries",
        features: [
          "Everything in Team",
          "SOC 2 compliance",
          "SSO integration (SAML, OAuth)",
          "On-premises deployment option",
          "Dedicated account management",
          "SLA guarantees",
          "Advanced security controls",
          "Audit logs and compliance reporting",
          "Custom integration support",
          "24/7 priority enterprise support",
          "Unlimited rate limits"
        ]
      }
    ]
  },

  differentiators: [
    "#1 ranked AI app on GitHub and GitLab Marketplace",
    "$60M Series B at $550M valuation (September 2025)",
    "30-40% monthly revenue growth",
    "$15+ million annual recurring revenue",
    "8,000+ paying customers (Chegg, Groupon, Life360, Mercury)",
    "100,000+ open source projects using CodeRabbit",
    "Free IDE tier: VS Code/Cursor/Windsurf (May 2025)",
    "Addresses vibe coding quality crisis (96% use AI assistants, 63% find bugs)",
    "150+ programming language support",
    "NVIDIA Venture Capital backing (NVentures)",
    "$88M total funding (Scale Venture Partners led)",
    "In-editor inline feedback before PR submission",
    "SOC 2 compliance and enterprise security"
  ],

  target_audience: "Development teams addressing AI-generated code quality issues (96% using AI assistants); open source maintainers serving 100K+ projects; enterprise organizations requiring SOC 2 compliance and SSO (8K+ customers including Fortune 500); individual developers and side projects leveraging free IDE tier (VS Code/Cursor/Windsurf); security-conscious teams detecting vulnerabilities automatically; polyglot projects across 150+ programming languages; regulated industries needing on-premises deployment; and fast-growing companies experiencing 30-40% monthly scaling requiring systematic code quality gates",

  recent_updates_2025: [
    "$60M Series B at $550M valuation (September 2025)",
    "Achieved 30-40% monthly revenue growth",
    "Reached $15+ million annual recurring revenue",
    "Grew to 8,000+ paying customers",
    "Free IDE integration launched: VS Code/Cursor/Windsurf (May 2025)",
    "NVIDIA Venture Capital (NVentures) investment",
    "Expanded to 150+ programming language support",
    "Enhanced security vulnerability detection",
    "Improved automated fix suggestions",
    "SOC 2 compliance certification",
    "On-premises deployment option (Enterprise)",
    "Advanced team collaboration features",
    "Real-time notification improvements",
    "Custom rules and policy engine enhancements"
  ],

  compliance: [
    "SOC 2 Type 2 compliance",
    "SSO integration (SAML, OAuth)",
    "On-premises deployment option",
    "Data encryption in transit and at rest",
    "Audit logs and compliance reporting",
    "GDPR compliance",
    "Enterprise-grade security controls",
    "Role-based access control (RBAC)"
  ],

  parent_company: "CodeRabbit",
  headquarters: "San Francisco, California, USA",

  growth_metrics: {
    series_b_funding: "$60M at $550M valuation (September 2025)",
    total_funding: "$88M",
    monthly_growth: "30-40%",
    arr: "$15+ million",
    paying_customers: "8,000+",
    open_source_projects: "100,000+",
    marketplace_ranking: "#1 AI app (GitHub and GitLab)"
  },

  market_context: {
    ai_assistant_adoption: "96% of developers use AI coding tools",
    bug_detection_rate: "63% of code reviews find AI-generated bugs",
    problem_addressed: "Vibe coding quality crisis requiring new quality gates",
    customers: ["Chegg", "Groupon", "Life360", "Mercury"]
  }
};

async function updateCodeRabbit() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  try {
    console.log('🔄 Updating CodeRabbit with Phase 6 comprehensive content...\n');

    await db
      .update(tools)
      .set({
        data: coderabbitData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'coderabbit'));

    console.log('✅ CodeRabbit updated successfully!\n');
    console.log('📊 Updated fields:');
    console.log('   - Company: CodeRabbit');
    console.log('   - Category: code-review');
    console.log('   - Features: 18 comprehensive features');
    console.log('   - Pricing: 3 tiers (Free IDE, Team $19+, Enterprise)');
    console.log('   - Use Cases: 14 specialized scenarios');
    console.log('   - Integrations: 14 platforms and tools');
    console.log('   - Series B: $60M at $550M valuation (Sep 2025)');
    console.log('   - Growth: 30-40% monthly, $15M+ ARR');
    console.log('   - Customers: 8K+ paying, 100K+ open source');
    console.log('   - Differentiators: 13 unique competitive advantages');
    console.log('   - 2025 Updates: 14 major enhancements');

  } catch (error) {
    console.error('❌ Error updating CodeRabbit:', error);
    throw error;
  }
}

updateCodeRabbit();
