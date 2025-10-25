#!/usr/bin/env tsx

/**
 * Update Open Interpreter Tool with Comprehensive Content
 *
 * This script updates the Open Interpreter tool with:
 * - Complete 2025 GitHub metrics (60.7k stars, AGPL-3.0)
 * - Natural language computer interface capabilities
 * - Multi-format file manipulation (images, videos, documents)
 * - Local execution with privacy focus
 * - ChatGPT-like terminal interface
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const OPEN_INTERPRETER_SLUG = "open-interpreter";

const openInterpreterUpdateData = {
  company: "Open Interpreter Community (Open Source)",
  website: "https://www.openinterpreter.com",
  github_url: "https://github.com/OpenInterpreter/open-interpreter",
  license: "AGPL-3.0",
  overview: "Open Interpreter is a revolutionary open-source tool with 60,700+ GitHub stars that lets large language models run code (Python, JavaScript, Shell, and more) locally on your computer through a natural language interface. Launched in 2023, Open Interpreter bridges the gap between conversational AI and system-level control, enabling users to manipulate files, edit images and videos, analyze data, control browsers, and automate workflows simply by describing what they want in plain English. With over 3,080 commits and active community development, the tool provides a ChatGPT-like terminal interface that executes generated code locally while maintaining complete data privacy. Unlike cloud-based code interpreters, Open Interpreter runs entirely on your device, making it ideal for healthcare, finance, and other sensitive industries where cloud processing is prohibited. The tool supports multi-format capabilities including JPG/MP4 media files, PDF/DOCX documents, CSV/XLSX spreadsheets, and programming files across all major languages. Particularly valuable for DevOps engineers needing CLI automation and data scientists requiring reproducible analysis pipelines, Open Interpreter represents the future of natural language computing where your words become executable actions.",
  pricing: {
    model: "Free Open Source (Pay for Optional LLM APIs)",
    tiers: [
      {
        name: "Open Source (Free)",
        price: "$0 (AGPL-3.0 License)",
        features: [
          "Complete source code access",
          "Unlimited local execution",
          "All features included",
          "Community support on GitHub",
          "Self-hosted deployment",
          "No subscription fees"
        ],
        recommended: true
      },
      {
        name: "Cloud LLM APIs",
        price: "Pay for OpenAI/Anthropic/etc.",
        features: [
          "Use GPT-4, Claude, or other cloud models",
          "Pay only for LLM API usage",
          "No Open Interpreter fees",
          "Highest quality code generation",
          "Regular model updates",
          "Simple API key configuration"
        ]
      },
      {
        name: "Local Models (Free)",
        price: "$0 (Completely free)",
        features: [
          "Run 100% offline with local LLMs",
          "Complete data privacy",
          "No cloud dependencies",
          "Zero ongoing costs",
          "Ideal for sensitive data",
          "Healthcare/finance compliant"
        ]
      }
    ]
  },
  features: [
    "Natural language interface for computer control",
    "Multi-language code execution (Python, JavaScript, Shell, etc.)",
    "Local execution with complete data privacy",
    "ChatGPT-like terminal interface",
    "Image and video manipulation (JPG, PNG, MP4, etc.)",
    "Document processing (PDF, DOCX, TXT)",
    "Spreadsheet analysis (CSV, XLSX)",
    "Browser automation and web scraping",
    "File system operations via natural language",
    "Data analysis and visualization pipelines",
    "Safety confirmations before code execution",
    "Compatible with cloud and local LLMs"
  ],
  target_audience: "DevOps engineers automating CLI workflows, data scientists building reproducible pipelines, privacy-focused developers, healthcare and finance professionals requiring local processing, system administrators, researchers needing multi-format data manipulation, and power users seeking natural language system control",
  use_cases: [
    "Natural language CLI automation for DevOps",
    "Data analysis pipelines with reproducibility",
    "Image and video editing via text commands",
    "Document processing and conversion",
    "Spreadsheet manipulation and analysis",
    "Browser automation for web tasks",
    "Privacy-compliant data processing (healthcare/finance)",
    "System administration through natural language",
    "Rapid prototyping and scripting",
    "Educational tool for learning programming concepts"
  ],
  integrations: [
    "Python ecosystem (primary execution environment)",
    "JavaScript/Node.js runtime",
    "Shell/Bash command execution",
    "OpenAI API (GPT-4, GPT-3.5)",
    "Anthropic Claude API",
    "Local LLM models",
    "Image libraries (PIL, OpenCV)",
    "Video processing tools (FFmpeg)",
    "Document parsers (PyPDF2, python-docx)",
    "Data analysis libraries (pandas, numpy)"
  ],
  launch_year: 2023,
  updated_2025: true,
  recent_updates_2025: [
    "Reached 60,700+ GitHub stars (top 0.01% of repos)",
    "Exceeded 3,080 commits with active development",
    "Expanded multi-format file support",
    "Enhanced safety confirmations for code execution",
    "Improved local LLM compatibility",
    "Growing translation and documentation support",
    "Community contributions across multiple languages"
  ],
  github_metrics: {
    stars: "60,700+",
    forks: "5,200+",
    contributors: "100+ (estimated)",
    commits: "3,080+",
    license: "AGPL-3.0",
    primary_language: "Python",
    status: "Actively maintained"
  },
  safety_features: [
    "User confirmation before executing code",
    "Clear display of generated code before running",
    "Sandboxed execution options",
    "Transparent code generation process",
    "Warning system for risky operations",
    "Local execution prevents cloud data leaks"
  ],
  open_source_benefits: [
    "Complete transparency in code execution",
    "Community-driven feature development",
    "No vendor lock-in or proprietary restrictions",
    "Privacy-first architecture with local execution",
    "Educational resource for NL-to-code systems",
    "Active community with 60k+ stars",
    "Free forever with AGPL-3.0 license"
  ],
  privacy_advantages: {
    local_execution: "All code runs on your device, not cloud servers",
    data_sovereignty: "Sensitive data never leaves your machine",
    compliance: "Meets healthcare (HIPAA) and finance regulations",
    no_telemetry: "No usage tracking or data collection",
    offline_capable: "Works completely offline with local models"
  },
  use_case_examples: [
    "DevOps: 'Analyze server logs and create a report of error patterns'",
    "Data Science: 'Clean this CSV, visualize trends, and export to Excel'",
    "Media: 'Resize all images in this folder to 1920x1080'",
    "Documents: 'Convert these PDFs to text and summarize each one'",
    "Finance: 'Calculate portfolio returns from this spreadsheet'"
  ]
};

async function checkExistingTool() {
  const db = getDb();
  const result = await db.select().from(tools).where(eq(tools.slug, OPEN_INTERPRETER_SLUG));
  return result.length > 0 ? result[0] : null;
}

async function updateOpenInterpreterTool() {
  const db = getDb();

  console.log(`\n📝 Updating ${OPEN_INTERPRETER_SLUG}...`);
  console.log("=".repeat(80));

  // Check if tool exists
  const existingTool = await checkExistingTool();

  if (!existingTool) {
    console.log(`  ❌ Tool not found: ${OPEN_INTERPRETER_SLUG}`);
    console.log(`  ℹ️  This tool needs to be added to the database first`);
    return { success: false, message: "Tool not found - needs to be created" };
  }

  console.log(`  ✓ Found tool: ${existingTool.name}`);
  console.log(`  Current category: ${existingTool.category}`);

  // Get existing data
  const existingData = existingTool.data as Record<string, any>;

  console.log(`\n📊 BEFORE UPDATE:`);
  console.log(`  Company: ${existingData.company || 'MISSING'}`);
  console.log(`  Website: ${existingData.website || 'MISSING'}`);
  console.log(`  GitHub: ${existingData.github_url || 'MISSING'}`);
  console.log(`  Overview: ${existingData.overview ? existingData.overview.substring(0, 80) + '...' : 'MISSING'}`);

  // Update the tool data - merge with existing data
  const updatedData = {
    ...existingData,
    ...openInterpreterUpdateData,
    // Keep existing description if it's good
    description: existingData.description || openInterpreterUpdateData.overview.substring(0, 200),
  };

  // Perform the update
  const result = await db
    .update(tools)
    .set({
      data: updatedData,
      updatedAt: new Date(),
    })
    .where(eq(tools.slug, OPEN_INTERPRETER_SLUG))
    .returning();

  if (result.length > 0) {
    const updatedTool = result[0];
    const updatedToolData = updatedTool.data as Record<string, any>;

    console.log(`\n📊 AFTER UPDATE:`);
    console.log(`  Company: ${updatedToolData.company}`);
    console.log(`  Website: ${updatedToolData.website}`);
    console.log(`  GitHub: ${updatedToolData.github_url}`);
    console.log(`  License: ${updatedToolData.license}`);
    console.log(`  Overview: ${updatedToolData.overview.substring(0, 100)}...`);
    console.log(`  Features: ${updatedToolData.features.length} features added`);
    console.log(`  Pricing tiers: ${updatedToolData.pricing.tiers.length} tiers configured`);
    console.log(`  GitHub stars: ${updatedToolData.github_metrics.stars}`);
    console.log(`  Safety features: ${updatedToolData.safety_features.length} documented`);

    console.log(`\n✅ Successfully updated ${OPEN_INTERPRETER_SLUG}`);
    return { success: true, data: result[0] };
  } else {
    console.log(`  ❌ Failed to update ${OPEN_INTERPRETER_SLUG}`);
    return { success: false, message: "Update failed" };
  }
}

async function main() {
  console.log("🚀 Starting Open Interpreter tool content update...\n");
  console.log("=".repeat(80));
  console.log("Tool: Open Interpreter");
  console.log("Slug: open-interpreter");
  console.log("Category: open-source-framework");
  console.log("Website: https://www.openinterpreter.com");
  console.log("GitHub: https://github.com/OpenInterpreter/open-interpreter");
  console.log("Stars: 60,700+");
  console.log("License: AGPL-3.0");
  console.log("=".repeat(80));

  try {
    const result = await updateOpenInterpreterTool();

    console.log("\n" + "=".repeat(80));
    if (result.success) {
      console.log("\n✨ Update completed successfully!");
      console.log("\n🎯 Open Interpreter tool now has:");
      console.log("  ✅ Company: Open Interpreter Community");
      console.log("  ✅ Website: https://www.openinterpreter.com");
      console.log("  ✅ GitHub: 60.7k stars, 5.2k forks");
      console.log("  ✅ License: AGPL-3.0 (copyleft open source)");
      console.log("  ✅ Comprehensive overview (~150 words)");
      console.log("  ✅ 12 key features (natural language, local execution)");
      console.log("  ✅ 3 pricing tiers (free + optional LLM APIs)");
      console.log("  ✅ Target audience: DevOps, data scientists, privacy-focused");
      console.log("  ✅ 10 use cases (CLI automation, data analysis)");
      console.log("  ✅ 10 integrations (Python, JS, LLMs)");
      console.log("  ✅ GitHub metrics (60k+ stars)");
      console.log("  ✅ Safety features documented");
      console.log("  ✅ Privacy advantages highlighted");
      console.log("  ✅ Use case examples included");
    } else {
      console.log("\n❌ Update failed!");
      console.log(`  Reason: ${result.message}`);
      if (result.message.includes("not found")) {
        console.log("\n📋 Next steps:");
        console.log("  1. Add Open Interpreter to database first");
        console.log("  2. Then run this update script");
      }
    }
    console.log("\n" + "=".repeat(80));
  } catch (error) {
    console.error("  ❌ Error updating Open Interpreter tool:", error);
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
