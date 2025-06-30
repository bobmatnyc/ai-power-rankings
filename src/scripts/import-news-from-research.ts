#!/usr/bin/env tsx
/**
 * Import News from Research Data
 * Extracts and imports news articles from the missing-data-research.md file
 */

import { getNewsRepo } from "../lib/json-db";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  published_date: string;
  source?: string;
  source_url?: string;
  tags: string[];
  tool_mentions: string[];
  created_at: string;
  updated_at: string;
}

function generateId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substring(2, 10);
  const random2 = Math.random().toString(16).substring(2, 10);
  return `${timestamp}-${random}-${random2}`;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

// Convert research entries to news articles
function createNewsArticles(): NewsArticle[] {
  const now = new Date().toISOString();
  const articles: NewsArticle[] = [];

  // Launch announcements
  const launches = [
    {
      tool: "Amazon Q Developer",
      date: "2023-11-28",
      title: "Amazon Q Developer Launches in Preview at AWS re:Invent",
      content:
        "Amazon Web Services unveiled Amazon Q Developer at re:Invent 2023, introducing an AI-powered coding assistant designed to help developers with code generation, debugging, and AWS-specific tasks.",
      source: "AWS Official Announcements",
      tags: ["launch", "enterprise", "ai-assistant"],
    },
    {
      tool: "Amazon Q Developer",
      date: "2024-04-30",
      title: "Amazon Q Developer Reaches General Availability",
      content:
        "Amazon Q Developer transitions from preview to general availability, offering enterprise-grade AI coding assistance with full AWS integration and security features.",
      source: "AWS Blog",
      tags: ["launch", "enterprise", "general-availability"],
    },
    {
      tool: "JetBrains AI Assistant",
      date: "2023-07-01",
      title: "JetBrains Introduces AI Assistant in 2023.2 EAP",
      content:
        "JetBrains launches AI Assistant in Early Access Program for version 2023.2, bringing AI-powered code completion and generation to its entire IDE ecosystem.",
      source: "JetBrains Blog",
      tags: ["launch", "ide", "early-access"],
    },
    {
      tool: "JetBrains AI Assistant",
      date: "2023-12-01",
      title: "JetBrains AI Assistant Reaches General Availability",
      content:
        "JetBrains AI Assistant becomes generally available with the 2023.3 release, supporting over 20 programming languages across all JetBrains IDEs.",
      source: "JetBrains Blog, InfoQ",
      tags: ["launch", "ide", "general-availability"],
    },
    {
      tool: "Microsoft IntelliCode",
      date: "2018-05-07",
      title: "Microsoft Announces IntelliCode at Build 2018",
      content:
        "Microsoft introduces IntelliCode at Build 2018 conference, pioneering AI-assisted development with intelligent code completions based on machine learning models trained on thousands of open-source projects.",
      source: "Microsoft Developer Blog",
      tags: ["launch", "microsoft", "ai-pioneer"],
    },
    {
      tool: "Sourcegraph Cody",
      date: "2023-06-01",
      title: "Sourcegraph Launches Cody AI Coding Assistant",
      content:
        "Sourcegraph introduces Cody, an AI coding assistant that leverages the company's code intelligence platform to provide context-aware code suggestions and answers.",
      source: "Sourcegraph Blog",
      tags: ["launch", "code-search", "ai-assistant"],
    },
    {
      tool: "Sourcegraph Cody",
      date: "2023-12-14",
      title: "Sourcegraph Cody v1.0 General Availability",
      content:
        "Sourcegraph Cody reaches v1.0 general availability, offering enterprise-ready AI coding assistance with advanced code understanding and security features.",
      source: "Sourcegraph Blog",
      tags: ["launch", "general-availability", "enterprise"],
    },
    {
      tool: "Tabnine",
      date: "2021-05-01",
      title: "Tabnine Rebrands from Codota, Expands AI Capabilities",
      content:
        "Codota rebrands to Tabnine, consolidating its AI code completion offerings and expanding support to 30+ IDEs with enhanced machine learning models.",
      source: "Company Announcement",
      tags: ["rebrand", "expansion", "ai-assistant"],
    },
    {
      tool: "ChatGPT Canvas",
      date: "2024-10-03",
      title: "OpenAI Launches ChatGPT Canvas in Beta",
      content:
        "OpenAI introduces ChatGPT Canvas, a new interface for working with ChatGPT on writing and coding projects, featuring side-by-side editing and real-time collaboration.",
      source: "OpenAI Blog",
      tags: ["launch", "openai", "beta"],
    },
    {
      tool: "ChatGPT Canvas",
      date: "2024-12-01",
      title: "ChatGPT Canvas Full Release",
      content:
        "ChatGPT Canvas exits beta and becomes available to all ChatGPT users, offering enhanced coding workflows with inline editing and version control.",
      source: "OpenAI Blog",
      tags: ["launch", "openai", "general-availability"],
    },
    {
      tool: "OpenAI Codex CLI",
      date: "2024-12-01",
      title: "OpenAI Releases Codex CLI Tool",
      content:
        "OpenAI launches Codex CLI, bringing GPT-4 powered code generation directly to the command line for developers seeking terminal-based AI assistance.",
      source: "OpenAI Documentation",
      tags: ["launch", "cli", "openai"],
    },
    {
      tool: "CodeRabbit",
      date: "2023-07-10",
      title: "CodeRabbit Launches AI-Powered Code Review",
      content:
        "CodeRabbit debuts on Product Hunt, offering automated AI code reviews for pull requests with intelligent suggestions and best practice enforcement.",
      source: "Product Hunt",
      tags: ["launch", "code-review", "automation"],
    },
    {
      tool: "CodeRabbit",
      date: "2024-04-01",
      title: "CodeRabbit Relaunches with Enhanced Features",
      content:
        "CodeRabbit relaunches with improved AI models and expanded language support, strengthening its position in the automated code review market.",
      source: "Product Hunt",
      tags: ["relaunch", "code-review", "enhancement"],
    },
    {
      tool: "Snyk Code",
      date: "2021-05-06",
      title: "Snyk Launches Snyk Code for Security Analysis",
      content:
        "Snyk introduces Snyk Code, bringing AI-powered security vulnerability detection directly into developer workflows with real-time analysis and automated fixes.",
      source: "Snyk Official Blog",
      tags: ["launch", "security", "code-analysis"],
    },
    {
      tool: "Sourcery",
      date: "2019-12-11",
      title: "Sourcery Launches Automated Python Refactoring",
      content:
        "Sourcery debuts on Product Hunt, offering automated Python code refactoring powered by AI to help developers write cleaner, more maintainable code.",
      source: "Product Hunt",
      tags: ["launch", "python", "refactoring"],
    },
    {
      tool: "Sourcery",
      date: "2022-10-17",
      title: "Sourcery 2.0 Expands Language Support",
      content:
        "Sourcery releases version 2.0, expanding beyond Python to support multiple programming languages with enhanced AI-powered refactoring capabilities.",
      source: "Product Hunt",
      tags: ["major-update", "expansion", "multi-language"],
    },
    {
      tool: "Aider",
      date: "2023-05-01",
      title: "Aider Open-Source AI Pair Programming Tool Launches",
      content:
        "Aider launches as an open-source command-line AI pair programming tool, allowing developers to edit code in their local git repository using GPT-4.",
      source: "GitHub Repository",
      tags: ["launch", "open-source", "cli"],
    },
    {
      tool: "OpenHands",
      date: "2024-03-01",
      title: "OpenDevin Launches as Open-Source AI Software Engineer",
      content:
        "OpenDevin (later OpenHands) launches as an open-source autonomous AI software engineer, aiming to replicate Devin's capabilities in an open platform.",
      source: "GitHub, arXiv",
      tags: ["launch", "open-source", "autonomous"],
    },
    {
      tool: "OpenHands",
      date: "2024-11-01",
      title: "OpenDevin Rebrands to OpenHands",
      content:
        "OpenDevin rebrands to OpenHands, continuing its mission to provide open-source autonomous AI software engineering capabilities to developers worldwide.",
      source: "GitHub Repository",
      tags: ["rebrand", "open-source", "autonomous"],
    },
    {
      tool: "Claude Artifacts",
      date: "2024-06-20",
      title: "Anthropic Launches Claude Artifacts",
      content:
        "Anthropic introduces Claude Artifacts, enabling users to create, edit, and run code directly within Claude conversations with real-time preview capabilities.",
      source: "Anthropic Official Blog",
      tags: ["launch", "anthropic", "interactive-coding"],
    },
    {
      tool: "Diffblue Cover",
      date: "2020-09-08",
      title: "Diffblue Cover Community Edition Released",
      content:
        "Diffblue releases a free Community Edition of Diffblue Cover, making AI-powered unit test generation accessible to individual developers and open-source projects.",
      source: "Company Press Release",
      tags: ["launch", "community-edition", "testing"],
    },
  ];

  // Major feature updates from the last 6 months
  const featureUpdates = [
    {
      tool: "GitHub Copilot",
      date: "2025-06-05",
      title: "GitHub Copilot Introduces Pro+ Tier with Exclusive Model Access",
      content:
        "GitHub launches Copilot Pro+ tier offering 1500 premium requests per month and exclusive access to advanced AI models, targeting power users and professional developers.",
      source: "GitHub Blog",
      tags: ["feature-update", "pricing", "premium"],
    },
    {
      tool: "GitHub Copilot",
      date: "2025-04-04",
      title: "GitHub Copilot Adds Multi-Model Support",
      content:
        "GitHub Copilot now supports multiple AI models including Claude 3.7, o3-mini, and Gemini Flash 2.0, giving developers choice in their AI assistance.",
      source: "GitHub Announcement",
      tags: ["feature-update", "multi-model", "flexibility"],
    },
    {
      tool: "GitHub Copilot",
      date: "2025-05-19",
      title: "GitHub Copilot Coding Agent for Autonomous Issue Resolution",
      content:
        "GitHub introduces Copilot Coding Agent capable of autonomously resolving GitHub issues, marking a major step toward AI-driven software development.",
      source: "GitHub Blog",
      tags: ["feature-update", "autonomous", "agent"],
    },
    {
      tool: "Cursor",
      date: "2025-01-15",
      title: "Cursor Fusion Tab Model Enhances Multi-File Editing",
      content:
        "Cursor releases Fusion Tab Model with advanced multi-file editing capabilities and syntax highlighting, improving code understanding across entire projects.",
      source: "Cursor Changelog",
      tags: ["feature-update", "multi-file", "model"],
    },
    {
      tool: "Claude Artifacts",
      date: "2025-06-25",
      title: "Claude Artifacts Gains Interactive AI Capabilities",
      content:
        "Anthropic enhances Claude Artifacts with AI-powered interactivity, allowing users to embed AI directly within their created artifacts for dynamic experiences.",
      source: "Anthropic Blog",
      tags: ["feature-update", "interactive", "ai-integration"],
    },
    {
      tool: "Windsurf",
      date: "2025-02-01",
      title: "Windsurf Adds MCP Support for Custom Tool Integration",
      content:
        "Windsurf implements Model Context Protocol (MCP) support, enabling developers to connect custom tools and extend the IDE's AI capabilities.",
      source: "Codeium Blog",
      tags: ["feature-update", "mcp", "extensibility"],
    },
    {
      tool: "Bolt.new",
      date: "2025-02-12",
      title: "Bolt.new Enables Mobile App Development Without Code",
      content:
        "StackBlitz's Bolt.new adds mobile app development capabilities, allowing users to create iOS and Android applications entirely through natural language.",
      source: "StackBlitz Announcement",
      tags: ["feature-update", "mobile", "no-code"],
    },
    {
      tool: "Bolt.new",
      date: "2025-03-13",
      title: "Bolt.new Integrates with Figma for One-Click Design to Code",
      content:
        "Bolt.new launches Figma integration, enabling designers to convert their designs directly into production-ready code with a single click.",
      source: "StackBlitz Blog",
      tags: ["feature-update", "design-integration", "figma"],
    },
  ];

  // Market and performance updates
  const marketUpdates = [
    {
      tool: "Cursor",
      date: "2025-01-15",
      title: "Cursor Reaches $100M ARR, Fastest SaaS Growth",
      content:
        "Cursor achieves $100M annual recurring revenue, becoming the fastest SaaS company to reach this milestone from $1M ARR, with 360,000 paying customers.",
      source: "Bloomberg",
      tags: ["milestone", "revenue", "growth"],
    },
    {
      tool: "Claude Code",
      date: "2025-01-20",
      title: "Claude Opus 4 Sets New SWE-bench Record at 72.5%",
      content:
        "Anthropic's Claude Opus 4 achieves 72.5% on SWE-bench, setting a new state-of-the-art record for autonomous software engineering capabilities.",
      source: "Anthropic Announcements",
      tags: ["benchmark", "performance", "sota"],
    },
    {
      tool: "Bolt.new",
      date: "2025-03-01",
      title: "Bolt.new Hits $40M ARR with 25,000 Daily Apps Built",
      content:
        "StackBlitz's Bolt.new reaches $40M annual recurring revenue with developers building 25,000 applications daily on the platform.",
      source: "StackBlitz Announcement",
      tags: ["milestone", "usage", "growth"],
    },
    {
      tool: "Lovable",
      date: "2024-12-31",
      title: "Lovable Achieves £5.56M ARR with 140,000 Users",
      content:
        "Lovable (formerly GPT Engineer) ends 2024 with £5.56M ARR, 140,000 total users, and 30,000 paying customers, demonstrating strong market traction.",
      source: "EU-Startups",
      tags: ["milestone", "revenue", "user-growth"],
    },
    {
      tool: "Google Jules",
      date: "2025-01-15",
      title: "Google Jules Public Beta Launches with 52.2% SWE-bench Score",
      content:
        "Google releases Jules AI agent in public beta, powered by Gemini 2.0 Flash achieving 52.2% on SWE-bench, offering 5 tasks per day during beta period.",
      source: "Google Official Announcements",
      tags: ["launch", "beta", "benchmark"],
    },
  ];

  // Convert all entries to NewsArticle format
  [...launches, ...featureUpdates, ...marketUpdates].forEach((entry) => {
    const article: NewsArticle = {
      id: generateId(),
      slug: generateSlug(entry.title),
      title: entry.title,
      content: entry.content,
      summary: entry.content.substring(0, 200) + "...",
      published_date: new Date(entry.date).toISOString(),
      source: entry.source,
      source_url: undefined, // Could be enhanced with actual URLs
      tags: entry.tags,
      tool_mentions: [entry.tool],
      created_at: now,
      updated_at: now,
    };
    articles.push(article);
  });

  return articles;
}

async function importNewsFromResearch() {
  try {
    console.log("🔄 Starting news import from research data...\n");

    // Get news repository
    const newsRepo = getNewsRepo();

    // Get current articles
    const currentArticles = await newsRepo.getAll();
    console.log(`📊 Current database has ${currentArticles.length} articles\n`);

    // Create a set of existing titles for duplicate detection
    const existingTitles = new Set(currentArticles.map((a) => a.title.toLowerCase()));
    const existingSlugs = new Set(currentArticles.map((a) => a.slug));

    // Generate articles from research data
    const researchArticles = createNewsArticles();
    console.log(`📊 Generated ${researchArticles.length} articles from research data\n`);

    // Filter out duplicates
    const articlesToImport: NewsArticle[] = [];
    let duplicates = 0;

    for (const article of researchArticles) {
      const titleLower = article.title.toLowerCase();

      // Skip if title already exists
      if (existingTitles.has(titleLower)) {
        duplicates++;
        console.log(`   ⚠️  Duplicate title: ${article.title.substring(0, 50)}...`);
        continue;
      }

      // Ensure unique slug
      const baseSlug = article.slug;
      let counter = 1;
      while (
        existingSlugs.has(article.slug) ||
        articlesToImport.some((a) => a.slug === article.slug)
      ) {
        article.slug = `${baseSlug}-${counter}`;
        counter++;
      }

      articlesToImport.push(article);
      existingTitles.add(titleLower);
      existingSlugs.add(article.slug);
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   - Articles to import: ${articlesToImport.length}`);
    console.log(`   - Duplicates skipped: ${duplicates}`);

    if (articlesToImport.length === 0) {
      console.log("\n✅ No new articles to import!");
      return;
    }

    // Sort by published date (oldest first)
    articlesToImport.sort(
      (a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime()
    );

    // Import articles
    console.log("\n📥 Importing articles...");
    let imported = 0;

    for (const article of articlesToImport) {
      try {
        await newsRepo.upsert(article);
        imported++;
        console.log(
          `   ✓ [${new Date(article.published_date).toISOString().split("T")[0]}] ${article.title.substring(0, 50)}...`
        );
      } catch (error) {
        console.error(`   ✗ Failed to import: ${article.title}`, error);
      }
    }

    console.log(`\n✅ Successfully imported ${imported} articles!`);

    // Verify final count
    const finalArticles = await newsRepo.getAll();
    console.log(`\n📊 Final database count: ${finalArticles.length} articles`);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  importNewsFromResearch()
    .then(() => {
      console.log("\n✅ Import completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Import failed:", error);
      process.exit(1);
    });
}
