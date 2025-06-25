import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Mock data that matches the expected structure
const mockRankings = [
  {
    rank: 1,
    previousRank: 2,
    rankChange: 1,
    tool: {
      id: "claude-code",
      slug: "claude-code",
      name: "Claude Code",
      category: "ide-assistant",
      status: "active",
      website_url: "https://claude.ai",
      description: "AI coding assistant",
    },
    scores: {
      overall: 95,
      agentic_capability: 9.5,
      innovation: 9.0,
    },
    metrics: {
      users: 50000,
      swe_bench_score: 85,
    },
  },
  {
    rank: 2,
    previousRank: 1,
    rankChange: -1,
    tool: {
      id: "cursor",
      slug: "cursor",
      name: "Cursor",
      category: "code-editor",
      status: "active",
      website_url: "https://cursor.sh",
      description: "AI-powered code editor",
    },
    scores: {
      overall: 93,
      agentic_capability: 9.3,
      innovation: 8.8,
    },
    metrics: {
      users: 45000,
      swe_bench_score: 82,
    },
  },
  {
    rank: 3,
    previousRank: 3,
    rankChange: 0,
    tool: {
      id: "github-copilot",
      slug: "github-copilot",
      name: "GitHub Copilot",
      category: "ide-assistant",
      status: "active",
      website_url: "https://github.com/features/copilot",
      description: "AI pair programmer",
    },
    scores: {
      overall: 90,
      agentic_capability: 8.5,
      innovation: 8.0,
    },
    metrics: {
      users: 100000,
      swe_bench_score: 78,
    },
  },
];

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    rankings: mockRankings,
    debug: {
      source: "static-mock-data",
      timestamp: new Date().toISOString(),
      message: "This is static test data to verify the API endpoint is working",
    },
  });
}
