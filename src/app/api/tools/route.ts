import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import { loadCacheWithFallback } from "@/lib/cache/load-cache";
import { CacheManager } from "@/lib/cache/cache-manager";

export async function GET(): Promise<NextResponse> {
  try {
    // Check if we should use cache-first approach
    // Temporarily enabled for production due to database stability issues
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
        tools: cachedToolsData.tools,
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

    // For production, try to get live data
    const response = await payloadDirect.getTools({
      sort: "name",
      limit: 1000, // Get all tools
    });
    const tools = response.docs;

    if (!tools) {
      loggers.api.error("No tools found, falling back to cached data");

      // Fall back to cached data
      const cachedToolsData = await loadCacheWithFallback("tools");
      const cacheInfo = await new CacheManager().getInfo("tools");

      const apiResponse = NextResponse.json({
        tools: cachedToolsData.tools,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Database connection unavailable",
        _cacheSource: cacheInfo.source,
      });

      apiResponse.headers.set(
        "Cache-Control",
        "public, s-maxage=3600, stale-while-revalidate=1800"
      );
      return apiResponse;
    }

    // Transform tools to match expected format with info structure
    const toolsWithInfo = tools.map((tool: any) => {
      // Handle company - it might be populated or just an ID
      const companyName =
        typeof tool["company"] === "object" && tool["company"] ? tool["company"]["name"] : "";

      // Extract description text from rich text if needed
      let description = "";
      if (tool["description"] && Array.isArray(tool["description"])) {
        description = tool["description"]
          .map((block: any) => block.children?.map((child: any) => child.text).join(""))
          .join("\n");
      } else if (typeof tool["description"] === "string") {
        description = tool["description"];
      }

      return {
        ...tool,
        info: {
          company: { name: companyName },
          product: {
            description: description,
            tagline: tool["tagline"],
            pricing_model: tool["pricing_model"],
            license_type: tool["license_type"],
          },
          links: {
            website: tool["website_url"],
            github: tool["github_repo"],
          },
          metadata: {
            logo_url: tool["logo_url"],
          },
        },
      };
    });

    const apiResponse = NextResponse.json({ tools: toolsWithInfo });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=3600, stale-while-revalidate=1800"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.api.error("Error in tools API", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
