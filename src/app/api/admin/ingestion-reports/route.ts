import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    
    const payload = await getPayload({ config });
    
    // Build query conditions
    const whereConditions: any = {};
    if (status) {
      whereConditions.status = { equals: status };
    }
    
    const { docs: reports, totalDocs } = await payload.find({
      collection: "news-ingestion-reports",
      where: whereConditions,
      limit,
      sort: "-createdAt",
    });

    // Get summary statistics
    const { totalDocs: totalReports } = await payload.find({
      collection: "news-ingestion-reports",
      limit: 0,
    });

    const { totalDocs: completedReports } = await payload.find({
      collection: "news-ingestion-reports",
      where: { status: { equals: 'completed' } },
      limit: 0,
    });

    const { totalDocs: failedReports } = await payload.find({
      collection: "news-ingestion-reports",
      where: { status: { equals: 'failed' } },
      limit: 0,
    });

    const { totalDocs: partialReports } = await payload.find({
      collection: "news-ingestion-reports",
      where: { status: { equals: 'partial' } },
      limit: 0,
    });

    // Calculate totals from all reports
    let totalItemsProcessed = 0;
    let totalToolsCreated = 0;
    let totalCompaniesCreated = 0;
    let totalNewsItems = 0;

    for (const report of reports) {
      totalItemsProcessed += report['processed_items'] || 0;
      totalToolsCreated += report['new_tools_created'] || 0;
      totalCompaniesCreated += report['new_companies_created'] || 0;
      totalNewsItems += report['total_items'] || 0;
    }

    return NextResponse.json({
      success: true,
      reports: reports.map(report => ({
        id: report.id,
        filename: report['filename'],
        status: report['status'],
        total_items: report['total_items'],
        processed_items: report['processed_items'],
        failed_items: report['failed_items'],
        duplicate_items: report['duplicate_items'],
        new_tools_created: report['new_tools_created'],
        new_companies_created: report['new_companies_created'],
        ranking_preview_generated: report['ranking_preview_generated'],
        processing_duration: report['processing_duration'],
        file_size: report['file_size'],
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      })),
      pagination: {
        total: totalDocs,
        limit,
        has_more: totalDocs > limit,
      },
      summary: {
        total_reports: totalReports,
        completed_reports: completedReports,
        failed_reports: failedReports,
        partial_reports: partialReports,
        total_items_processed: totalItemsProcessed,
        total_tools_created: totalToolsCreated,
        total_companies_created: totalCompaniesCreated,
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
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config });
    
    await payload.delete({
      collection: "news-ingestion-reports",
      id: report_id,
    });

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