/**
 * Consolidated Debug API
 * 
 * Endpoints for debugging and development
 * - GET: Various debug information based on type parameter
 */

import { type NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
// import { getTranslations } from "@/lib/i18n/server";
// import { supportedLocales } from "@/lib/i18n/config";

const supportedLocales = ["en", "ja", "ko", "zh"];

/**
 * GET /api/debug
 * 
 * Query params:
 * - type: 'env' | 'runtime' | 'static' | 'urls' | 'translations' | 'trending'
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "env";

    switch (type) {
      case "env": {
        // Debug environment variables (replaces debug-env)
        const isProduction = process.env["NODE_ENV"] === "production";
        const hasGithubToken = !!process.env["GITHUB_TOKEN"];
        const hasOpenAIKey = !!process.env["OPENAI_API_KEY"];
        const hasAnthropicKey = !!process.env["ANTHROPIC_API_KEY"];
        
        return NextResponse.json({
          environment: process.env["NODE_ENV"],
          is_production: isProduction,
          has_github_token: hasGithubToken,
          has_openai_key: hasOpenAIKey,
          has_anthropic_key: hasAnthropicKey,
          vercel_env: process.env["VERCEL_ENV"],
          deployment_url: process.env["VERCEL_URL"],
          region: process.env["VERCEL_REGION"],
        });
      }

      case "runtime": {
        // Debug runtime information (replaces debug-runtime)
        const headersList = await headers();
        const host = headersList.get("host");
        const userAgent = headersList.get("user-agent");
        
        return NextResponse.json({
          runtime: "nodejs",
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
          memory: {
            rss: process.memoryUsage().rss,
            heap_total: process.memoryUsage().heapTotal,
            heap_used: process.memoryUsage().heapUsed,
            external: process.memoryUsage().external,
          },
          uptime: process.uptime(),
          host,
          user_agent: userAgent,
          timestamp: new Date().toISOString(),
        });
      }

      case "static": {
        // Debug static file serving (replaces debug-static)
        const fs = await import("fs-extra");
        const path = await import("node:path");
        
        const publicPath = path.join(process.cwd(), "public");
        const staticFiles = [];

        // Check for key static files
        const filesToCheck = [
          "data/rankings.json",
          "data/tools.json",
          "data/news.json",
          "robots.txt",
          "sitemap.xml",
        ];

        for (const file of filesToCheck) {
          const filePath = path.join(publicPath, file);
          const exists = await fs.pathExists(filePath);
          
          if (exists) {
            const stats = await fs.stat(filePath);
            staticFiles.push({
              path: file,
              exists,
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          } else {
            staticFiles.push({
              path: file,
              exists,
              size: 0,
              modified: null,
            });
          }
        }

        return NextResponse.json({
          public_path: publicPath,
          static_files: staticFiles,
        });
      }

      case "urls": {
        // Debug URL configuration (replaces debug-urls)
        const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
        const apiUrl = process.env["NEXT_PUBLIC_API_URL"] || baseUrl;
        
        return NextResponse.json({
          base_url: baseUrl,
          api_url: apiUrl,
          current_url: request.url,
          pathname: new URL(request.url).pathname,
          search_params: Object.fromEntries(searchParams.entries()),
          headers: {
            host: request.headers.get("host"),
            referer: request.headers.get("referer"),
            "user-agent": request.headers.get("user-agent"),
          },
        });
      }

      case "translations": {
        // Debug missing translations (replaces missing-translations)
        const locale = searchParams.get("locale") || "en";
        const missingKeys = [];
        const allKeys = new Set<string>();

        // Check translations for all namespaces
        const namespaces = ["common", "home", "rankings", "tools", "news"];
        
        // Placeholder for translation checking
        // This would need the actual i18n implementation
        for (const ns of namespaces) {
          allKeys.add(`${ns}.placeholder`);
        }

        return NextResponse.json({
          locale,
          supported_locales: supportedLocales,
          total_keys: allKeys.size,
          missing_keys: missingKeys,
          missing_count: missingKeys.length,
        });
      }

      case "trending": {
        // Debug trending calculations (replaces debug-trending)
        const { getRankingsRepo } = await import("@/lib/json-db");
        const rankingsRepo = getRankingsRepo();
        
        // Get recent periods for trending analysis
        const periods = await rankingsRepo.getPeriods();
        const recentPeriods = periods.slice(0, 3); // Last 3 periods
        
        const trendingData = [];
        const periodRankings = new Map();

        // Load rankings for recent periods
        for (const period of recentPeriods) {
          const data = await rankingsRepo.getRankingsForPeriod(period);
          if (data) {
            periodRankings.set(period, data.rankings);
          }
        }

        // Calculate trending scores
        if (periodRankings.size >= 2) {
          const [currentPeriod, previousPeriod] = recentPeriods;
          const currentRankings = periodRankings.get(currentPeriod) || [];
          const previousRankings = periodRankings.get(previousPeriod) || [];
          
          const previousMap = new Map(
            previousRankings.map((r: any) => [r.tool_id, r])
          );

          for (const current of currentRankings) {
            const previous = previousMap.get(current.tool_id);
            
            if (previous) {
              const positionChange = (previous as any).position - (current as any).position;
              const scoreChange = (current as any).score - (previous as any).score;
              
              trendingData.push({
                tool_id: current.tool_id,
                tool_name: current.tool_name,
                current_position: current.position,
                previous_position: previous.position,
                position_change: positionChange,
                score_change: scoreChange,
                trending_score: positionChange * 2 + scoreChange * 10,
              });
            }
          }

          // Sort by trending score
          trendingData.sort((a, b) => b.trending_score - a.trending_score);
        }

        return NextResponse.json({
          periods_analyzed: recentPeriods,
          trending_tools: trendingData.slice(0, 10),
          total_tools: trendingData.length,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown debug type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { 
        error: "Debug operation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}