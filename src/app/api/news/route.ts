import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    // Build the query from news_updates - this is our real news content
    let query = supabase
      .from("news_updates")
      .select("*")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter if not "all" - map to news categories
    if (filter !== "all") {
      const categoryMap: Record<string, string[]> = {
        milestone: ["funding", "acquisition"],
        announcement: ["funding", "product-launch", "acquisition"],
        update: ["technical-achievement", "general"],
        feature: ["product-launch"],
        partnership: ["acquisition", "general"],
      };

      if (categoryMap[filter]) {
        query = query.in("category", categoryMap[filter]);
      }
    }

    const { data: newsItems, error } = await query;

    if (error) {
      loggers.news.error("Error fetching news", { error });
      return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }

    // Transform news_updates data into the expected format
    const transformedNews =
      newsItems?.map((article) => {
        // Map category to event type
        let eventType = "update";
        switch (article.category) {
          case "funding":
            eventType = "milestone";
            break;
          case "acquisition":
            eventType = "announcement";
            break;
          case "product-launch":
            eventType = "feature";
            break;
          case "technical-achievement":
            eventType = "update";
            break;
          default:
            eventType = "announcement";
        }

        // Get the main tool from related_tools array
        const primaryToolId = Array.isArray(article.related_tools)
          ? article.related_tools[0]
          : null;
        const toolNames = Array.isArray(article.related_tools)
          ? article.related_tools
              .map((id: string) => {
                // Simple mapping for common tool IDs to display names
                const toolNameMap: Record<string, string> = {
                  cursor: "Cursor",
                  devin: "Devin",
                  "claude-code": "Claude Code",
                  "github-copilot": "GitHub Copilot",
                  "chatgpt-canvas": "ChatGPT Canvas",
                  "openai-codex-cli": "OpenAI Codex CLI",
                  "augment-code": "Augment Code",
                  "google-jules": "Google Jules",
                  lovable: "Lovable",
                  "bolt-new": "Bolt.new",
                  windsurf: "Windsurf",
                  zed: "Zed",
                  tabnine: "Tabnine",
                  "replit-agent": "Replit Agent",
                  "amazon-q-developer": "Amazon Q Developer",
                };
                return toolNameMap[id] || id;
              })
              .join(", ")
          : "Various Tools";

        return {
          id: article.id,
          tool_id: primaryToolId || "unknown",
          tool_name: toolNames,
          tool_category: "ai-coding-tool",
          tool_website: "",
          event_date: article.published_at || article.created_at,
          event_type: eventType,
          title: article.title,
          description: article.summary || article.title,
          source_url: article.url,
          source_name: article.source || "AI News",
          metrics: {
            importance_score: article.importance_score || 5,
          },
          tags: [article.category, ...(article.related_tools || [])],
        };
      }) || [];

    return NextResponse.json({
      news: transformedNews,
      total: transformedNews.length,
      hasMore: transformedNews.length === limit,
    });
  } catch (error) {
    loggers.news.error("News API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
