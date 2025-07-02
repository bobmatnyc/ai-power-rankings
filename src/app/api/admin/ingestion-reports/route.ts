import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getNewsRepo } from "@/lib/json-db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const status = searchParams.get("status") || undefined;

    const newsRepo = getNewsRepo();

    // Get reports with optional status filter and limit
    const reports = await newsRepo.getIngestionReports(status, limit);

    // Get summary statistics
    const stats = await newsRepo.getIngestionReportStats();

    // Calculate totals from returned reports
    let _totalItemsProcessed = 0;
    let _totalToolsCreated = 0;
    let _totalCompaniesCreated = 0;
    let totalNewsItems = 0;

    for (const report of reports) {
      _totalItemsProcessed += report.processed_items || 0;
      _totalToolsCreated += report.new_tools_created || 0;
      _totalCompaniesCreated += report.new_companies_created || 0;
      totalNewsItems += report.total_items || 0;
    }

    return NextResponse.json({
      success: true,
      reports: reports.map((report) => ({
        id: report.id,
        filename: report.filename,
        status: report.status,
        total_items: report.total_items,
        processed_items: report.processed_items,
        failed_items: report.failed_items,
        duplicate_items: report.duplicate_items,
        new_tools_created: report.new_tools_created,
        new_companies_created: report.new_companies_created,
        ranking_preview_generated: report.ranking_preview_generated,
        processing_duration: report.processing_duration,
        file_size: report.file_size,
        created_at: report.created_at,
        updated_at: report.updated_at,
      })),
      pagination: {
        total: reports.length,
        limit,
        has_more: false, // Simplified since we're getting all filtered results
      },
      summary: {
        total_reports: stats.total,
        completed_reports: stats.completed,
        failed_reports: stats.failed,
        partial_reports: stats.partial,
        total_items_processed: stats.total_items_processed,
        total_tools_created: stats.total_tools_created,
        total_companies_created: stats.total_companies_created,
        total_news_items: totalNewsItems,
      },
    });
  } catch (error) {
    loggers.api.error("Failed to fetch ingestion reports:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { report_id } = await request.json();

    if (!report_id) {
      return NextResponse.json({ error: "Report ID is required" }, { status: 400 });
    }

    const newsRepo = getNewsRepo();

    const deleted = await newsRepo.deleteIngestionReport(report_id);

    if (!deleted) {
      return NextResponse.json({ error: "Ingestion report not found" }, { status: 404 });
    }

    loggers.api.info("Deleted ingestion report", { report_id });

    return NextResponse.json({
      success: true,
      message: "Ingestion report deleted successfully",
    });
  } catch (error) {
    loggers.api.error("Failed to delete ingestion report:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
