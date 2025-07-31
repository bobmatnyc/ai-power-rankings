import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { CacheManager } from "@/lib/cache/cache-manager";
import { companiesCache, newsCache, rankingsCache, toolsCache } from "@/lib/json-db/cache-strategy";

export async function GET() {
  try {
    // Get in-memory cache stats
    const memoryStats = {
      tools: toolsCache.getStats(),
      companies: companiesCache.getStats(),
      rankings: rankingsCache.getStats(),
      news: newsCache.getStats(),
    };

    // Get file cache info
    const cacheManager = new CacheManager();
    const fileCacheInfo = {
      rankings: await cacheManager.getInfo("rankings"),
      tools: await cacheManager.getInfo("tools"),
      news: await cacheManager.getInfo("news"),
    };

    // Get JSON file sizes
    const jsonDataDir = path.join(process.cwd(), "data", "json");
    const fileSizes: Record<string, number> = {};

    try {
      const toolsStats = await fs.stat(path.join(jsonDataDir, "tools.json"));
      fileSizes["tools"] = toolsStats["size"];
    } catch {}

    try {
      const companiesStats = await fs.stat(path.join(jsonDataDir, "companies.json"));
      fileSizes["companies"] = companiesStats["size"];
    } catch {}

    try {
      const newsStats = await fs.stat(path.join(jsonDataDir, "news", "articles.json"));
      fileSizes["news"] = newsStats["size"];
    } catch {}

    // Calculate total memory usage
    const totalMemoryUsage = Object.values(memoryStats).reduce(
      (total, stat) => total + stat["size"],
      0
    );

    // Calculate overall hit rate
    const totalHits = Object.values(memoryStats).reduce(
      (total, stat) => total + stat["totalHits"],
      0
    );
    const totalAccess = Object.values(memoryStats).reduce(
      (total, stat) => total + stat["totalHits"] + stat["totalMisses"],
      0
    );
    const overallHitRate = totalAccess > 0 ? totalHits / totalAccess : 0;

    const response = {
      timestamp: new Date().toISOString(),
      memory: {
        caches: memoryStats,
        totalItems: totalMemoryUsage,
        overallHitRate: `${(overallHitRate * 100).toFixed(2)}%`,
      },
      fileCache: fileCacheInfo,
      fileSizes: {
        ...fileSizes,
        total: Object.values(fileSizes).reduce((sum, size) => sum + size, 0),
      },
      performance: {
        recommendedActions: [] as string[],
      },
    };

    // Add recommendations based on stats
    if (overallHitRate < 0.8) {
      response["performance"]["recommendedActions"].push(
        "Consider increasing cache TTL - hit rate is below 80%"
      );
    }

    if (fileSizes["news"] && fileSizes["news"] > 500 * 1024) {
      response["performance"]["recommendedActions"].push(
        "News file is large (>500KB) - consider chunking"
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch cache statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
