/**
 * Admin API: Automated Ingestion Management
 *
 * Endpoints:
 * - GET: List recent ingestion runs with metrics
 * - POST: Manually trigger ingestion run
 */

import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/db/connection";
import { automatedIngestionRuns, type AutomatedIngestionRun } from "@/lib/db/schema";
import {
  AutomatedIngestionService,
  type IngestionResult,
} from "@/lib/services/automated-ingestion.service";
import { loggers } from "@/lib/logger";

/**
 * GET /api/admin/automated-ingestion
 *
 * List recent ingestion runs with all metrics.
 *
 * Query params:
 * - limit: Maximum number of runs to return (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "20", 10), 1), 100);

    // Query recent ingestion runs ordered by created_at DESC
    const runs = await db
      .select()
      .from(automatedIngestionRuns)
      .orderBy(desc(automatedIngestionRuns.createdAt))
      .limit(limit);

    loggers.api.info("[AutomatedIngestion] Listed ingestion runs", {
      count: runs.length,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: runs,
    } as { success: true; data: AutomatedIngestionRun[] });
  } catch (error) {
    loggers.api.error("[AutomatedIngestion] Failed to list runs", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list ingestion runs",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/automated-ingestion
 *
 * Manually trigger an ingestion run.
 *
 * Request body:
 * - dryRun: boolean (optional, default: false) - If true, simulate without saving
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Database connection not available" },
        { status: 503 }
      );
    }

    // Parse request body
    let body: { dryRun?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed, defaults will be used
    }

    const dryRun = body.dryRun ?? false;

    loggers.api.info("[AutomatedIngestion] Manual ingestion triggered", {
      userId,
      dryRun,
    });

    // Use the AutomatedIngestionService to run daily discovery
    const ingestionService = new AutomatedIngestionService();
    const result = await ingestionService.runDailyDiscovery({ dryRun });

    loggers.api.info("[AutomatedIngestion] Ingestion completed", {
      runId: result.runId,
      dryRun,
      articlesIngested: result.articlesIngested,
      status: result.status,
    });

    return NextResponse.json({
      success: true,
      data: result,
    } as { success: true; data: IngestionResult });
  } catch (error) {
    loggers.api.error("[AutomatedIngestion] Ingestion failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ingestion failed",
      },
      { status: 500 }
    );
  }
}
