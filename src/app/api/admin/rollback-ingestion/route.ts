import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getNewsRepo, getToolsRepo, getCompaniesRepo } from "@/lib/json-db";

// @ts-expect-error - Type definition for future use
interface _RollbackResult {
  success: boolean;
  report: {
    ingestion_report_id: string;
    filename: string;
    deleted_news_items: number;
    removed_tools: number;
    removed_companies: number;
    rollback_log: string;
    errors: any[];
    warnings: any[];
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { ingestion_report_id, confirm_rollback = false } = await request.json();

    if (!ingestion_report_id) {
      return NextResponse.json({ error: "Ingestion report ID is required" }, { status: 400 });
    }

    if (!confirm_rollback) {
      return NextResponse.json(
        { error: "Rollback must be explicitly confirmed with confirm_rollback: true" },
        { status: 400 }
      );
    }

    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    // Get the ingestion report
    const ingestionReport = await newsRepo.getIngestionReportById(ingestion_report_id);

    if (!ingestionReport) {
      return NextResponse.json({ error: "Ingestion report not found" }, { status: 404 });
    }

    const report = {
      ingestion_report_id,
      filename: ingestionReport.filename,
      deleted_news_items: 0,
      removed_tools: 0,
      removed_companies: 0,
      rollback_log: `Starting rollback for ingestion: ${ingestionReport.filename}\n`,
      errors: [] as any[],
      warnings: [] as any[],
    };

    // Step 1: Delete news items that were created during this ingestion
    const ingestedNewsIds = ingestionReport.ingested_news_ids || [];

    for (const newsId of ingestedNewsIds) {
      try {
        const deleted = await newsRepo.delete(newsId);
        if (deleted) {
          report.deleted_news_items++;
          report.rollback_log += `Deleted news item: ${newsId}\n`;
        } else {
          report.rollback_log += `News item not found: ${newsId}\n`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        report.errors.push({
          type: "news_deletion",
          id: newsId,
          error: errorMessage,
        });
        report.rollback_log += `Failed to delete news item ${newsId}: ${errorMessage}\n`;
      }
    }

    // Step 2: Handle tools that were created during ingestion
    const createdTools = ingestionReport.created_tools || [];

    for (const toolInfo of createdTools) {
      try {
        // Check if the tool has any news items associated with it (from other sources)
        const relatedNews = await newsRepo.getByToolMention(toolInfo.id);

        if (relatedNews.length > 0) {
          report.warnings.push({
            type: "tool_has_other_news",
            tool: toolInfo,
            message: "Tool has news from other sources, not removing",
          });
          report.rollback_log += `Warning: Tool ${toolInfo.name} has other news references, keeping it\n`;
          continue;
        }

        // For now, we'll warn about removing tools since they might have other data
        // In a full implementation, you'd check rankings and metrics repositories
        report.warnings.push({
          type: "tool_removal_skipped",
          tool: toolInfo,
          message: "Tool removal skipped - manual review required",
        });
        report.rollback_log += `Warning: Tool ${toolInfo.name} removal skipped - manual review required\n`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        report.errors.push({
          type: "tool_removal",
          tool: toolInfo,
          error: errorMessage,
        });
        report.rollback_log += `Failed to remove tool ${toolInfo.name}: ${errorMessage}\n`;
      }
    }

    // Step 3: Handle companies that were created during ingestion
    const createdCompanies = ingestionReport.created_companies || [];

    for (const companyInfo of createdCompanies) {
      try {
        // Check if the company has any tools associated with it
        const allTools = await toolsRepo.getAll();
        const companyTools = allTools.filter((tool) => tool.company_id === companyInfo.id);

        if (companyTools.length > 0) {
          report.warnings.push({
            type: "company_has_tools",
            company: companyInfo,
            message: "Company has tools associated, not removing",
          });
          report.rollback_log += `Warning: Company ${companyInfo.name} has tools, keeping it\n`;
          continue;
        }

        // Safe to delete the company
        const deleted = await companiesRepo.delete(companyInfo.id);
        if (deleted) {
          report.removed_companies++;
          report.rollback_log += `Removed company: ${companyInfo.name} (${companyInfo.id})\n`;
        } else {
          report.rollback_log += `Company not found: ${companyInfo.name} (${companyInfo.id})\n`;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        report.errors.push({
          type: "company_removal",
          company: companyInfo,
          error: errorMessage,
        });
        report.rollback_log += `Failed to remove company ${companyInfo.name}: ${errorMessage}\n`;
      }
    }

    // Step 4: Update the ingestion report status
    await newsRepo.updateIngestionReport(ingestion_report_id, {
      status: "failed", // Mark as failed since it was rolled back
      processing_log:
        (ingestionReport.processing_log || "") +
        `\n--- ROLLBACK PERFORMED ---\n${report.rollback_log}`,
    });

    report.rollback_log += `Rollback completed. Summary:\n`;
    report.rollback_log += `- News items deleted: ${report.deleted_news_items}\n`;
    report.rollback_log += `- Tools removed: ${report.removed_tools}\n`;
    report.rollback_log += `- Companies removed: ${report.removed_companies}\n`;
    report.rollback_log += `- Errors: ${report.errors.length}\n`;
    report.rollback_log += `- Warnings: ${report.warnings.length}\n`;

    loggers.api.info("Ingestion rollback completed", {
      ingestion_report_id,
      filename: report.filename,
      deleted_news: report.deleted_news_items,
      removed_tools: report.removed_tools,
      removed_companies: report.removed_companies,
      errors: report.errors.length,
      warnings: report.warnings.length,
    });

    return NextResponse.json({
      success: true,
      message: `Rollback completed for ${report.filename}`,
      report,
    });
  } catch (error) {
    loggers.api.error("Failed to rollback ingestion:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview what would be rolled back
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const ingestionReportId = searchParams.get("id");

    if (!ingestionReportId) {
      return NextResponse.json({ error: "Ingestion report ID is required" }, { status: 400 });
    }

    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();

    // Get the ingestion report
    const ingestionReport = await newsRepo.getIngestionReportById(ingestionReportId);

    if (!ingestionReport) {
      return NextResponse.json({ error: "Ingestion report not found" }, { status: 404 });
    }

    const preview = {
      filename: ingestionReport.filename,
      news_items_to_delete: (ingestionReport.ingested_news_ids || []).length,
      tools_to_review: (ingestionReport.created_tools || []).length,
      companies_to_review: (ingestionReport.created_companies || []).length,
      created_tools: ingestionReport.created_tools || [],
      created_companies: ingestionReport.created_companies || [],
      warnings: [] as any[],
    };

    // Check each created tool for dependencies
    for (const toolInfo of preview.created_tools) {
      try {
        const relatedNews = await newsRepo.getByToolMention(toolInfo.id);

        // For preview, assume tools with news should be kept
        if (relatedNews.length > 0) {
          preview.warnings.push({
            type: "tool",
            name: toolInfo.name,
            reason: "Has news references - will be kept",
            dependencies: {
              news: relatedNews.length,
              metrics: 0, // Would need metrics repository to check
              rankings: 0, // Would need rankings repository to check
            },
          });
        }
      } catch (_error) {
        // Continue with other tools if one fails
      }
    }

    // Check each created company for dependencies
    for (const companyInfo of preview.created_companies) {
      try {
        const allTools = await toolsRepo.getAll();
        const companyTools = allTools.filter((tool) => tool.company_id === companyInfo.id);

        if (companyTools.length > 0) {
          preview.warnings.push({
            type: "company",
            name: companyInfo.name,
            reason: "Has tools associated - will be kept",
            dependencies: {
              tools: companyTools.length,
            },
          });
        }
      } catch (_error) {
        // Continue with other companies if one fails
      }
    }

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error) {
    loggers.api.error("Failed to generate rollback preview:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
