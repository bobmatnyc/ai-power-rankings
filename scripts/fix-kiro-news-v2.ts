#!/usr/bin/env tsx

import fs from "fs/promises";
import path from "path";

async function fixKiroNews() {
  console.log("Starting Kiro news fix v2...");

  const newsPath = path.join(process.cwd(), "data/json/news/articles/2025-07.json");
  const content = await fs.readFile(newsPath, "utf-8");
  const articles = JSON.parse(content);

  let fixedCount = 0;
  const fixedArticles = articles.map((article: any) => {
    // Only fix the 4 Kiro news articles that have JSON content
    if (
      article.title &&
      article.title.startsWith("Kiro News:") &&
      ((article.content && article.content.includes("[\n  {")) ||
        (article.summary && article.summary.includes("[\n  {")))
    ) {
      fixedCount++;
      console.log(`Fixing article: ${article.title}`);

      let newContent = "";
      let newSummary = "";

      // Extract proper content based on the title
      if (article.title.includes("developer tool updates funding")) {
        newContent =
          "Amazon Web Services launched Kiro, an AI-powered agentic IDE designed to help developers move from prototype to production with structured, production-ready code. AWS CEO Matt Garman highlighted that Kiro bridges the gap between quick code generation and shipping production-quality applications.";
        newSummary =
          "AWS launches Kiro, a new AI-powered IDE that transforms natural language specifications into production-ready code, addressing the challenges of 'vibe coding' in AI development.";
      } else if (article.title.includes("vs Cursor Copilot Claude comparison")) {
        newContent =
          "This article compares Amazon's Kiro and Anthropic's Claude Code in AI-powered development. Claude Code has a proven track record with a 70% success rate on real-world bug fixing benchmarks and is used extensively internally at Anthropic, producing high-quality, maintainable code. Kiro, as Amazon's new entry, focuses on spec-driven development and production-ready code generation.";
        newSummary =
          "A comparison of Amazon Kiro vs. Anthropic Claude Code reveals different approaches to AI development, with Claude Code showing strong benchmark performance while Kiro emphasizes specification-driven development.";
      } else if (article.title.includes("features pricing launch announcement")) {
        newContent =
          "Amazon launched a preview of Kiro, an AI-powered tool designed to help developers code, design systems, and manage tasks with minimal manual effort. Kiro supports a 'vibe coding' approach where much of the software-building process is automated through AI agents, while maintaining production-quality standards through specification-driven development.";
        newSummary =
          "Amazon enters the AI coding assistant market with Kiro Preview, offering developers a new approach to automated software development that balances creative freedom with production requirements.";
      } else if (article.title.includes("AI coding assistant news July 2025")) {
        newContent =
          "Amazon Web Services (AWS) unveiled Kiro, an agentic AI integrated development environment (IDE) designed to streamline software development by reducing issues associated with 'vibe coding'—where AI agents create software with minimal human input. Kiro focuses on transforming natural language specifications into well-structured, production-ready applications.";
        newSummary =
          "AWS launches Kiro, an agentic AI IDE designed to end the chaos of 'vibe coding' by providing structured, specification-driven development while maintaining the benefits of AI-powered code generation.";
      }

      // Also fix the tool_mentions to use "kiro" instead of "31"
      const fixedToolMentions = article.tool_mentions?.map((mention: string) =>
        mention === "31" ? "kiro" : mention
      ) || ["kiro"];

      return {
        ...article,
        content: newContent,
        summary: newSummary,
        tool_mentions: fixedToolMentions,
      };
    }
    return article;
  });

  if (fixedCount > 0) {
    // Create backup
    const backupPath = newsPath + `.backup-${new Date().toISOString()}`;
    await fs.copyFile(newsPath, backupPath);
    console.log(`Created backup: ${backupPath}`);

    // Write back the fixed articles
    await fs.writeFile(newsPath, JSON.stringify(fixedArticles, null, 2));
    console.log(`Fixed ${fixedCount} Kiro articles`);

    // Regenerate cache
    console.log("Regenerating news cache...");
    const { execSync } = require("child_process");
    execSync("pnpm run cache:news", { stdio: "inherit" });
  } else {
    console.log("No articles needed fixing");
  }
}

// Run the fix
fixKiroNews().catch(console.error);
