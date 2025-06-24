import { NextResponse } from "next/server";
import { payloadDirect, getPayloadClient } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function POST(): Promise<NextResponse> {
  try {
    console.log('Creating test news data...');
    
    // Get tools first
    const toolsResponse = await payloadDirect.getTools({ limit: 50 });
    const tools = toolsResponse.docs;
    
    // Create a map of tool slugs to IDs
    const toolMap = new Map();
    tools.forEach((tool: any) => {
      toolMap.set(tool['slug'], tool['id']);
      if (tool['supabase_tool_id']) {
        toolMap.set(tool['supabase_tool_id'], tool['id']);
      }
    });
    
    const newsItems = [
      {
        headline: "Claude Code Launches Revolutionary AI Pair Programming Features",
        slug: "claude-code-launches-ai-pair-programming",
        summary: [
          {
            children: [{ text: "Anthropic announces major updates to Claude Code, introducing advanced pair programming capabilities and improved code understanding." }]
          }
        ],
        published_at: new Date("2025-06-20").toISOString(),
        source: "TechCrunch",
        source_url: "https://example.com/claude-code-update",
        category: "product-launch",
        impact_level: "high",
        tags: ["claude-code", "ai-coding", "anthropic"],
        related_tools: [toolMap.get('claude-code')].filter(Boolean)
      },
      {
        headline: "Cursor Raises $60M Series B to Accelerate AI IDE Development",
        slug: "cursor-raises-60m-series-b",
        summary: [
          {
            children: [{ text: "Cursor secures significant funding to expand its AI-powered IDE capabilities and grow its engineering team." }]
          }
        ],
        published_at: new Date("2025-06-15").toISOString(),
        source: "VentureBeat",
        source_url: "https://example.com/cursor-funding",
        category: "funding",
        impact_level: "high",
        tags: ["cursor", "funding", "series-b"],
        related_tools: [toolMap.get('cursor')].filter(Boolean)
      },
      {
        headline: "Devin AI Achieves New Milestone in Autonomous Coding",
        slug: "devin-ai-autonomous-coding-milestone",
        summary: [
          {
            children: [{ text: "Cognition Labs' Devin AI successfully completes complex software projects autonomously, marking a significant advancement in AI coding capabilities." }]
          }
        ],
        published_at: new Date("2025-06-10").toISOString(),
        source: "The Information",
        source_url: "https://example.com/devin-milestone",
        category: "technical-achievement",
        impact_level: "medium",
        tags: ["devin", "autonomous-coding", "cognition-labs"],
        related_tools: [toolMap.get('devin')].filter(Boolean)
      }
    ];
    
    const created = [];
    const payload = await getPayloadClient();
    
    for (const newsItem of newsItems) {
      try {
        const result = await payload.create({
          collection: 'news',
          data: newsItem
        });
        created.push(result);
        loggers.api.info(`Created news: ${newsItem.headline}`);
      } catch (error) {
        loggers.api.error(`Failed to create news: ${newsItem.headline}`, { error });
      }
    }
    
    return NextResponse.json({ 
      message: "Test news created",
      created: created.length,
      items: created.map(n => ({ id: n.id, headline: n.headline }))
    });
  } catch (error) {
    loggers.api.error("Error creating test news", { error });
    return NextResponse.json({ error: "Failed to create test news" }, { status: 500 });
  }
}