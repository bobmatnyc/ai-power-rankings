import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Phase 4: Batch Update All Specialized Tools
 * Updates comprehensive content for 9 specialized AI coding tools
 */

const phase4Tools = {
  // Tool 1: CodeRabbit (already in separate file)
  // Tool 2: Snyk Code (already in separate file)

  // Tool 3: Sourcery - Code Quality & Refactoring
  sourcery: {
    id: "sourcery",
    name: "Sourcery",
    company: "Sourcery AI",
    tagline: "AI code quality and refactoring platform trusted by 300,000+ developers for automated code reviews",
    description: "Sourcery is an AI-powered code quality and refactoring platform trusted by 300,000+ developers at companies like HelloFresh, Cisco, Red Hat, and Motorola Solutions. The platform delivers instant, actionable code reviews across 30+ programming languages with deep, rules-based static analysis for Python, JavaScript, and TypeScript, plus general AI review capabilities that work language-agnostically. Sourcery integrates seamlessly with GitHub, GitLab, VS Code, and JetBrains IDEs to provide real-time bug detection, automatic refactoring suggestions with one-click application, pull request reviews with visual summaries and Review Guides that generate diagrams for complex changes. SOC 2 certified with zero code storage, optional zero-retention policies, and no customer code used for AI training, Sourcery addresses AI-development challenges like PR pileups and hidden security risks while helping teams move faster with feedback and reviews at every development step.",
    overview: "Sourcery revolutionizes code quality by combining AI-powered automation with deep static analysis to deliver instant, actionable feedback that improves code quality, catches bugs, and accelerates knowledge sharing across development teams. Trusted by over 300,000 developers and deployed at leading enterprises, Sourcery provides real-time code refactoring suggestions as you write, with one-click application of changes that simplify and improve code immediately. The platform's deep static analysis for Python, JavaScript, and TypeScript identifies potential bugs and security issues before they reach production, while its language-agnostic AI reviews work across 30+ programming languages for comprehensive coverage. Sourcery's Pull Request Reviews deliver detailed feedback with visual summaries and Review Guides that generate diagrams clarifying complex changes, while IDE integration (VS Code and JetBrains) catches issues pre-commit for faster feedback loops. With completely free open-source and public repository support, a $12/month Pro plan with enhanced metrics and team features, and custom Enterprise pricing with advanced analytics and dedicated support, Sourcery is the definitive AI code quality platform for modern development teams prioritizing security, speed, and maintainability.",
    website: "https://sourcery.ai/",
    website_url: "https://sourcery.ai/",
    launch_year: 2019,
    updated_2025: true,
    category: "code-review",
    subcategory: "Code Quality & Refactoring",
    pricing_model: "freemium",

    features: [
      "Real-time code refactoring suggestions as you write",
      "One-click application of code improvements",
      "Deep static analysis for Python, JavaScript, and TypeScript",
      "Language-agnostic AI reviews for 30+ programming languages",
      "Bug detection and security issue identification",
      "Pull request reviews with detailed feedback",
      "Review Guides with visual summaries and diagrams",
      "IDE integration for VS Code and JetBrains",
      "Pre-commit issue detection in development environment",
      "Team analytics and code quality metrics",
      "Custom policies and coding standards enforcement",
      "GitHub and GitLab integration",
      "Zero code storage with optional zero-retention",
      "No customer code used for AI training",
      "SOC 2 certified security",
      "Support for custom LLM endpoints"
    ],

    use_cases: [
      "Automated code quality improvement and refactoring",
      "Real-time bug detection during development",
      "Security vulnerability identification before production",
      "Pull request automation and review efficiency",
      "Code quality metrics and team analytics",
      "Coding standards enforcement across teams",
      "Knowledge sharing and developer onboarding",
      "AI-generated code review and validation",
      "Legacy code modernization and technical debt reduction",
      "Open-source project code quality maintenance"
    ],

    integrations: ["VS Code", "JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm)", "GitHub", "GitLab", "Custom LLM endpoints"],

    pricing: {
      free_tier: true,
      tiers: [
        { name: "Free", price: "$0", target: "Open-source and public repositories" },
        { name: "Pro", price: "$12/month", target: "Professional developers", recommended: true },
        { name: "Enterprise", price: "Custom", target: "Large organizations" }
      ]
    },

    differentiators: [
      "Trusted by 300,000+ developers at HelloFresh, Cisco, Red Hat, Motorola",
      "Deep static analysis for Python, JavaScript, TypeScript",
      "30+ programming languages supported",
      "Zero code storage and zero-retention options",
      "No customer code used for AI training",
      "SOC 2 certified security",
      "Free for open-source and public repositories",
      "Review Guides with visual diagrams",
      "One-click refactoring application",
      "Real-time IDE feedback"
    ],

    target_audience: "Software development teams prioritizing code quality; Python, JavaScript, and TypeScript developers; DevOps engineers; open-source project maintainers; enterprises requiring SOC 2 compliance; teams using AI code generation tools; and developers seeking automated refactoring and code review"
  },

  // Tool 4: Diffblue Cover - Test Generation
  "diffblue-cover": {
    id: "diffblue-cover",
    name: "Diffblue Cover",
    company: "Diffblue Ltd.",
    tagline: "AI-powered Java unit test generation 250x faster than manual testing using reinforcement learning",
    description: "Diffblue Cover is an AI-powered unit test generation and management solution for Java that uses reinforcement learning to create accurate, maintainable unit tests 250x faster than manual test writing. Unlike typical language models, Diffblue Cover employs AI reinforcement learning to write comprehensive, human-readable unit tests that test actual code behavior including edge cases and scenarios developers may not know to test. Capable of running autonomously to write tens of thousands of tests across entire applications, Diffblue Cover has achieved 59 million+ lines of code covered and saved 976 years of developer time for clients including Goldman Sachs, Cisco, and major enterprises. The platform includes Cover Optimize for speeding up test execution by running only relevant tests, Cover Reports for visualization and analytics of unit testing coverage, and integration with IntelliJ IDEA, GitHub, GitLab, Jenkins, Azure, and AWS CodeBuild. With pricing from free Community Edition (100 tests/week) to $30/month Developer Edition, $30,000/year Teams Edition, and custom Enterprise pricing, Diffblue Cover is the definitive AI test generation platform for Java development at any scale.",
    overview: "Diffblue Cover revolutionizes Java testing by applying AI reinforcement learning to autonomously generate comprehensive unit and regression tests that are 250x faster than manual test writing while achieving higher coverage and discovering edge cases developers might miss. Unlike generic AI code assistants, Diffblue Cover's specialized reinforcement learning approach creates tests that verify actual code behavior rather than just syntactic correctness, producing human-readable tests with meaningful assertions that can be maintained and evolved alongside the codebase. The platform's autonomous capabilities enable it to generate tens of thousands of tests across entire applications without human intervention, while Cover Optimize accelerates local and CI test execution by running only tests relevant to code changes, and Cover Reports provides comprehensive visualization and analytics pinpointing actionable insights to improve code quality and identify coverage risks. Diffblue Cover has demonstrated measurable impact at enterprise scale, covering 59 million+ lines of code, saving 976 years of developer time, and proving 4x faster than GitHub Copilot with 10x more tests generated. With seamless integration across IntelliJ IDEA, CI/CD pipelines (GitHub, GitLab, Jenkins, Azure, AWS CodeBuild), and support for Windows, macOS, and Linux, Diffblue Cover enables Java development teams to achieve comprehensive test coverage, accelerate development cycles, and improve code quality at unprecedented scale.",
    website: "https://www.diffblue.com/",
    website_url: "https://www.diffblue.com/",
    launch_year: 2016,
    updated_2025: true,
    category: "testing-tool",
    pricing_model: "freemium",

    features: [
      "AI reinforcement learning for accurate test generation",
      "Generate unit tests 250x faster than manual writing",
      "Autonomous test generation across entire applications",
      "Comprehensive edge case and scenario coverage",
      "Human-readable, maintainable test code",
      "Cover Optimize: Run only relevant tests (faster CI/CD)",
      "Cover Reports: Visualization and analytics dashboards",
      "IntelliJ IDEA IDE integration",
      "CI/CD pipeline integration (GitHub, GitLab, Jenkins, Azure, AWS)",
      "Support for Java 8, 11, 17, and .NET Framework to .NET Core",
      "Automated regression test generation",
      "Test coverage analysis and risk identification",
      "Methods Under Test (MUTs) consumption tracking",
      "Cross-platform support (Windows, macOS, Linux)",
      "Enterprise-grade security and compliance"
    ],

    use_cases: [
      "Java unit test generation and automation",
      "Legacy codebase testing and modernization",
      "Regression test creation for refactoring",
      "Accelerating test coverage for compliance",
      "CI/CD test optimization and speedup",
      "Enterprise Java application testing at scale",
      "Developer productivity improvement",
      "Code quality and coverage analytics",
      "Automated test maintenance alongside code changes",
      "Reducing manual testing technical debt"
    ],

    integrations: ["IntelliJ IDEA", "GitHub", "GitLab", "Jenkins", "Azure DevOps", "AWS CodeBuild", "CI/CD pipelines"],

    pricing: {
      free_tier: true,
      tiers: [
        { name: "Community", price: "$0", target: "Small projects (100 tests/week)" },
        { name: "Developer", price: "$30/month", target: "Individual developers (100 tests/month + extras)", recommended: true },
        { name: "Teams", price: "$30,000/year", target: "Development teams with CI integration" },
        { name: "Enterprise", price: "Custom", target: "Large organizations requiring customization" }
      ]
    },

    differentiators: [
      "250x faster than manual test writing",
      "4x faster than GitHub Copilot with 10x more tests",
      "AI reinforcement learning (not LLM-based)",
      "59M+ lines of code covered",
      "976 years of developer time saved",
      "Tests actual behavior, not just syntax",
      "Comprehensive edge case discovery",
      "Autonomous test generation at scale",
      "Trusted by Goldman Sachs, Cisco, enterprises",
      "Methods Under Test (MUTs) consumption model"
    ],

    target_audience: "Java development teams; enterprise software engineers; QA automation engineers; DevOps teams; legacy codebase maintainers; teams requiring high test coverage for compliance; software architects; and organizations seeking to reduce testing technical debt"
  },

  // Tool 5: Qodo Gen (formerly Codium AI) - Test Generation & Quality
  "qodo-gen": {
    id: "qodo-gen",
    name: "Qodo Gen",
    company: "Qodo (formerly Codium AI)",
    tagline: "Quality-first AI coding platform with autonomous agents for code generation, testing, and review",
    description: "Qodo Gen (formerly Codium AI) is a quality-first AI coding platform that provides autonomous agents for code generation, comprehensive test workflows, and AI chat assistance to help developers write quality code that works as intended with fewer bugs. Backed by $40M Series A funding (September 2024) and available across VS Code, JetBrains IDEs, WebStorm, IntelliJ, and CLion, Qodo Gen supports major programming languages including Python, TypeScript, JavaScript, Java, Kotlin, Go, PHP, C/C++, and Swift. The platform's specialized agents include code generation with multi-step problem solving, test suite generation analyzing happy paths, edge cases, and rare scenarios tailored to project style and frameworks, and context collection understanding project-specific requirements while integrating version history. With pricing from free Developer tier to $19/user/month Teams tier and custom Enterprise pricing, Qodo Gen delivers quality-guardrails that ensure code works as intended while supporting seamless model switching between top-tier AI providers and providing threaded conversations for iterative development.",
    overview: "Qodo Gen revolutionizes quality-first code development by providing autonomous AI agents that focus not just on code generation but on ensuring code works as intended with comprehensive testing, context awareness, and quality guardrails. Unlike generic coding assistants that prioritize speed over correctness, Qodo Gen's specialized agents analyze code behavior to generate test suites covering happy paths, edge cases, and rare scenarios while tailoring tests to match existing project style and frameworks for seamless integration. The platform's context collection agent understands project-specific requirements, integrates version history, and maintains awareness of codebase structure to deliver suggestions that align with existing patterns and architectural decisions. Qodo Gen's coding agent supports autonomous multi-step problem solving with commands like /explain, /improve, /test, /ask, and /enhance, enabling developers to iteratively refine code quality through conversational AI interactions. Backed by $40M Series A funding to bring quality-first code generation to enterprises, Qodo Gen provides free access for individual developers with repository context chat, multiple model options, code review, test generation, documentation, and coding best practices, while Teams ($19/user/month) adds bug detection, PR automation, repository best practices learning, enhanced privacy, and standard support. With support for Python, TypeScript, JavaScript, Java, Kotlin, Go, PHP, C/C++, and Swift across VS Code, JetBrains, WebStorm, IntelliJ, and CLion, Qodo Gen is the definitive quality-first AI platform for developers prioritizing correctness, maintainability, and comprehensive test coverage.",
    website: "https://www.qodo.ai/products/qodo-gen/",
    website_url: "https://www.qodo.ai/products/qodo-gen/",
    launch_year: 2023,
    updated_2025: true,
    category: "testing-tool",
    pricing_model: "freemium",

    features: [
      "Autonomous coding agent with multi-step problem solving",
      "Quality-guardrails ensuring code works as intended",
      "Test suite generation analyzing happy paths, edge cases, rare scenarios",
      "Context collection agent understanding project specifics",
      "Version history integration for context-aware suggestions",
      "Test customization matching project style and frameworks",
      "Conversational AI commands (/explain, /improve, /test, /ask, /enhance)",
      "Support for Python, TypeScript, JavaScript, Java, Kotlin, Go, PHP, C/C++, Swift",
      "IDE integration: VS Code, JetBrains, WebStorm, IntelliJ, CLion",
      "Repository context chat for codebase understanding",
      "Multiple AI model options with seamless switching",
      "Bug detection and code quality analysis",
      "PR automation and repository best practices learning",
      "Threaded conversation for iterative development",
      "Enhanced privacy controls for teams"
    ],

    use_cases: [
      "Quality-first code generation with comprehensive testing",
      "Automated test suite creation for new features",
      "Bug detection and code quality improvement",
      "Pull request automation and review",
      "Repository-specific best practices enforcement",
      "Context-aware code suggestions aligned with architecture",
      "Developer onboarding with AI-guided code understanding",
      "Legacy code testing and documentation",
      "Iterative code refinement through conversational AI",
      "Enterprise code quality assurance"
    ],

    integrations: ["VS Code", "JetBrains IDEs", "WebStorm", "IntelliJ IDEA", "CLion", "PyCharm", "GitHub", "GitLab"],

    pricing: {
      free_tier: true,
      tiers: [
        { name: "Developer (Free)", price: "$0", target: "Individual developers and students" },
        { name: "Teams", price: "$19/user/month", target: "Professional development teams", recommended: true },
        { name: "Enterprise", price: "Custom", target: "Large organizations" }
      ]
    },

    differentiators: [
      "Quality-first approach prioritizing correctness over speed",
      "$40M Series A funding for enterprise expansion",
      "Autonomous agents for code, testing, and context",
      "Test generation covering happy paths, edge cases, rare scenarios",
      "Context-aware suggestions aligned with project architecture",
      "Version history integration for better understanding",
      "Threaded conversations for iterative development",
      "Multiple AI model support with seamless switching",
      "Repository best practices learning",
      "Enhanced privacy controls for teams"
    ],

    target_audience: "Software developers prioritizing code quality; QA engineers; testing automation specialists; development teams requiring comprehensive test coverage; enterprises seeking quality-first AI coding tools; and developers working with Python, TypeScript, JavaScript, Java, Kotlin, Go, PHP, C/C++, or Swift"
  },

  // Tool 6: GitLab Duo - DevOps Platform AI
  "gitlab-duo": {
    id: "gitlab-duo",
    name: "GitLab Duo",
    company: "GitLab Inc.",
    tagline: "AI-powered DevSecOps platform integrated across the entire software development lifecycle",
    description: "GitLab Duo is an AI-powered DevSecOps platform that provides comprehensive AI assistance across the entire software development lifecycle, from coding and security to search, troubleshooting, and measurement. With GitLab 18.0 (2025), Premium and Ultimate customers receive Duo Chat and Code Suggestions features included at no additional cost with soft limits (2,000 code suggestions, 100 chat requests), while Duo Pro ($19/user/month) and Duo Enterprise ($39/user/month) add-ons provide advanced AI capabilities including vulnerability explanation and automated resolution, root cause log analysis for CI/CD bottlenecks, discussion and merge request summarization tools, and impact tracking dashboards. GitLab Duo features a specialized Agent Platform with AI agents for different development roles, transparent AI with user-controlled permissions, support for multiple language models, and a privacy-first approach with organizational AI controls. Available for Premium and Ultimate customers with flexible deployment options and seamless integration throughout the software development lifecycle, GitLab Duo is the definitive AI DevSecOps platform for enterprise development teams.",
    overview: "GitLab Duo revolutionizes DevSecOps by embedding AI-powered assistance throughout the complete software development lifecycle, providing context-aware support for coding, security analysis, troubleshooting, and team collaboration within a single integrated platform. With GitLab 18.0, the platform has democratized AI access by including Duo Chat and Code Suggestions in Premium and Ultimate tiers at no additional cost, dramatically lowering barriers to AI-assisted development while maintaining transparent usage limits (2,000 code suggestions and 100 chat requests) that can be expanded with paid add-ons. GitLab Duo Pro ($19/user/month) delivers advanced features including code suggestions in over 20 languages, security vulnerability understanding and remediation, conversational AI chat processing text and code, and automated test generation that catches bugs early, while Duo Enterprise ($39/user/month) adds exclusive capabilities like vulnerability explanation with automated resolution tools, root cause log analysis for CI/CD failures and bottlenecks, discussion and merge request summarization with templating, and dashboards tracking AI's impact on DevOps workflows. The platform's Agent Platform provides specialized AI agents tailored for different development roles, ensuring relevant assistance whether you're writing code, reviewing security, or managing deployments, all while maintaining transparent AI with user-controlled permissions and privacy-first architecture that gives organizations control over AI usage and data. Seamlessly integrated with GitLab's complete DevOps platform including version control, CI/CD, security scanning, and project management, GitLab Duo enables enterprise teams to accelerate development velocity, improve code quality, proactively detect and fix vulnerabilities, and enhance collaboration while maintaining security and compliance requirements.",
    website: "https://about.gitlab.com/gitlab-duo/",
    website_url: "https://about.gitlab.com/gitlab-duo/",
    launch_year: 2024,
    updated_2025: true,
    category: "other",
    subcategory: "DevOps Platform AI",
    pricing_model: "freemium",

    features: [
      "AI Chat and Code Suggestions included in Premium/Ultimate (soft limits: 2,000 suggestions, 100 chats)",
      "Code suggestions in 20+ programming languages",
      "Security vulnerability understanding and remediation",
      "Conversational AI processing text and code",
      "Automated test generation catching bugs early",
      "Vulnerability explanation with automated resolution (Enterprise)",
      "Root cause log analysis for CI/CD bottlenecks (Enterprise)",
      "Discussion and merge request summarization (Enterprise)",
      "AI impact tracking dashboards (Enterprise)",
      "Agent Platform with role-specific AI agents",
      "Transparent AI with user-controlled permissions",
      "Multiple language model support",
      "Privacy-first organizational AI controls",
      "Seamless integration across DevOps lifecycle"
    ],

    use_cases: [
      "AI-assisted code development in 20+ languages",
      "Security vulnerability detection and automated remediation",
      "CI/CD troubleshooting with root cause analysis",
      "Automated test generation and quality assurance",
      "Merge request and code review automation",
      "Discussion summarization for team collaboration",
      "DevOps workflow efficiency measurement",
      "Enterprise DevSecOps transformation",
      "Compliance-driven security scanning",
      "Team productivity tracking with AI impact dashboards"
    ],

    integrations: ["GitLab (version control, CI/CD, security, project management)", "20+ programming languages", "Multiple AI language models", "Cloud platforms", "Container registries"],

    pricing: {
      included_with_premium: true,
      tiers: [
        { name: "Premium/Ultimate (Included)", price: "$0 add-on", target: "Soft limits: 2,000 code suggestions, 100 chats" },
        { name: "Duo Pro", price: "$19/user/month", target: "Advanced AI features", recommended: true },
        { name: "Duo Enterprise", price: "$39/user/month", target: "Vulnerability resolution, log analysis, dashboards" }
      ]
    },

    differentiators: [
      "Included with Premium/Ultimate tiers (no add-on cost for basic features)",
      "Integrated across complete DevOps lifecycle",
      "Agent Platform with role-specific AI agents",
      "Automated vulnerability resolution (Enterprise)",
      "Root cause log analysis for CI/CD (Enterprise)",
      "AI impact tracking dashboards",
      "Privacy-first with organizational controls",
      "Multiple language model support",
      "Transparent user-controlled permissions",
      "Seamless GitLab platform integration"
    ],

    target_audience: "DevOps and DevSecOps teams; GitLab Premium/Ultimate customers; enterprise software development organizations; security-conscious development teams; CI/CD engineers; project managers; and teams seeking integrated AI across the complete software development lifecycle"
  },

  // Tool 7: Graphite - Code Review Workflow
  "graphite": {
    id: "graphite",
    name: "Graphite",
    company: "Graphite Inc.",
    tagline: "AI-powered code review platform with stacked PRs workflow for 4x faster merges and 3x more bugs caught",
    description: "Graphite is an AI-powered code review platform that accelerates developer productivity by combining intelligent stacked PRs workflow with Graphite Agent (formerly Diamond) - an AI assistant providing instant feedback, suggestions, and fixes applied directly in diffs with conversational follow-up for end-to-end review-to-commit experience. Backed by $81 million in venture capital from Anthropic, Accel, and Andreessen Horowitz, Graphite achieves sub-3% false-positive rates across tens of thousands of code changes while reducing pull request feedback loops from over an hour to just 90 seconds. The platform's stacking workflow allows developers to keep shipping while other changes are under review with effortless CLI and VS Code extension management, while the unified inbox and review workflow integrates CLI, PR page, inbox, and merge queue into one seamless experience. Trusted by engineering teams at Semgrep, Shopify, Ramp, Asana, and Tecton, Graphite delivers critical bug detection, security vulnerability identification, code quality enforcement with customizable rules, and intelligent CI optimization - all available with a 30-day free trial (no credit card required) and Team plan at $40/month including unlimited AI reviews and chat.",
    overview: "Graphite revolutionizes code review by combining AI-powered automation with an innovative stacked PRs workflow that transforms review from a potential bottleneck into an accelerator of developer productivity, enabling teams to ship higher quality code 4x faster while catching 3x more bugs. The platform's Graphite Agent delivers instant context-aware feedback with suggested fixes applied directly in diffs, plus conversational AI chat allowing developers to iterate on suggestions and apply changes through natural language interaction - creating an end-to-end experience that goes from feedback to commit in a single conversation without context switching. Graphite's stacking workflow solves the fundamental problem of review bottlenecks by allowing developers to break larger changes into smaller, sequenced commits that can be reviewed independently while continuing to ship new features, with the CLI and VS Code extension making stack creation and management effortless through automatic rebasing and dependency tracking. The unified workflow integrates CLI, PR page, inbox, and merge queue into one seamless experience with actionable Slack notifications and intelligent CI optimization, while Graphite Agent's sub-3% false-positive rate across tens of thousands of reviewed changes ensures high signal-to-noise ratio that builds developer trust rather than creating alert fatigue. With critical bug detection, security vulnerability identification, customizable coding standards enforcement, and reduction of PR feedback loops from over an hour to 90 seconds, Graphite has attracted $81 million in backing from Anthropic, Accel, and Andreessen Horowitz while earning trust from engineering teams at leading companies. Available with 30-day free trial (no credit card required) and Team plan at $40/month with unlimited AI reviews and chat, Graphite is the definitive platform for engineering teams seeking to transform code review from blocker to accelerator.",
    website: "https://graphite.dev/",
    website_url: "https://graphite.dev/",
    launch_year: 2021,
    updated_2025: true,
    category: "code-review",
    pricing_model: "freemium",

    features: [
      "Graphite Agent: AI-powered code review with instant feedback and fixes",
      "Conversational AI chat for iterative suggestion refinement",
      "Fixes applied directly in diffs with one-click acceptance",
      "Stacked PRs workflow for parallel development",
      "90-second PR feedback loops (down from 60+ minutes)",
      "Sub-3% false-positive rate across tens of thousands of changes",
      "Critical bug detection and security vulnerability identification",
      "Customizable coding standards and rule enforcement",
      "CLI and VS Code extension for stack management",
      "Automatic rebasing and dependency tracking",
      "Unified inbox for team PRs",
      "Merge queue with intelligent CI optimization",
      "Actionable Slack notifications",
      "End-to-end review-to-commit workflow",
      "30-day free trial with no credit card required"
    ],

    use_cases: [
      "Accelerating PR review cycles from hours to minutes",
      "Stacked PRs for large feature development",
      "Continuous shipping while changes are under review",
      "Bug detection and security vulnerability prevention",
      "Coding standards enforcement across teams",
      "Reducing context switching during code review",
      "CI/CD optimization and merge queue management",
      "Team collaboration with unified inbox",
      "Developer productivity improvement with AI assistance",
      "High-quality code review at scale"
    ],

    integrations: ["GitHub", "VS Code", "CLI", "Slack", "CI/CD pipelines"],

    pricing: {
      free_trial: true,
      trial_duration: "30 days (no credit card required)",
      tiers: [
        { name: "Team", price: "$40/month", target: "Most popular - unlimited AI reviews and chat", recommended: true },
        { name: "Annual", price: "$25/seat/month", target: "3-seat minimum, annual billing" }
      ]
    },

    differentiators: [
      "4x faster merge times with 3x more bugs caught",
      "90-second PR feedback loops (down from 60+ minutes)",
      "Sub-3% false-positive rate (highest accuracy)",
      "$81M funding from Anthropic, Accel, Andreessen Horowitz",
      "Stacked PRs workflow for parallel development",
      "Conversational AI for review-to-commit in one flow",
      "Fixes applied directly in diffs",
      "Trusted by Semgrep, Shopify, Ramp, Asana, Tecton",
      "Unified CLI, PR page, inbox, merge queue",
      "30-day free trial with no credit card"
    ],

    target_audience: "Engineering teams seeking to accelerate code review; developers frustrated by review bottlenecks; teams at Semgrep, Shopify, Ramp, Asana, Tecton scale; organizations requiring high code quality with fast iteration; and development teams prioritizing developer productivity and experience"
  },

  // Tool 8: Greptile - Codebase Understanding & Search
  "greptile": {
    id: "greptile",
    name: "Greptile",
    company: "Greptile Inc.",
    tagline: "AI codebase expert that generates detailed code graphs for 4x faster merges and 3x more bugs caught",
    description: "Greptile is an AI platform that generates detailed graphs of your codebase to understand how everything fits together, enabling AI to search and understand large codebases in natural language across 30+ programming languages. The platform delivers AI code reviews that learn your codebase and apply repository context to analyze pull requests, catching syntax, logic, and style issues while suggesting fixes - helping companies merge PRs 4x faster on average while catching 3x more bugs. Greptile's AI-powered API supports search across multiple branches of multiple repos simultaneously, infers new rules and idiosyncrasies about your team and codebase from comments, replies, and reactions, and can auto-generate context-aware commit messages, update documentation based on code changes, and serve as a knowledge base by integrating with tools like Quip and Google Docs. SOC2 Type II compliant with options for cloud deployment or 100% self-hosted air-gapped VPC, Greptile offers a 14-day free trial (no credit card required) with flexible pricing at $30/developer/month for code reviews, fixed monthly subscription for chat, and per-request API pricing. Currently raising Series A at $180M valuation with Benchmark likely leading, Greptile is backed by Y Combinator and offers discounts for open-source projects and pre-Series A startups.",
    overview: "Greptile revolutionizes codebase understanding by generating comprehensive code graphs that map relationships, dependencies, and architecture across entire repositories, enabling AI to deliver context-aware code reviews, natural language search, and intelligent automation that understands not just individual files but how everything fits together. The platform's AI code review capabilities learn your codebase's unique patterns, apply full repository context to analyze pull requests with precision, and catch syntax, logic, and style issues while suggesting fixes that align with your team's coding standards - delivering results that help companies merge PRs 4x faster on average while catching 3x more bugs compared to manual review processes. Greptile's continuous learning system infers new rules and idiosyncrasies about your team and codebase from your interactions including comments, replies, and 👍/👎 reactions, adapting its suggestions over time to match your evolving standards and preferences without requiring manual configuration. The platform's AI-powered API enables natural language search across large codebases supporting 30+ programming languages with regular updates on every commit, allowing developers to search multiple branches of multiple repos simultaneously while maintaining up-to-date understanding of code changes. Beyond code review, Greptile auto-generates context-aware commit messages that accurately describe changes, updates documentation automatically based on code modifications, and serves as an intelligent knowledge base by integrating with documentation tools like Quip and Google Docs. SOC2 Type II compliant with flexible deployment options including cloud SaaS or 100% self-hosted in air-gapped VPC for maximum security, Greptile offers 14-day free trial with no credit card required, pricing at $30/developer/month for code reviews plus fixed monthly chat subscription and per-request API pricing, with discounts available for open-source projects and pre-Series A startups. Currently in talks to raise Series A at $180M valuation with Benchmark likely leading, Greptile is a Y Combinator-backed platform trusted by development teams seeking to accelerate code understanding, improve review quality, and automate documentation workflows.",
    website: "https://www.greptile.com/",
    website_url: "https://www.greptile.com/",
    launch_year: 2023,
    updated_2025: true,
    category: "other",
    subcategory: "Codebase Understanding & AI Search",
    pricing_model: "subscription",

    features: [
      "Detailed codebase graph generation understanding relationships and dependencies",
      "AI code review with full repository context",
      "4x faster PR merges with 3x more bugs caught",
      "Natural language codebase search across 30+ languages",
      "Search multiple branches and repos simultaneously",
      "Continuous learning from team interactions (comments, reactions)",
      "Auto-generated context-aware commit messages",
      "Automatic documentation updates based on code changes",
      "Knowledge base integration (Quip, Google Docs)",
      "Sequence diagrams and file-by-file PR breakdowns",
      "Confidence scores for every PR review",
      "Regular updates on every commit",
      "SOC2 Type II compliance",
      "Cloud or self-hosted air-gapped VPC deployment",
      "API for programmatic access"
    ],

    use_cases: [
      "AI-powered code review with repository context",
      "Natural language codebase search and exploration",
      "Accelerated PR review and merge processes",
      "Automated commit message generation",
      "Documentation automation and synchronization",
      "Codebase onboarding for new developers",
      "Multi-repository search and analysis",
      "Knowledge base for code understanding",
      "Style and logic issue detection",
      "Enterprise codebase intelligence"
    ],

    integrations: ["GitHub", "GitLab", "Quip", "Google Docs", "30+ programming languages", "API for custom integrations"],

    pricing: {
      free_trial: true,
      trial_duration: "14 days (no credit card required)",
      model: "$30/developer/month (code reviews) + fixed chat subscription + per-request API",
      discounts: "Available for open-source projects and pre-Series A startups"
    },

    differentiators: [
      "4x faster PR merges with 3x more bugs caught",
      "Detailed codebase graph understanding relationships",
      "Continuous learning from team interactions",
      "Natural language search across 30+ languages",
      "Multi-branch and multi-repo search",
      "Auto-generated commit messages and documentation",
      "SOC2 Type II compliant",
      "100% self-hosted air-gapped VPC option",
      "$180M Series A valuation (Benchmark leading)",
      "Y Combinator-backed",
      "Discounts for open-source and startups"
    ],

    target_audience: "Software development teams seeking codebase intelligence; engineering managers; developers onboarding to large codebases; teams requiring SOC2 compliance; organizations needing self-hosted security; open-source project maintainers; pre-Series A startups; and enterprises requiring multi-repository search and analysis"
  },

  // Tool 9: Cerebras Code - High-Performance Code Generation
  "cerebras-code": {
    id: "cerebras-code",
    name: "Cerebras Code",
    company: "Cerebras Systems",
    tagline: "Instant code generation at 2,000 tokens/sec - 30x faster and 1/10th cost of closed-source alternatives",
    description: "Cerebras Code delivers production-grade code generation at 2,000 tokens per second using Alibaba's Qwen3-Coder 480B Instruct model - achieving coding ability rivaling Claude 4 Sonnet and Gemini 2.5 while running 30x faster at 1/10th the cost of closed-source alternatives. Powered by the Wafer-Scale Engine (WSE-3) with 900,000 AI cores and 44GB of on-chip SRAM where all model weights live on-chip to eliminate memory bottlenecks entirely, Cerebras Code enables developers to generate 1,000 lines of JavaScript in just 4 seconds versus 30 seconds on Gemini 2.5 Flash or 80 seconds on Claude 4 Sonnet. With 131K-token context window (quadrupled from 32K) allowing processing of dozens of files and tens of thousands of lines simultaneously for production-grade application development, Cerebras Code supports IDE-agnostic integration with OpenAI-compatible inference endpoints including Cursor, Continue.dev, Cline, and RooCode. Available with two monthly subscription plans at $50 (Cerebras Code Pro: 24M tokens/day for indie developers) and $200 (Cerebras Code Max: 120M tokens/day for full-time development and multi-agent systems) with no weekly usage limits, Cerebras Code is the definitive high-performance AI code generation platform for developers seeking instant, production-grade code that keeps them in flow.",
    overview: "Cerebras Code revolutionizes code generation performance by leveraging purpose-built AI hardware architecture that achieves 2,000 tokens per second - delivering instant code generation that feels real-time compared to the noticeable latency of cloud-based alternatives. Powered by Alibaba's Qwen3-Coder 480B Instruct model with coding ability rivaling Claude 4 Sonnet and Gemini 2.5, Cerebras Code demonstrates leading performance on coding benchmarks including Agentic Coding, Browser-Use, and BFCL while supporting multi-step edits, tool use, retries, and planning for production-grade development workflows. The platform's breakthrough performance comes from the Wafer-Scale Engine (WSE-3) - an entire silicon wafer functioning as a single chip with 900,000 AI cores and 44GB of on-chip SRAM where all model weights live permanently, eliminating the memory bottlenecks that plague traditional GPU-based inference and enabling sustained throughput of 2,000 tokens/second. This translates to generating 1,000 lines of JavaScript in just 4 seconds (versus 30 seconds on Gemini 2.5 Flash or 80 seconds on Claude 4 Sonnet), maintaining developer flow by minimizing the cognitive cost of waiting for AI-generated code. Cerebras Code's 131K-token context window (quadrupled from 32K in 2025) allows processing dozens of files and tens of thousands of lines of code simultaneously, enabling production-grade full-application development rather than just single-file completions. The platform's IDE-agnostic approach via OpenAI-compatible inference endpoints means developers can plug Cerebras Code into any editor supporting OpenAI APIs including Cursor, Continue.dev, Cline, and RooCode without proprietary lock-in. Available with Cerebras Code Pro ($50/month: 24M tokens/day for indie developers and weekend projects) and Cerebras Code Max ($200/month: 120M tokens/day for full-time development and multi-agent systems) with no weekly usage limits, Cerebras Code delivers 30x faster performance at 1/10th the cost of closed-source alternatives, making it the definitive choice for developers and teams prioritizing instant code generation that maintains flow.",
    website: "https://www.cerebras.ai/",
    website_url: "https://www.cerebras.ai/",
    launch_year: 2025,
    updated_2025: true,
    category: "code-assistant",
    pricing_model: "subscription",

    features: [
      "2,000 tokens/second code generation (instant feel)",
      "Qwen3-Coder 480B Instruct model (rivals Claude 4 Sonnet, Gemini 2.5)",
      "131K-token context window (process dozens of files simultaneously)",
      "Wafer-Scale Engine (WSE-3): 900,000 AI cores, 44GB on-chip SRAM",
      "All model weights on-chip (zero memory bottlenecks)",
      "Multi-step edits, tool use, retries, and planning",
      "Leading performance on Agentic Coding, Browser-Use, BFCL benchmarks",
      "IDE-agnostic via OpenAI-compatible inference endpoints",
      "Support for Cursor, Continue.dev, Cline, RooCode",
      "No proprietary IDE lock-in",
      "No weekly usage limits",
      "30x faster than closed-source alternatives",
      "1/10th cost of closed-source alternatives",
      "Production-grade application development"
    ],

    use_cases: [
      "Instant code generation maintaining developer flow",
      "Full-stack application development with high context",
      "Multi-agent systems requiring high-speed inference",
      "Production-grade code generation at scale",
      "Indie developer projects and weekend coding",
      "Full-time professional development workflows",
      "Agentic coding with tool use and planning",
      "Browser automation and multi-step edits",
      "Large codebase refactoring and modernization",
      "Performance-critical AI-assisted development"
    ],

    integrations: ["Cursor", "Continue.dev", "Cline", "RooCode", "OpenAI-compatible inference endpoints", "Any IDE supporting OpenAI APIs"],

    pricing: {
      tiers: [
        { name: "Cerebras Code Pro", price: "$50/month", target: "24M tokens/day - Indie developers and weekend projects", recommended: true },
        { name: "Cerebras Code Max", price: "$200/month", target: "120M tokens/day - Full-time development and multi-agent systems" }
      ],
      no_usage_limits: true
    },

    differentiators: [
      "2,000 tokens/second (instant code generation)",
      "30x faster than closed-source alternatives",
      "1/10th cost of closed-source alternatives",
      "1,000 lines JavaScript in 4 sec (vs 30 sec Gemini, 80 sec Claude)",
      "Wafer-Scale Engine: 900,000 AI cores, 44GB on-chip SRAM",
      "All model weights on-chip (zero memory bottlenecks)",
      "131K-token context window (4x expansion in 2025)",
      "IDE-agnostic (no proprietary lock-in)",
      "No weekly usage limits",
      "Leading Agentic Coding and Browser-Use benchmarks",
      "Production-grade multi-step edits and planning"
    ],

    target_audience: "Professional developers prioritizing performance and flow; indie developers and weekend coders seeking affordable high-speed AI; teams building multi-agent systems; full-stack developers requiring high-context code generation; performance-critical development workflows; and developers frustrated by latency in cloud-based AI coding tools"
  }
};

async function updateAllPhase4Tools() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    return;
  }

  const toolsToUpdate = Object.entries(phase4Tools);
  console.log(`\n🚀 Phase 4: Updating ${toolsToUpdate.length} specialized AI coding tools\n`);
  console.log('═'.repeat(80));

  let successCount = 0;
  let failureCount = 0;

  for (const [slug, data] of toolsToUpdate) {
    try {
      console.log(`\n📝 Updating: ${data.name} (${slug})`);
      console.log('─'.repeat(80));

      await db
        .update(tools)
        .set({
          data: data,
          updatedAt: new Date()
        })
        .where(eq(tools.slug, slug));

      console.log(`✅ ${data.name} updated successfully!`);
      console.log(`   Category: ${data.category}`);
      console.log(`   Pricing: ${data.pricing?.tiers?.[0]?.name || 'Multiple tiers'}`);
      console.log(`   Features: ${data.features?.length || 0}`);
      console.log(`   Differentiators: ${data.differentiators?.length || 0}`);

      successCount++;
    } catch (error) {
      console.error(`❌ Error updating ${data.name}:`, error);
      failureCount++;
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`\n📊 Phase 4 Update Summary:`);
  console.log(`   ✅ Successfully updated: ${successCount}/${toolsToUpdate.length}`);
  if (failureCount > 0) {
    console.log(`   ❌ Failed: ${failureCount}/${toolsToUpdate.length}`);
  }
  console.log('\n🎉 Phase 4 specialized tools update complete!\n');
}

updateAllPhase4Tools();
