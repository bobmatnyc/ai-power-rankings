import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import type { Tool } from "@/lib/json-db/schemas";
import type { ToolsRepository } from "@/lib/json-db/tools-repository";
import { loggers } from "@/lib/logger";

interface NewsItem {
  title: string;
  summary?: string;
  content?: string;
  url: string;
  source: string;
  author?: string;
  published_at: string;
  category?: string;
  importance_score?: number;
  related_tools?: string[]; // Tool slugs or names
  primary_tool?: string; // Tool slug or name
  sentiment?: number;
  key_topics?: string[];
  is_featured?: boolean;
  metadata?: Record<string, unknown>;
}

// interface IngestionResult {
//   success: boolean;
//   report: {
//     filename: string;
//     total_items: number;
//     processed_items: number;
//     failed_items: number;
//     duplicate_items: number;
//     new_tools_created: number;
//     new_companies_created: number;
//     processing_log: string;
//     errors: any[];
//     ingested_news_ids: string[];
//     created_tools: any[];
//     created_companies: any[];
//     ranking_changes_preview?: any;
//   };
// }

async function findOrCreateTool(
  toolsRepo: ToolsRepository,
  toolIdentifier: string,
  newsSource: string,
  newsUrl?: string,
  newsContext?: string
): Promise<Tool | null> {
  try {
    const slug = toolIdentifier.toLowerCase().replace(/\s+/g, "-");

    // First try to find by slug
    const toolBySlug = await toolsRepo.getBySlug(slug);
    if (toolBySlug) {
      return toolBySlug;
    }

    // Then try to find by name (search through all tools)
    const allTools = await toolsRepo.getAll();
    const toolByName = allTools.find(
      (tool) => tool.name.toLowerCase() === toolIdentifier.toLowerCase()
    );
    if (toolByName) {
      return toolByName;
    }

    // For now, we'll just log that a tool needs to be created
    // In a full implementation, you might want to create pending tools
    loggers.api.info(`Tool not found, needs manual creation: ${toolIdentifier}`, {
      source: newsSource,
      url: newsUrl,
      context: newsContext,
    });

    return null; // Return null since tool doesn't exist
  } catch (error) {
    loggers.api.error(`Error in findOrCreateTool for ${toolIdentifier}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Initialize repositories
    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const generatePreview = formData.get("generate_preview") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".json")) {
      return NextResponse.json({ error: "File must be a JSON file" }, { status: 400 });
    }

    // Read and parse the JSON file
    const fileContent = await file.text();
    let newsItems: NewsItem[];

    try {
      const parsedData = JSON.parse(fileContent);
      newsItems = Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch (_error) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }

    // Initialize report
    const report = {
      filename: file.name,
      total_items: newsItems.length,
      processed_items: 0,
      failed_items: 0,
      duplicate_items: 0,
      new_tools_created: 0,
      new_companies_created: 0,
      pending_tools_created: 0,
      processing_log: `Started processing ${newsItems.length} news items\n`,
      errors: [] as Array<{ item_index?: number; item_title?: string; article_id?: string; error: string }>,
      ingested_news_ids: [] as string[],
      created_tools: [] as Array<{ id: string; name: string; slug: string }>,
      created_companies: [] as Array<{ id: string; name: string; slug: string }>,
    };

    // Process each news item
    for (let i = 0; i < newsItems.length; i++) {
      const item = newsItems[i];

      if (!item) {
        continue;
      }

      try {
        report.processing_log += `Processing item ${i + 1}: ${item.title}\n`;

        // Add a small delay between items to prevent overwhelming the database
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Check for duplicates by URL
        const allNews = await newsRepo.getAll();
        const existingNews = allNews.find((article) => article.source_url === item.url);

        if (existingNews) {
          report.duplicate_items++;
          report.processing_log += "  - Skipped: duplicate URL\n";
          continue;
        }

        // Process related tools
        const relatedToolIds = [];
        if (item.related_tools) {
          for (const toolIdentifier of item.related_tools) {
            const tool = await findOrCreateTool(
              toolsRepo,
              toolIdentifier,
              item.source,
              item.url,
              `Related tool mentioned in: ${item.title || (item as any)["headline"] || 'Unknown'}`
            );

            // Only add to related tools if tool exists
            if (tool && tool.slug) {
              relatedToolIds.push(tool.id);

              if (!report.created_tools.find(t => t.id === tool.id)) {
                report.created_tools.push({
                  id: tool.id,
                  name: tool.name,
                  slug: tool.slug,
                });
                // Note: not incrementing new_tools_created since we're only finding existing tools
              }
            } else {
              // Tool doesn't exist, log for manual creation
              report.pending_tools_created++;
            }
          }
        }

        // Process primary tool (currently not used in article creation)
        if (item.primary_tool) {
          const primaryTool = await findOrCreateTool(
            toolsRepo,
            item.primary_tool,
            item.source,
            item.url,
            `Primary tool mentioned in: ${item.title || (item as any)["headline"] || 'Unknown'}`
          );

          // Only add to related tools if tool exists
          if (primaryTool && primaryTool.slug) {
            if (!relatedToolIds.includes(primaryTool.id)) {
              relatedToolIds.push(primaryTool.id);
            }

            if (!report.created_tools.find(t => t.id === primaryTool.id)) {
              report.created_tools.push({
                id: primaryTool.id,
                name: primaryTool.name,
                slug: primaryTool.slug,
              });
              // Note: not incrementing new_tools_created since we're only finding existing tools
            }
          } else {
            // Tool doesn't exist, log for manual creation
            report.pending_tools_created++;
          }
        }

        // Create the news item
        const newsArticle = {
          id: crypto.randomUUID(),
          slug: item.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
          title: item.title,
          summary: item.summary,
          content: item.content || "",
          source: item.source,
          source_url: item.url,
          author: item.author,
          published_date: new Date(String(item.published_at)).toISOString(),
          tags: item.key_topics || [],
          tool_mentions: relatedToolIds,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await newsRepo.upsert(newsArticle);

        report.ingested_news_ids.push(newsArticle.id);
        report.processed_items++;
        report.processing_log += `  - Created news item ID: ${newsArticle.id}\n`;
      } catch (error) {
        report.failed_items++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Check if it's a database connection error
        const isDbError =
          errorMessage.includes("db_termination") ||
          errorMessage.includes("connection terminated") ||
          errorMessage.includes("Client has already been released");

        if (isDbError) {
          report.processing_log += `  - Failed: Database connection error - ${errorMessage}\n`;
          loggers.api.error(`Database connection error on item ${i}:`, error);

          // Stop processing remaining items if database is having issues
          report.processing_log += "  - Stopping processing due to database connectivity issues\n";
          break;
        } else {
          report.errors.push({
            item_index: i,
            item_title: item.title,
            error: errorMessage,
          });
          report.processing_log += `  - Failed: ${errorMessage}\n`;
          loggers.api.error(`Error processing news item ${i}:`, error);
        }
      }
    }

    // Generate ranking preview if requested
    let rankingChangesPreview = null;
    if (generatePreview && report.processed_items > 0) {
      try {
        report.processing_log += "Generating ranking preview...\n";

        // TODO: Implement preview ranking calculation with JSON repositories
        // This would involve re-running the ranking algorithm with the new data
        // and comparing against current rankings

        rankingChangesPreview = {
          message: "Ranking preview calculation not yet implemented for JSON repositories",
          potentially_affected_tools: report.created_tools.length,
        };

        report.processing_log += "Ranking preview generated\n";
      } catch (error) {
        report.processing_log += `Ranking preview failed: ${error instanceof Error ? error.message : "Unknown error"}\n`;
      }
    }

    const processingDuration = Date.now() - startTime;

    // Create ingestion report
    const ingestionReport = await newsRepo.createIngestionReport({
      filename: file.name,
      status: report.failed_items > 0 ? "partial" : "completed",
      total_items: report.total_items,
      processed_items: report.processed_items,
      failed_items: report.failed_items,
      duplicate_items: report.duplicate_items,
      new_tools_created: report.new_tools_created,
      new_companies_created: report.new_companies_created,
      pending_tools_created: report.pending_tools_created || 0,
      ranking_preview_generated: generatePreview && rankingChangesPreview !== null,
      processing_log: report.processing_log,
      errors: report.errors,
      ingested_news_ids: report.ingested_news_ids,
      created_tools: report.created_tools,
      created_companies: report.created_companies,
      ranking_changes_preview: rankingChangesPreview,
      file_size: file.size,
      processing_duration: processingDuration,
    });

    loggers.api.info("News ingestion completed", {
      filename: file.name,
      processed: report.processed_items,
      failed: report.failed_items,
      duplicates: report.duplicate_items,
      duration: processingDuration,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${report.processed_items} of ${report.total_items} news items`,
      report: {
        ...report,
        ranking_changes_preview: rankingChangesPreview,
        processing_duration: processingDuration,
        ingestion_report_id: ingestionReport.id,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    loggers.api.error("News ingestion failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: "Failed to process news file",
      },
      { status: 500 }
    );
  }
}
