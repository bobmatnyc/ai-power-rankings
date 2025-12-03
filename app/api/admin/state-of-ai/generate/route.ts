/**
 * Admin API: Generate State of AI Editorial Summary
 *
 * POST /api/admin/state-of-ai/generate
 * - Generates State of AI editorial for specified month/year
 * - Defaults to current month if not specified
 * - Requires admin authentication
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { StateOfAiSummaryService } from "@/lib/services/state-of-ai-summary.service";
import { loggers } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/state-of-ai/generate
 * Generate State of AI editorial summary
 *
 * Body (optional):
 * {
 *   "month": 12,         // 1-12, defaults to current month
 *   "year": 2025,        // defaults to current year
 *   "forceRegenerate": false  // regenerate even if exists
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Require admin authentication
    const adminCheck = await requireAdmin();
    if (adminCheck.error) {
      return adminCheck.error;
    }

    const userId = adminCheck.userId!;

    // 2. Parse request body
    let month: number | undefined;
    let year: number | undefined;
    let forceRegenerate = false;

    try {
      const body = await req.json();
      month = body.month;
      year = body.year;
      forceRegenerate = body.forceRegenerate || false;

      // Validate month/year if provided
      if (month !== undefined && (month < 1 || month > 12)) {
        return NextResponse.json(
          { error: "Month must be between 1 and 12" },
          { status: 400 }
        );
      }

      if (year !== undefined && (year < 2020 || year > 2030)) {
        return NextResponse.json(
          { error: "Year must be between 2020 and 2030" },
          { status: 400 }
        );
      }

      // Both or neither must be provided
      if ((month === undefined) !== (year === undefined)) {
        return NextResponse.json(
          { error: "Both month and year must be provided together, or neither" },
          { status: 400 }
        );
      }
    } catch (error) {
      // Empty body is ok, use defaults
      loggers.api.debug("No request body, using defaults", { error });
    }

    // 3. Generate State of AI summary
    const service = new StateOfAiSummaryService();
    const startTime = Date.now();

    loggers.api.info("Admin generating State of AI editorial", {
      userId,
      month,
      year,
      forceRegenerate,
    });

    const result = await service.generateStateOfAi(
      month,
      year,
      userId,
      forceRegenerate
    );

    const duration = Date.now() - startTime;

    loggers.api.info("State of AI editorial generation complete", {
      userId,
      month: result.summary.month,
      year: result.summary.year,
      isNew: result.isNew,
      durationMs: duration,
      contentLength: result.summary.content.length,
    });

    // 4. Return result
    return NextResponse.json(
      {
        success: true,
        summary: {
          id: result.summary.id,
          month: result.summary.month,
          year: result.summary.year,
          content: result.summary.content,
          generatedAt: result.summary.generatedAt.toISOString(),
          generatedBy: result.summary.generatedBy,
          metadata: result.summary.metadata,
        },
        isNew: result.isNew,
        generationTimeMs: result.generationTimeMs,
      },
      { status: result.isNew ? 201 : 200 }
    );
  } catch (error) {
    loggers.api.error("Failed to generate State of AI editorial", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to generate State of AI editorial",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
