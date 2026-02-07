/**
 * API Route: What's New Monthly Summary
 * GET: Retrieve cached summary or generate if stale
 * POST: Force regeneration (admin only)
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { WhatsNewSummaryService } from "@/lib/services/whats-new-summary.service";
import { loggers } from "@/lib/logger";

// Runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60 seconds for LLM regeneration

/**
 * GET /api/whats-new/summary
 * Retrieve monthly summary (cached or generate)
 *
 * Fast-path: Returns cached summary instantly without hash validation
 * Full generation only runs if no cache exists
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || undefined; // YYYY-MM format

    loggers.api.info("Fetching monthly summary", { period: period || "current" });

    const summaryService = new WhatsNewSummaryService();

    // Fast-path: Try to get cached summary first (no hash validation)
    const cachedSummary = await summaryService.getCachedSummary(period);

    if (cachedSummary) {
      loggers.api.info("Returning cached summary (fast-path)", {
        period: cachedSummary.period,
        generatedAt: cachedSummary.generatedAt
      });

      return cachedJsonResponse(
        {
          summary: {
            period: cachedSummary.period,
            content: cachedSummary.content,
            generatedAt: cachedSummary.generatedAt,
            metadata: cachedSummary.metadata,
          },
          isNew: false,
          generationTimeMs: 0,
          _timestamp: new Date().toISOString(),
          _cached: true,
        },
        `/api/whats-new/summary?period=${period || "current"}`,
        300 // Cache for 5 minutes
      );
    }

    // No cache exists - run full generation
    loggers.api.info("No cached summary found, generating new", { period: period || "current" });
    const result = await summaryService.generateMonthlySummary(period, false);

    return cachedJsonResponse(
      {
        summary: {
          period: result.summary.period,
          content: result.summary.content,
          generatedAt: result.summary.generatedAt,
          metadata: result.summary.metadata,
        },
        isNew: result.isNew,
        generationTimeMs: result.generationTimeMs,
        _timestamp: new Date().toISOString(),
      },
      `/api/whats-new/summary?period=${period || "current"}`,
      result.isNew ? 3600 : 300 // Cache for 1 hour if new, 5 minutes if cached
    );
  } catch (error) {
    loggers.api.error("Monthly summary API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("Database connection")) {
        return NextResponse.json(
          {
            error: "Database unavailable",
            message: "The database service is currently unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }

      if (error.message.includes("OpenRouter")) {
        return NextResponse.json(
          {
            error: "AI service unavailable",
            message: "The AI summary service is currently unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while generating the summary. Please try again later.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whats-new/summary
 * Force regeneration of monthly summary (admin only)
 */
export async function POST(request: NextRequest) {
  // Admin authentication check
  if (process.env["NODE_ENV"] === "production") {
    try {
      const { userId } = await auth();

      if (!userId) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required for manual regeneration.",
          },
          { status: 401 }
        );
      }

      // Additional admin check (you can customize this)
      // For now, any authenticated user can trigger regeneration
      // In production, you might want to check for specific admin roles
    } catch (error) {
      return NextResponse.json(
        {
          error: "Authentication error",
          message: "Failed to verify authentication.",
        },
        { status: 401 }
      );
    }
  }

  try {
    const body = await request.json();
    const period = body.period || undefined; // YYYY-MM format

    loggers.api.info("Manual regeneration triggered", {
      period: period || "current",
      userId: (await auth()).userId || "development",
    });

    const summaryService = new WhatsNewSummaryService();
    const result = await summaryService.generateMonthlySummary(period, true);

    return NextResponse.json({
      success: true,
      summary: {
        period: result.summary.period,
        content: result.summary.content,
        generatedAt: result.summary.generatedAt,
        metadata: result.summary.metadata,
      },
      generationTimeMs: result.generationTimeMs,
      _timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Manual regeneration failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Regeneration failed",
        message: "Failed to regenerate summary. Please try again later.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
