import { NextResponse } from "next/server";
import { CacheManager } from "@/lib/cache/cache-manager";
import { loadCacheWithFallback } from "@/lib/cache/load-cache";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    // Check if we should use cache-first approach
    const useCacheFirst =
      process.env["USE_CACHE_FALLBACK"] === "true" ||
      process.env["VERCEL_ENV"] === "preview" ||
      true; // Enable for all environments temporarily

    // For preview environments, return cached data immediately
    if (useCacheFirst) {
      loggers.api.debug("Using cache-first approach for tools");

      const cachedToolsData = await loadCacheWithFallback("tools");
      const cacheInfo = await new CacheManager().getInfo("tools");

      const apiResponse = NextResponse.json({
        tools: (cachedToolsData as any).tools,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Cache-first approach (database stability mode)",
        _cacheSource: cacheInfo.source,
      });

      apiResponse.headers.set(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=1800"
      );
      return apiResponse;
    }

    // Get tools from JSON database
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    const tools = await toolsRepo.getAll();

    // Filter out deprecated tools
    const activeTools = tools.filter((tool) => tool.status !== "deprecated");

    // Sort by name
    activeTools.sort((a, b) => a.name.localeCompare(b.name));

    // Transform tools to match expected format with info structure
    const toolsWithInfo = await Promise.all(
      activeTools.map(async (tool) => {
        // Get company name
        let companyName = "";
        if (tool.company_id) {
          const company = await companiesRepo.getById(tool.company_id);
          if (company) {
            companyName = company.name;
          }
        }

        return {
          ...tool,
          // Tool already has info structure from JSON database
          company_name: companyName, // Add for backward compatibility
        };
      })
    );

    const apiResponse = NextResponse.json({
      tools: toolsWithInfo,
      _source: "json-db",
    });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env["NODE_ENV"] === "production"
        ? "public, s-maxage=3600, stale-while-revalidate=1800"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.api.error("Error in tools API", { error });

    // Fall back to cached data on error
    try {
      const cachedToolsData = await loadCacheWithFallback("tools");
      const cacheInfo = await new CacheManager().getInfo("tools");

      const apiResponse = NextResponse.json({
        tools: (cachedToolsData as any).tools,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Database error fallback",
        _cacheSource: cacheInfo.source,
      });

      apiResponse.headers.set(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=1800"
      );
      return apiResponse;
    } catch (cacheError) {
      loggers.api.error("Cache fallback also failed", { cacheError });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
}
