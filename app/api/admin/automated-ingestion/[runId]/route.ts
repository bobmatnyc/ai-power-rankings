/**
 * Admin API: Automated Ingestion Run Details
 *
 * Endpoints:
 * - GET: Get detailed information about a specific ingestion run
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/db/connection";
import { automatedIngestionRuns, type AutomatedIngestionRun } from "@/lib/db/schema";
import { loggers } from "@/lib/logger";

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{
    runId: string;
  }>;
}

/**
 * GET /api/admin/automated-ingestion/[runId]
 *
 * Get full details of a specific ingestion run including error_log and ingested_article_ids.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
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

    // Get runId from params (Next.js 15 async params)
    const { runId } = await params;

    // Validate runId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(runId)) {
      return NextResponse.json(
        { success: false, error: "Invalid run ID format" },
        { status: 400 }
      );
    }

    // Query the specific run
    const runs = await db
      .select()
      .from(automatedIngestionRuns)
      .where(eq(automatedIngestionRuns.id, runId))
      .limit(1);

    if (runs.length === 0) {
      return NextResponse.json(
        { success: false, error: "Ingestion run not found" },
        { status: 404 }
      );
    }

    const run = runs[0];

    loggers.api.info("[AutomatedIngestion] Retrieved run details", {
      runId,
      status: run.status,
    });

    return NextResponse.json({
      success: true,
      data: run,
    } as { success: true; data: AutomatedIngestionRun });
  } catch (error) {
    loggers.api.error("[AutomatedIngestion] Failed to get run details", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get run details",
      },
      { status: 500 }
    );
  }
}
