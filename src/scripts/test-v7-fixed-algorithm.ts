#!/usr/bin/env tsx

/**
 * Test script for the fixed v7 algorithm
 * Verifies that scoring fixes produce expected results
 */

import type { ToolMetricsV7 } from "../lib/ranking-algorithm-v7-fixed";
import { RankingEngineV7 } from "../lib/ranking-algorithm-v7-fixed";

// Test tools with expected scores
const testTools: Array<{ tool: ToolMetricsV7; expected: Record<string, number> }> = [
  {
    tool: {
      tool_id: "claude-code",
      name: "Claude Code",
      category: "autonomous-agent",
      status: "active",
      info: {
        features: [
          "Specification-driven development",
          "Autonomous task execution",
          "Multi-file support",
          "Planning and reasoning",
          "Workflow orchestration",
        ],
        summary: "Anthropic's official CLI for autonomous coding with Claude",
        description:
          "A specification-driven development tool that enables autonomous task execution and multi-step workflows",
        technical: {
          context_window: 200000,
          multi_file_support: true,
          language_support: [
            "Python",
            "JavaScript",
            "TypeScript",
            "Go",
            "Java",
            "C++",
            "Ruby",
            "PHP",
            "Swift",
            "Rust",
          ],
          llm_providers: ["Anthropic"],
        },
        metrics: {
          swe_bench: {
            lite: 47.4,
          },
          news_mentions: 3,
        },
      },
    },
    expected: {
      agenticCapability: 85, // High - true autonomous agent
      innovation: 75, // High - specification-driven is innovative
      technicalPerformance: 92, // Very high - 47.4% SWE-bench is excellent
    },
  },
  {
    tool: {
      tool_id: "github-copilot",
      name: "GitHub Copilot",
      category: "ide-assistant",
      status: "active",
      info: {
        features: [
          "Code completion",
          "Inline suggestions",
          "Comment-to-code",
          "Unit test generation",
        ],
        summary: "GitHub's AI pair programmer",
        description: "AI-powered code completion and suggestion tool",
        technical: {
          context_window: 8192,
          multi_file_support: false,
          language_support: ["Python", "JavaScript", "TypeScript", "Go", "Java"],
          llm_providers: ["OpenAI"],
        },
        metrics: {
          news_mentions: 20,
          users: 1000000,
          monthly_arr: 480000000,
        },
      },
    },
    expected: {
      agenticCapability: 50, // Lower - autocomplete focused
      innovation: 45, // Moderate
      technicalPerformance: 40, // Lower - smaller context, no SWE-bench
    },
  },
  {
    tool: {
      tool_id: "cursor",
      name: "Cursor",
      category: "code-editor",
      status: "active",
      info: {
        features: [
          "AI-native code editor",
          "Multi-file editing",
          "Codebase understanding",
          "Chat interface",
        ],
        summary: "The AI-first code editor",
        description: "AI-native code editor with deep codebase understanding",
        technical: {
          context_window: 200000,
          multi_file_support: true,
          language_support: ["Python", "JavaScript", "TypeScript", "Go", "Java", "C++", "Ruby"],
          llm_providers: ["OpenAI", "Anthropic"],
        },
        metrics: {
          swe_bench: {
            lite: 33.7,
          },
          news_mentions: 15,
          monthly_arr: 120000000,
        },
      },
    },
    expected: {
      agenticCapability: 70, // Good - agentic editor
      innovation: 60, // Good
      technicalPerformance: 80, // Good - 33.7% SWE-bench
    },
  },
];

function runTests() {
  console.log("Testing v7 Fixed Algorithm\n");
  console.log("=".repeat(80));

  const engine = new RankingEngineV7();

  testTools.forEach(({ tool, expected }) => {
    console.log(`\nTesting: ${tool.name} (${tool.category})`);
    console.log("-".repeat(40));

    const score = engine.calculateToolScore(tool, new Date("2025-07-22"));

    // Check specific factors
    Object.entries(expected).forEach(([factor, expectedScore]) => {
      const actualScore = score.factorScores[factor];
      const diff = Math.abs(actualScore - expectedScore);
      const status = diff <= 5 ? "✅" : "❌"; // Allow 5 point tolerance

      console.log(`${factor}: ${actualScore.toFixed(1)} (expected: ${expectedScore}) ${status}`);
    });

    console.log(`\nOverall Score: ${score.overallScore.toFixed(1)}`);

    // Show all factor scores
    console.log("\nAll Factor Scores:");
    Object.entries(score.factorScores).forEach(([factor, value]) => {
      if (typeof value === "number" && value > 0) {
        console.log(`  ${factor}: ${value.toFixed(1)}`);
      }
    });
  });

  // Compare rankings
  console.log("\n" + "=".repeat(80));
  console.log("\nRankings Comparison:");
  console.log("-".repeat(40));

  const allScores = testTools.map(({ tool }) => {
    const score = engine.calculateToolScore(tool, new Date("2025-07-22"));
    return {
      name: tool.name,
      category: tool.category,
      overallScore: score.overallScore,
      agenticCapability: score.factorScores.agenticCapability,
      innovation: score.factorScores.innovation,
      technicalPerformance: score.factorScores.technicalPerformance,
    };
  });

  // Sort by overall score
  allScores.sort((a, b) => b.overallScore - a.overallScore);

  console.log("\nRankings by Overall Score:");
  allScores.forEach((tool, index) => {
    console.log(
      `${index + 1}. ${tool.name}: ${tool.overallScore.toFixed(1)} ` +
        `(Agentic: ${tool.agenticCapability}, Innovation: ${tool.innovation}, Technical: ${tool.technicalPerformance})`
    );
  });

  // Verify key relationships
  console.log("\n" + "=".repeat(80));
  console.log("\nKey Relationships Verification:");
  console.log("-".repeat(40));

  const claudeCode = allScores.find((s) => s.name === "Claude Code");
  const copilot = allScores.find((s) => s.name === "GitHub Copilot");
  const cursor = allScores.find((s) => s.name === "Cursor");

  if (claudeCode && copilot) {
    const agenticDiff = claudeCode.agenticCapability - copilot.agenticCapability;
    console.log(
      `Claude Code vs Copilot (Agentic): ${agenticDiff.toFixed(1)} point difference ` +
        `${agenticDiff > 30 ? "✅" : "❌"} (should be >30)`
    );
  }

  if (claudeCode && cursor) {
    const techDiff = claudeCode.technicalPerformance - cursor.technicalPerformance;
    console.log(
      `Claude Code vs Cursor (Technical): ${techDiff.toFixed(1)} point difference ` +
        `${techDiff > 10 ? "✅" : "❌"} (should be >10)`
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log("\nAlgorithm Info:");
  console.log(JSON.stringify(RankingEngineV7.getAlgorithmInfo(), null, 2));
}

// Run the tests
runTests();
