import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import { CacheManager, CacheType } from "@/lib/cache/cache-manager";

// Extended cache type for "all" option
type ExtendedCacheType = CacheType | "all";

interface CacheGenerationResult {
  type: CacheType;
  success: boolean;
  error?: string;
  dataSize?: number;
  timestamp: string;
}

// Helper function to get news-enhanced rankings
async function generateRankingsCache() {
  try {
    // Get the current rankings data using the same logic as the rankings API
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

// Helper function to generate tools cache
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

// Helper function to generate news cache
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

export async function POST(request: NextRequest) {
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

    // Get cache type from request body
    const body = await request.json();
    const cacheType = (body.type || "all") as ExtendedCacheType;
    
    // Initialize cache manager
    const cacheManager = new CacheManager();

    const results: CacheGenerationResult[] = [];

    // Generate caches based on type
    if (cacheType === "rankings" || cacheType === "all") {
      try {
        const rankingsData = await generateRankingsCache();
        const dataSize = JSON.stringify(rankingsData).length;
        
        // Store in cache (blob in production, filesystem in dev)
        await cacheManager.put("rankings", rankingsData);
        
        results.push({
          type: "rankings",
          success: true,
          dataSize,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          type: "rankings",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (cacheType === "tools" || cacheType === "all") {
      try {
        const toolsData = await generateToolsCache();
        const dataSize = JSON.stringify(toolsData).length;
        
        // Store in cache (blob in production, filesystem in dev)
        await cacheManager.put("tools", toolsData);
        
        results.push({
          type: "tools",
          success: true,
          dataSize,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          type: "tools",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (cacheType === "news" || cacheType === "all") {
      try {
        const newsData = await generateNewsCache();
        const dataSize = JSON.stringify(newsData).length;
        
        // Store in cache (blob in production, filesystem in dev)
        await cacheManager.put("news", newsData);
        
        results.push({
          type: "news",
          success: true,
          dataSize,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        results.push({
          type: "news",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }

    const isProduction = process.env["NODE_ENV"] === "production";
    const usingBlob = CacheManager.isBlobAvailable();
    
    return NextResponse.json({
      results,
      message: usingBlob
        ? "Cache data generated and stored in Vercel Blob storage."
        : isProduction
        ? "Cache data generated (blob storage not configured)."
        : "Cache data generated and saved to filesystem.",
      storage: {
        type: usingBlob ? "blob" : "filesystem",
        isProduction,
      },
    });
  } catch (error) {
    loggers.api.error("Cache generation error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate cache" },
      { status: 500 }
    );
  }
}