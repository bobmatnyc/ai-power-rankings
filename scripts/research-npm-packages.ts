#!/usr/bin/env tsx

/**
 * Research npm Packages
 * Investigates whether npm packages are tool-specific or generic SDKs
 */

interface PackageResearch {
  tool: string;
  slug: string;
  currentPackage: string;
  downloads: number;
  verdict: "correct" | "incorrect" | "questionable";
  reason: string;
  correctPackage: string | null;
  evidence: string[];
}

const research: PackageResearch[] = [
  {
    tool: "ChatGPT Canvas",
    slug: "chatgpt-canvas",
    currentPackage: "canvas",
    downloads: 17164336,
    verdict: "incorrect",
    reason: "Generic HTML5 Canvas library, not related to ChatGPT Canvas",
    correctPackage: null,
    evidence: [
      "Package 'canvas' is a generic HTML5 Canvas implementation for Node.js",
      "Description: 'Canvas graphics API backed by Cairo'",
      "No mention of ChatGPT, OpenAI, or conversational AI",
      "ChatGPT Canvas is a web-based feature, not a standalone npm package",
    ],
  },
  {
    tool: "Google Gemini Code Assist",
    slug: "gemini-code-assist",
    currentPackage: "@google/generative-ai",
    downloads: 5212976,
    verdict: "incorrect",
    reason: "Generic Google AI SDK, used by all Google AI products, not code-assist specific",
    correctPackage: null,
    evidence: [
      "@google/generative-ai is Google's general AI SDK",
      "Used for Gemini API access across all applications",
      "No specific code-assist functionality",
      "Gemini Code Assist is an IDE plugin, not a separate npm package",
    ],
  },
  {
    tool: "Google Gemini CLI",
    slug: "google-gemini-cli",
    currentPackage: "@google/gemini-cli",
    downloads: 1120414,
    verdict: "questionable",
    reason: "Need to verify if this is the official CLI or a third-party wrapper",
    correctPackage: "@google/gemini-cli",
    evidence: [
      "Package name matches tool name",
      "Description mentions 'Gemini CLI'",
      "High downloads suggest legitimacy",
      "Need to verify if official Google package",
    ],
  },
  {
    tool: "OpenAI Codex",
    slug: "openai-codex",
    currentPackage: "@openai/codex",
    downloads: 1059615,
    verdict: "questionable",
    reason: "Codex was deprecated by OpenAI, need to verify package legitimacy",
    correctPackage: null,
    evidence: [
      "OpenAI deprecated Codex models in 2023",
      "Package may be unofficial or abandoned",
      "Very high downloads suggest it might be a different tool",
      "Need to investigate package contents",
    ],
  },
  {
    tool: "JetBrains AI Assistant",
    slug: "jetbrains-ai",
    currentPackage: "@n8n_io/ai-assistant-sdk",
    downloads: 396255,
    verdict: "incorrect",
    reason: "This is n8n's AI assistant SDK, not JetBrains AI Assistant",
    correctPackage: null,
    evidence: [
      "Package is owned by n8n_io, not JetBrains",
      "Description: 'n8n AI assistant SDK'",
      "JetBrains AI is an IDE plugin, not a standalone npm package",
      "No connection to JetBrains",
    ],
  },
  {
    tool: "GitHub Copilot",
    slug: "github-copilot",
    currentPackage: "@github/copilot",
    downloads: 265480,
    verdict: "questionable",
    reason: "Need to verify if this is the official CLI or a wrapper",
    correctPackage: "@github/copilot",
    evidence: [
      "Package is in GitHub's organization",
      "Description mentions 'GitHub Copilot CLI'",
      "Moderate downloads suggest legitimate usage",
      "May be correct mapping",
    ],
  },
  {
    tool: "GitLab Duo Agent Platform",
    slug: "gitlab-duo-agent-platform",
    currentPackage: "@gitlab/cluster-client",
    downloads: 111049,
    verdict: "incorrect",
    reason: "This is GitLab's Kubernetes client, not Duo Agent Platform",
    correctPackage: null,
    evidence: [
      "Description: 'A JavaScript client for Kubernetes for use in the GitLab frontend'",
      "Package is for cluster management, not AI coding",
      "No mention of Duo or AI features",
      "Agent Platform may not have a separate npm package",
    ],
  },
  {
    tool: "Sourcery",
    slug: "sourcery",
    currentPackage: "@sourcery/sdk",
    downloads: 579,
    verdict: "questionable",
    reason: "Low downloads but package name matches, need verification",
    correctPackage: "@sourcery/sdk",
    evidence: [
      "Package name matches tool",
      "Description: 'Sourcery SDK'",
      "Low downloads suggest it might be correct (niche tool)",
      "May be legitimate",
    ],
  },
  {
    tool: "Warp",
    slug: "warp",
    currentPackage: "warp",
    downloads: 6999,
    verdict: "incorrect",
    reason: "This is ScaleDynamics containers SDK, not Warp terminal",
    correctPackage: null,
    evidence: [
      "Description mentions ScaleDynamics and containers",
      "Warp is a terminal application, not an npm package",
      "No connection to Warp terminal product",
      "Package predates Warp terminal",
    ],
  },
  {
    tool: "Zed",
    slug: "zed",
    currentPackage: "@schoolai/spicedb-zed-schema-parser",
    downloads: 5866,
    verdict: "incorrect",
    reason: "This is a SpiceDB schema parser, not Zed editor",
    correctPackage: null,
    evidence: [
      "Description: 'SpiceDB .zed file format parser'",
      "Refers to .zed file format, not Zed editor",
      "Zed is a desktop application, not an npm package",
      "No connection to Zed editor",
    ],
  },
  {
    tool: "Lovable",
    slug: "lovable",
    currentPackage: "@mockdetector/widget",
    downloads: 4363,
    verdict: "incorrect",
    reason: "This is a mock data detection widget, not Lovable",
    correctPackage: null,
    evidence: [
      "Description: 'mock data detection widget'",
      "No mention of Lovable or AI coding",
      "Different domain (testing/mocking)",
      "Lovable is a web-based platform",
    ],
  },
  {
    tool: "Goose",
    slug: "goose",
    currentPackage: "ai-sdk-provider-goose-web",
    downloads: 2751,
    verdict: "questionable",
    reason: "This is an AI SDK provider adapter, not the Goose CLI itself",
    correctPackage: null,
    evidence: [
      "Description: 'AI SDK v5 provider for Goose via WebSocket'",
      "This is a provider adapter, not the main tool",
      "Goose CLI would be a different package",
      "Should map to the actual CLI package if it exists",
    ],
  },
  {
    tool: "Graphite",
    slug: "graphite",
    currentPackage: "graphite",
    downloads: 15995,
    verdict: "incorrect",
    reason: "This is a Graphite metrics client, not Graphite code review tool",
    correctPackage: "@withgraphite/graphite-cli",
    evidence: [
      "Description: 'A node.js client for graphite (metrics)'",
      "Refers to Graphite metrics system",
      "Graphite code tool has CLI at @withgraphite/graphite-cli",
      "Wrong Graphite product",
    ],
  },
  {
    tool: "Trae AI",
    slug: "trae-ai",
    currentPackage: "@andrebuzeli/git-mcp",
    downloads: 9931,
    verdict: "incorrect",
    reason: "This is a Git MCP server, not Trae AI",
    correctPackage: null,
    evidence: [
      "Package description mentions Git MCP operations",
      "Author is @andrebuzeli, not Trae AI",
      "No connection to Trae AI product",
      "Wrong tool entirely",
    ],
  },
  {
    tool: "Qoder",
    slug: "qoder",
    currentPackage: "brave-real-browser-mcp-server",
    downloads: 8186,
    verdict: "incorrect",
    reason: "This is a Brave browser MCP server, not Qoder",
    correctPackage: null,
    evidence: [
      "Description mentions Brave browser and MCP",
      "No mention of Qoder",
      "Wrong tool entirely",
      "Qoder may not have npm package",
    ],
  },
  {
    tool: "Kiro",
    slug: "kiro",
    currentPackage: "amazonq-sdd",
    downloads: 351,
    verdict: "incorrect",
    reason: "This is an Amazon Q extension, not Kiro",
    correctPackage: null,
    evidence: [
      "Description: 'SDD Custom Agent installer for Amazon Q CLI'",
      "Package is for Amazon Q, not Kiro",
      "Wrong tool entirely",
      "Kiro may not have npm package",
    ],
  },
  {
    tool: "Microsoft Agent Framework",
    slug: "microsoft-agentic-devops",
    currentPackage: "@ddse/acm-adapters",
    downloads: 112,
    verdict: "incorrect",
    reason: "This is ACM adapters package, not Microsoft Agent Framework",
    correctPackage: null,
    evidence: [
      "Description: 'Framework adapters for ACM'",
      "Not official Microsoft package",
      "May be related but not the official framework",
      "Need Microsoft official package",
    ],
  },
  {
    tool: "Bolt.new",
    slug: "bolt-new",
    currentPackage: "selah-cli",
    downloads: 110,
    verdict: "incorrect",
    reason: "This is AWS deployment CLI for Bolt apps, not Bolt.new itself",
    correctPackage: null,
    evidence: [
      "Description: 'Zero-setup AWS deployment for Bolt.new apps'",
      "Third-party deployment tool",
      "Not the Bolt.new platform itself",
      "Bolt.new is web-based",
    ],
  },
  {
    tool: "Replit Agent",
    slug: "replit-agent",
    currentPackage: "replit-agent",
    downloads: 18,
    verdict: "incorrect",
    reason: "This is a third-party OpenRouter TUI, not official Replit Agent",
    correctPackage: null,
    evidence: [
      "Description: 'A fancy TUI that connects to OpenRouter AI'",
      "Not official Replit package",
      "Very low downloads suggest unofficial tool",
      "Replit Agent is web-based",
    ],
  },
  {
    tool: "Refact.ai",
    slug: "refact-ai",
    currentPackage: "react-expo-refact-ai",
    downloads: 7,
    verdict: "incorrect",
    reason: "This is a React Native template, not Refact.ai",
    correctPackage: null,
    evidence: [
      "Description: 'React Native Expo starter template'",
      "Not the actual Refact.ai tool",
      "Very low downloads",
      "Wrong package entirely",
    ],
  },
];

async function main() {
  console.log("=== NPM PACKAGE RESEARCH REPORT ===\n");

  const incorrect = research.filter((r) => r.verdict === "incorrect");
  const questionable = research.filter((r) => r.verdict === "questionable");
  const correct = research.filter((r) => r.verdict === "correct");

  console.log(`Total packages researched: ${research.length}`);
  console.log(`❌ Incorrect: ${incorrect.length}`);
  console.log(`⚠️  Questionable: ${questionable.length}`);
  console.log(`✅ Correct: ${correct.length}\n`);

  console.log("=== INCORRECT MAPPINGS (MUST FIX) ===\n");

  incorrect.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.tool} (${item.slug})`);
    console.log(`   Current Package: ${item.currentPackage}`);
    console.log(`   Downloads: ${item.downloads.toLocaleString()}`);
    console.log(`   Correct Package: ${item.correctPackage || "None (remove npm data)"}`);
    console.log(`   Reason: ${item.reason}`);
    console.log(`   Evidence:`);
    item.evidence.forEach((e) => console.log(`     • ${e}`));
    console.log("");
  });

  console.log("\n=== QUESTIONABLE MAPPINGS (NEED VERIFICATION) ===\n");

  questionable.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.tool} (${item.slug})`);
    console.log(`   Package: ${item.currentPackage}`);
    console.log(`   Downloads: ${item.downloads.toLocaleString()}`);
    console.log(`   Reason: ${item.reason}`);
    console.log(`   Evidence:`);
    item.evidence.forEach((e) => console.log(`     • ${e}`));
    console.log("");
  });

  console.log("\n=== IMPACT ANALYSIS ===\n");

  const totalIncorrectDownloads = incorrect.reduce((sum, item) => sum + item.downloads, 0);
  const totalAllDownloads = research.reduce((sum, item) => sum + item.downloads, 0);

  console.log(`Total downloads from incorrect mappings: ${totalIncorrectDownloads.toLocaleString()}`);
  console.log(`Total downloads all researched: ${totalAllDownloads.toLocaleString()}`);
  console.log(
    `Percentage of downloads from incorrect: ${((totalIncorrectDownloads / totalAllDownloads) * 100).toFixed(1)}%`
  );
  console.log("");

  console.log("Top 3 incorrect by impact:");
  incorrect
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 3)
    .forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.tool}: ${item.downloads.toLocaleString()} downloads`);
    });

  console.log("\n=== CORRECTION PLAN ===\n");

  console.log("Tools to have npm data REMOVED:");
  incorrect
    .filter((r) => r.correctPackage === null)
    .forEach((item) => {
      console.log(`  • ${item.slug} (${item.tool})`);
    });

  console.log("\nTools to have npm data CORRECTED:");
  incorrect
    .filter((r) => r.correctPackage !== null)
    .forEach((item) => {
      console.log(`  • ${item.slug}: ${item.currentPackage} → ${item.correctPackage}`);
    });

  console.log("\nTools requiring further investigation:");
  questionable.forEach((item) => {
    console.log(`  • ${item.slug} (${item.tool})`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
