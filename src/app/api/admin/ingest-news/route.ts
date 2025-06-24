import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";
// import { RankingEngineV6, ToolMetricsV6 } from "@/lib/ranking-algorithm-v6";

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
  metadata?: any;
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
  payload: any,
  toolIdentifier: string,
  newsSource: string
): Promise<any> {
  // First try to find by slug
  const { docs: toolsBySlug } = await payload.find({
    collection: "tools",
    where: {
      slug: { equals: toolIdentifier.toLowerCase().replace(/\s+/g, "-") },
    },
    limit: 1,
  });

  if (toolsBySlug.length > 0) {
    return toolsBySlug[0];
  }

  // Then try to find by name
  const { docs: toolsByName } = await payload.find({
    collection: "tools",
    where: {
      name: { equals: toolIdentifier },
    },
    limit: 1,
  });

  if (toolsByName.length > 0) {
    return toolsByName[0];
  }

  // Create new tool if not found
  loggers.api.info(`Creating new tool: ${toolIdentifier}`);

  // Create a basic company for the tool
  const companyName = toolIdentifier.includes(" ") ? toolIdentifier.split(" ")[0] : toolIdentifier;
  const companySlug = companyName.toLowerCase().replace(/\s+/g, "-");

  let company;
  const { docs: existingCompanies } = await payload.find({
    collection: "companies",
    where: {
      slug: { equals: companySlug },
    },
    limit: 1,
  });

  if (existingCompanies.length > 0) {
    company = existingCompanies[0];
  } else {
    company = await payload.create({
      collection: "companies",
      data: {
        name: companyName,
        slug: companySlug,
        company_type: "private",
        description: `Company created during news ingestion from ${newsSource}`,
      },
    });
  }

  const tool = await payload.create({
    collection: "tools",
    data: {
      name: toolIdentifier,
      slug: toolIdentifier.toLowerCase().replace(/\s+/g, "-"),
      display_name: toolIdentifier,
      company: company.id,
      category: "autonomous-agent", // Default category
      status: "active",
      description: [
        {
          children: [
            {
              text: `Tool created during news ingestion from ${newsSource}`,
            },
          ],
        },
      ],
      tagline: toolIdentifier,
      pricing_model: "freemium", // Default to freemium for auto-created tools
      license_type: "proprietary",
    },
  });

  return tool;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const payload = await getPayload({ config });

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
    } catch (error) {
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
      processing_log: `Started processing ${newsItems.length} news items\n`,
      errors: [] as any[],
      ingested_news_ids: [] as string[],
      created_tools: [] as any[],
      created_companies: [] as any[],
    };

    // Process each news item
    for (let i = 0; i < newsItems.length; i++) {
      const item = newsItems[i];

      if (!item) {
        continue;
      }

      try {
        report.processing_log += `Processing item ${i + 1}: ${item.title}\n`;

        // Check for duplicates by URL
        const { docs: existingNews } = await payload.find({
          collection: "news",
          where: {
            url: { equals: item.url },
          },
          limit: 1,
        });

        if (existingNews.length > 0) {
          report.duplicate_items++;
          report.processing_log += `  - Skipped: duplicate URL\n`;
          continue;
        }

        // Process related tools
        const relatedToolIds = [];
        if (item.related_tools) {
          for (const toolIdentifier of item.related_tools) {
            const tool = await findOrCreateTool(payload, toolIdentifier, item.source);
            relatedToolIds.push(tool.id);

            if (!report.created_tools.find((t) => t.id === tool.id)) {
              report.created_tools.push({
                id: tool.id,
                name: tool.name,
                slug: tool.slug,
              });
              report.new_tools_created++;
            }
          }
        }

        // Process primary tool
        let primaryToolId = null;
        if (item.primary_tool) {
          const primaryTool = await findOrCreateTool(payload, item.primary_tool, item.source);
          primaryToolId = primaryTool.id;

          if (!relatedToolIds.includes(primaryTool.id)) {
            relatedToolIds.push(primaryTool.id);
          }

          if (!report.created_tools.find((t) => t.id === primaryTool.id)) {
            report.created_tools.push({
              id: primaryTool.id,
              name: primaryTool.name,
              slug: primaryTool.slug,
            });
            report.new_tools_created++;
          }
        }

        // Create the news item
        const newsData = {
          title: item.title,
          summary: item.summary,
          content: item.content ? [{ children: [{ text: item.content }] }] : undefined,
          url: item.url,
          source: item.source,
          author: item.author,
          published_at: new Date(String(item.published_at)).toISOString(),
          category: item.category || "industry",
          importance_score: item.importance_score || 5,
          related_tools: relatedToolIds,
          primary_tool: primaryToolId,
          sentiment: item.sentiment || 0,
          key_topics: item.key_topics || [],
          is_featured: item.is_featured || false,
          metadata: {
            ...item.metadata,
            ingestion_source: file.name,
            ingestion_date: new Date().toISOString(),
          },
        };

        const createdNews = await payload.create({
          collection: "news",
          data: newsData,
        });

        report.ingested_news_ids.push(createdNews.id);
        report.processed_items++;
        report.processing_log += `  - Created news item ID: ${createdNews.id}\n`;
      } catch (error) {
        report.failed_items++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        report.errors.push({
          item_index: i,
          item_title: item.title,
          error: errorMessage,
        });
        report.processing_log += `  - Failed: ${errorMessage}\n`;
        loggers.api.error(`Error processing news item ${i}:`, error);
      }
    }

    // Generate ranking preview if requested
    let rankingChangesPreview = null;
    if (generatePreview && report.processed_items > 0) {
      try {
        report.processing_log += "Generating ranking preview...\n";

        // Get current rankings for comparison
        const { docs: currentRankings } = await payload.find({
          collection: "rankings",
          where: {
            period: { equals: new Date().toISOString().slice(0, 7) }, // Current month
          },
          limit: 1000,
          sort: "position",
        });

        // TODO: Implement preview ranking calculation
        // This would involve re-running the ranking algorithm with the new data
        // and comparing against current rankings

        rankingChangesPreview = {
          message: "Ranking preview calculation not yet implemented",
          current_rankings_count: currentRankings.length,
          potentially_affected_tools: report.created_tools.length,
        };

        report.processing_log += "Ranking preview generated\n";
      } catch (error) {
        report.processing_log += `Ranking preview failed: ${error instanceof Error ? error.message : "Unknown error"}\n`;
      }
    }

    const processingDuration = Date.now() - startTime;

    // Create ingestion report
    const ingestionReport = await payload.create({
      collection: "news-ingestion-reports",
      data: {
        filename: file.name,
        status: report.failed_items > 0 ? "partial" : "completed",
        total_items: report.total_items,
        processed_items: report.processed_items,
        failed_items: report.failed_items,
        duplicate_items: report.duplicate_items,
        new_tools_created: report.new_tools_created,
        new_companies_created: report.new_companies_created,
        ranking_preview_generated: generatePreview && rankingChangesPreview !== null,
        processing_log: report.processing_log,
        errors: report.errors,
        ingested_news_ids: report.ingested_news_ids,
        created_tools: report.created_tools,
        created_companies: report.created_companies,
        ranking_changes_preview: rankingChangesPreview,
        file_size: file.size,
        processing_duration: processingDuration,
      },
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
