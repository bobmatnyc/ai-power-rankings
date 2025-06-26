import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import { CacheManager, CacheType } from "@/lib/cache/cache-manager";

// Helper functions (same as in generate route)
async function generateRankingsCache() {
  try {
    const response = await fetch(
      `${process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000"}/api/rankings`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rankings: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    loggers.api.error("Failed to generate rankings cache", { error });
    throw error;
  }
}

async function generateToolsCache() {
  try {
    const toolsResponse = await payloadDirect.getTools({
      limit: 1000,
      sort: "name",
    });

    if (!toolsResponse || !toolsResponse.docs) {
      throw new Error("Failed to fetch tools from Payload");
    }

    const tools = toolsResponse.docs.map((tool: any) => ({
      id: tool.id,
      slug: tool.slug || tool.id,
      name: tool.display_name || tool.name,
      category: tool.category,
      status: tool.status,
      website_url: tool.website_url,
      description: tool.description,
      company: tool.company,
      info: tool.info,
      created_at: tool.createdAt,
      updated_at: tool.updatedAt,
    }));

    return {
      tools,
      total: tools.length,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    loggers.api.error("Failed to generate tools cache", { error });
    throw error;
  }
}

async function generateNewsCache() {
  try {
    const newsResponse = await payloadDirect.getNews({
      limit: 1000,
      sort: "-published_at",
    });

    if (!newsResponse || !newsResponse.docs) {
      throw new Error("Failed to fetch news from Payload");
    }

    const news = newsResponse.docs.map((article: any) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      published_at: article.published_at,
      source: article.source,
      url: article.url,
      impact_level: article.impact_level,
      related_tools: article.related_tools,
      tags: article.tags,
      description: article.description,
    }));

    return {
      news,
      total: news.length,
      generated_at: new Date().toISOString(),
    };
  } catch (error) {
    loggers.api.error("Failed to generate news cache", { error });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = session.user.email === "bob@matsuoka.com";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Get cache type from URL params
    const { searchParams } = new URL(request.url);
    const cacheType = searchParams.get("type") || "all";

    if (cacheType === "all") {
      return NextResponse.json(
        { error: "Please download individual cache files" },
        { status: 400 }
      );
    }

    if (!(["rankings", "tools", "news"] as const).includes(cacheType as any)) {
      return NextResponse.json(
        { error: "Invalid cache type. Use: rankings, tools, or news" },
        { status: 400 }
      );
    }

    const validCacheType = cacheType as CacheType;
    const cacheManager = new CacheManager();
    
    // Try to get from cache first (blob or filesystem)
    let data = await cacheManager.get(validCacheType);
    
    // If not in cache, generate fresh data
    if (!data) {
      switch (validCacheType) {
        case "rankings":
          data = await generateRankingsCache();
          break;
        case "tools":
          data = await generateToolsCache();
          break;
        case "news":
          data = await generateNewsCache();
          break;
      }
    }
    
    const filename = `${validCacheType}.json`;

    // Return the JSON file as a download
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    loggers.api.error("Cache download error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to download cache" },
      { status: 500 }
    );
  }
}