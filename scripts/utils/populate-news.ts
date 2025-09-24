/**
 * Script to populate the database with sample news articles
 * Run with: pnpm tsx scripts/populate-news.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { news } from "../src/lib/db/schema";

const sampleArticles = [
  {
    slug: "cursor-500m-arr-milestone",
    articleId: "news-001",
    title: "Cursor Reaches $500M ARR with 360K+ Paying Developers",
    summary:
      "AI-powered code editor Cursor achieves remarkable revenue milestone, becoming one of the fastest-growing developer tools in history.",
    category: "milestone",
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com/cursor-500m-arr",
    publishedAt: new Date("2025-09-15T10:00:00Z"),
    date: new Date("2025-09-15T10:00:00Z"),
    data: {
      content:
        "Cursor, the AI-powered code editor, has reached $500M in annual recurring revenue with over 360,000 paying developers. The company recently raised $100M at a $4B valuation.",
      metrics: {
        revenue_growth: "500%",
        user_growth: "300%",
        funding_raised: "$100M",
      },
    },
    toolMentions: ["cursor"],
    importanceScore: 9,
  },
  {
    slug: "claude-code-general-availability",
    articleId: "news-002",
    title: "Claude Code Launches with 72.7% SWE-bench Score",
    summary:
      "Anthropic releases Claude Code to general availability, featuring Claude 4 models and achieving top scores on software engineering benchmarks.",
    category: "feature",
    source: "The Verge",
    sourceUrl: "https://theverge.com/claude-code-launch",
    publishedAt: new Date("2025-09-14T14:00:00Z"),
    date: new Date("2025-09-14T14:00:00Z"),
    data: {
      content:
        "Claude Code, Anthropic's terminal-based coding agent, is now generally available with impressive benchmark scores. The tool achieved 72.7% on SWE-bench Verified using Claude Sonnet 4.",
      features: [
        "Terminal-based interface",
        "Multi-file editing",
        "MCP protocol support",
        "Extended thinking modes",
      ],
    },
    toolMentions: ["claude-code"],
    importanceScore: 8,
  },
  {
    slug: "github-copilot-workspace-update",
    articleId: "news-003",
    title: "GitHub Copilot Workspace Adds Autonomous Task Execution",
    summary:
      "GitHub enhances Copilot with autonomous capabilities, allowing it to execute multi-step tasks and self-heal errors.",
    category: "feature",
    source: "GitHub Blog",
    sourceUrl: "https://github.blog/copilot-workspace",
    publishedAt: new Date("2025-09-13T16:00:00Z"),
    date: new Date("2025-09-13T16:00:00Z"),
    data: {
      content:
        "GitHub Copilot Workspace now includes autonomous task execution, terminal command capabilities, and self-healing error recovery, marking a significant advancement in AI pair programming.",
      capabilities: [
        "Multi-step task execution",
        "Terminal command execution",
        "Error self-healing",
        "Context preservation",
      ],
    },
    toolMentions: ["github-copilot"],
    importanceScore: 8,
  },
  {
    slug: "bolt-new-20m-arr",
    articleId: "news-004",
    title: "Bolt.new Reaches $20M ARR in Just 2 Months",
    summary:
      "StackBlitz's AI-powered app builder achieves fastest startup growth ever, with 85,000+ users building full-stack applications.",
    category: "milestone",
    source: "VentureBeat",
    sourceUrl: "https://venturebeat.com/bolt-new-growth",
    publishedAt: new Date("2025-09-12T09:00:00Z"),
    date: new Date("2025-09-12T09:00:00Z"),
    data: {
      content:
        "Bolt.new, the AI-powered full-stack web application builder from StackBlitz, has achieved $20M in annual recurring revenue just two months after launch, marking the fastest startup growth on record.",
      metrics: {
        arr: "$20M",
        users: "85,000+",
        time_to_20m: "2 months",
      },
    },
    toolMentions: ["bolt-new"],
    importanceScore: 9,
  },
  {
    slug: "aider-swe-bench-improvements",
    articleId: "news-005",
    title: "Aider Achieves 33.83% on Full SWE-bench with Claude 3.7",
    summary:
      "Open-source AI pair programming tool shows significant improvements using latest Claude models, reaching top positions on benchmarks.",
    category: "update",
    source: "AI Developer News",
    sourceUrl: "https://aidevnews.com/aider-benchmark",
    publishedAt: new Date("2025-09-11T11:00:00Z"),
    date: new Date("2025-09-11T11:00:00Z"),
    data: {
      content:
        "Aider, the terminal-based AI pair programming tool, achieved 33.83% on the full SWE-bench using Claude 3.7 Sonnet via SWE-agent 1.0, demonstrating the power of open-source AI coding assistants.",
      benchmark_scores: {
        swe_bench_full: "33.83%",
        swe_bench_lite: "26.3%",
        model_used: "Claude 3.7 Sonnet",
      },
    },
    toolMentions: ["aider"],
    importanceScore: 7,
  },
  {
    slug: "devin-price-reduction",
    articleId: "news-006",
    title: "Devin Reduces Pricing by 96% to $20/month",
    summary:
      "Cognition AI makes Devin more accessible with dramatic price cut from $500/month, aiming for broader developer adoption.",
    category: "announcement",
    source: "TechCrunch",
    sourceUrl: "https://techcrunch.com/devin-pricing",
    publishedAt: new Date("2025-09-10T15:00:00Z"),
    date: new Date("2025-09-10T15:00:00Z"),
    data: {
      content:
        "Cognition AI has reduced Devin's pricing from $500/month to just $20/month, a 96% reduction, making the autonomous AI software engineer more accessible to individual developers and small teams.",
      pricing_change: {
        old_price: "$500/month",
        new_price: "$20/month",
        reduction: "96%",
      },
    },
    toolMentions: ["devin"],
    importanceScore: 8,
  },
  {
    slug: "cline-multimodal-capabilities",
    articleId: "news-007",
    title: "Cline Adds Multi-Modal Capabilities and Browser Automation",
    summary:
      "Open-source VS Code extension now supports image understanding and browser automation, expanding autonomous coding capabilities.",
    category: "feature",
    source: "Dev.to",
    sourceUrl: "https://dev.to/cline-multimodal",
    publishedAt: new Date("2025-09-09T13:00:00Z"),
    date: new Date("2025-09-09T13:00:00Z"),
    data: {
      content:
        "Cline, the popular open-source VS Code extension, has added multi-modal capabilities including image understanding and browser automation, making it a more comprehensive autonomous coding agent.",
      new_features: [
        "Image understanding",
        "Browser automation",
        "AST analysis",
        "Workspace snapshots",
      ],
    },
    toolMentions: ["cline"],
    importanceScore: 6,
  },
  {
    slug: "amazon-q-developer-improvements",
    articleId: "news-008",
    title: "Amazon Q Developer Achieves 55% on SWE-bench Verified",
    summary:
      "AWS's AI development assistant shows strong performance on software engineering benchmarks with deep AWS integration.",
    category: "update",
    source: "AWS News",
    sourceUrl: "https://aws.amazon.com/blogs/q-developer",
    publishedAt: new Date("2025-09-08T10:00:00Z"),
    date: new Date("2025-09-08T10:00:00Z"),
    data: {
      content:
        "Amazon Q Developer, AWS's comprehensive AI development assistant, achieved 55% on SWE-bench Verified, demonstrating strong capabilities for AWS-focused development with deep ecosystem integration.",
      benchmark: {
        swe_bench_verified: "55%",
        model: "Amazon Q Developer Agent v20241202-dev",
      },
    },
    toolMentions: ["amazon-q-developer"],
    importanceScore: 7,
  },
  {
    slug: "continue-1-0-release",
    articleId: "news-009",
    title: "Continue Releases Version 1.0 with $3M Seed Funding",
    summary:
      "Open-source IDE autopilot reaches 1.0 milestone with Continue Hub for sharing custom AI assistants.",
    category: "milestone",
    source: "Hacker News",
    sourceUrl: "https://news.ycombinator.com/continue-1-0",
    publishedAt: new Date("2025-09-07T12:00:00Z"),
    date: new Date("2025-09-07T12:00:00Z"),
    data: {
      content:
        "Continue, the open-source autopilot for IDEs, has released version 1.0 alongside $3M in seed funding. The release includes Continue Hub for sharing custom AI assistants across teams.",
      milestones: {
        version: "1.0",
        funding: "$3M seed",
        feature: "Continue Hub",
      },
    },
    toolMentions: ["continue-dev"],
    importanceScore: 6,
  },
  {
    slug: "gemini-code-assist-2m-context",
    articleId: "news-010",
    title: "Google Gemini Code Assist Offers 2M Token Context Window",
    summary:
      "Google's response to GitHub Copilot features industry-leading context window and aggressive free tier with 180K monthly completions.",
    category: "feature",
    source: "Google Cloud Blog",
    sourceUrl: "https://cloud.google.com/blog/gemini-code-assist",
    publishedAt: new Date("2025-09-06T14:00:00Z"),
    date: new Date("2025-09-06T14:00:00Z"),
    data: {
      content:
        "Google Gemini Code Assist now offers a 2 million token context window, the largest in the industry, along with 180,000 free monthly completions, positioning it as a strong competitor to GitHub Copilot.",
      specifications: {
        context_window: "2,000,000 tokens",
        free_completions: "180,000/month",
        pricing: "$19/month standard",
      },
    },
    toolMentions: ["gemini-code-assist"],
    importanceScore: 8,
  },
];

async function populateNews() {
  console.log("🚀 Starting news population...");

  for (const article of sampleArticles) {
    try {
      // Check if article already exists
      const existing = await db.select().from(news).where(eq(news.slug, article.slug)).limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  Skipping existing article: ${article.title}`);
        continue;
      }

      // Insert the article
      await db.insert(news).values(article);
      console.log(`✅ Added article: ${article.title}`);
    } catch (error) {
      console.error(`❌ Error adding article ${article.title}:`, error);
    }
  }

  // Get total count
  const allNews = await db.select().from(news);
  console.log(`\n📊 Total articles in database: ${allNews.length}`);

  console.log("\n✨ News population complete!");
}

// Run the script
populateNews()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
