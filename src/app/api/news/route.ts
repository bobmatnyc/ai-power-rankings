import { NextRequest, NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    // Calculate page from offset
    const page = Math.floor(offset / limit) + 1;

    // Get news from Payload
    const response = await payloadDirect.getNews({
      limit,
      page,
      sort: '-published_at'
    });
    let newsItems = response.docs;

    // Apply filter if not "all" - map to news categories
    if (filter !== "all") {
      const categoryMap: Record<string, string[]> = {
        milestone: ["funding", "acquisition"],
        announcement: ["funding", "product-launch", "acquisition"],
        update: ["technical-achievement", "general"],
        feature: ["product-launch"],
        partnership: ["acquisition", "general"],
      };

      const filterCategories = categoryMap[filter];
      if (filterCategories) {
        // Filter results based on category mapping
        newsItems = newsItems.filter((item: any) => 
          filterCategories.includes(item.category || 'general')
        );
      }
    }

    // Transform news data into the expected format
    const transformedNews = newsItems?.map((article: any) => {
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
      let primaryToolId = null;
      let toolNames = "Various Tools";
      
      if (Array.isArray(article.related_tools) && article.related_tools.length > 0) {
        // Handle both string IDs and populated objects
        const firstTool = article.related_tools[0];
        primaryToolId = typeof firstTool === 'string' ? firstTool : firstTool?.id;
        
        toolNames = article.related_tools
          .map((tool: any) => {
            const toolId = typeof tool === 'string' ? tool : tool?.id;
            const toolName = typeof tool === 'object' && tool?.name ? tool.name : toolId;
            
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
            
            return toolNameMap[toolId] || toolName || toolId;
          })
          .join(", ");
      }

      // Extract summary text from rich text if needed
      let summary = '';
      if (article.summary && Array.isArray(article.summary)) {
        summary = article.summary
          .map((block: any) => block.children?.map((child: any) => child.text).join(''))
          .join('\n');
      } else if (typeof article.summary === 'string') {
        summary = article.summary;
      }

      // Map tags array or create from category
      const tags = article.tags || [article.category];
      if (article.related_tools && Array.isArray(article.related_tools)) {
        article.related_tools.forEach((tool: any) => {
          const toolId = typeof tool === 'string' ? tool : tool?.id;
          if (toolId) {
            tags.push(toolId);
          }
        });
      }

      return {
        id: article.id,
        tool_id: primaryToolId || "unknown",
        tool_name: toolNames,
        tool_category: "ai-coding-tool",
        tool_website: "",
        event_date: article.published_at || article.createdAt,
        event_type: eventType,
        title: article.headline,
        description: summary || article.headline,
        source_url: article.source_url,
        source_name: article.source || "AI News",
        metrics: {
          importance_score: article.impact_level === 'high' ? 8 : article.impact_level === 'medium' ? 5 : 3,
        },
        tags: tags,
      };
    }) || [];

    return NextResponse.json({
      news: transformedNews,
      total: response.totalDocs,
      hasMore: response.hasNextPage,
    });
  } catch (error) {
    loggers.news.error("News API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}