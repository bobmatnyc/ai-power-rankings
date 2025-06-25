import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

interface RemovalSpecification {
  news_items?: {
    urls?: string[];
    ids?: string[];
    title_patterns?: string[];
    source?: string;
    published_after?: string;
    published_before?: string;
  };
  tools?: {
    slugs?: string[];
    ids?: string[];
    names?: string[];
    created_after?: string;
  };
  companies?: {
    slugs?: string[];
    ids?: string[];
    names?: string[];
    created_after?: string;
  };
  rankings?: {
    periods?: string[];
    tool_ids?: string[];
  };
  metrics?: {
    tool_ids?: string[];
    metric_keys?: string[];
    collected_after?: string;
    collected_before?: string;
  };
}

// @ts-ignore - Type definition for future use
interface RemovalResult {
  success: boolean;
  report: {
    filename: string;
    total_removed: number;
    news_removed: number;
    tools_removed: number;
    companies_removed: number;
    rankings_removed: number;
    metrics_removed: number;
    removal_log: string;
    errors: any[];
    warnings: any[];
    skipped_items: any[];
  };
}

async function removeNewsItems(payload: any, criteria: NonNullable<RemovalSpecification['news_items']>, log: string[]): Promise<{ removed: number; errors: any[]; warnings: any[] }> {
  const removed = { removed: 0, errors: [] as any[], warnings: [] as any[] };
  
  // Build query conditions
  const whereConditions: any = {};
  const orConditions: any[] = [];

  if (criteria.urls) {
    orConditions.push(...criteria.urls.map(url => ({ url: { equals: url } })));
  }

  if (criteria.ids) {
    orConditions.push(...criteria.ids.map(id => ({ id: { equals: id } })));
  }

  if (criteria.title_patterns) {
    orConditions.push(...criteria.title_patterns.map(pattern => ({ title: { contains: pattern } })));
  }

  if (criteria.source) {
    whereConditions.source = { equals: criteria.source };
  }

  if (criteria.published_after) {
    whereConditions.published_at = { greater_than: criteria.published_after };
  }

  if (criteria.published_before) {
    whereConditions.published_at = { 
      ...whereConditions.published_at,
      less_than: criteria.published_before 
    };
  }

  if (orConditions.length > 0) {
    whereConditions.or = orConditions;
  }

  const { docs: newsItems } = await payload.find({
    collection: "news",
    where: whereConditions,
    limit: 1000,
  });

  log.push(`Found ${newsItems.length} news items matching criteria`);

  for (const newsItem of newsItems) {
    try {
      await payload.delete({
        collection: "news",
        id: newsItem.id,
      });
      removed.removed++;
      log.push(`Removed news item: ${newsItem['title']} (${newsItem.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      removed.errors.push({
        type: 'news',
        id: newsItem.id,
        title: newsItem['title'],
        error: errorMessage,
      });
      log.push(`Failed to remove news item ${newsItem.id}: ${errorMessage}`);
    }
  }

  return removed;
}

async function removeTools(payload: any, criteria: NonNullable<RemovalSpecification['tools']>, log: string[]): Promise<{ removed: number; errors: any[]; warnings: any[] }> {
  const removed = { removed: 0, errors: [] as any[], warnings: [] as any[] };
  
  const whereConditions: any = {};
  const orConditions: any[] = [];

  if (criteria.slugs) {
    orConditions.push(...criteria.slugs.map(slug => ({ slug: { equals: slug } })));
  }

  if (criteria.ids) {
    orConditions.push(...criteria.ids.map(id => ({ id: { equals: id } })));
  }

  if (criteria.names) {
    orConditions.push(...criteria.names.map(name => ({ name: { equals: name } })));
  }

  if (criteria.created_after) {
    whereConditions.createdAt = { greater_than: criteria.created_after };
  }

  if (orConditions.length > 0) {
    whereConditions.or = orConditions;
  }

  const { docs: tools } = await payload.find({
    collection: "tools",
    where: whereConditions,
    limit: 1000,
  });

  log.push(`Found ${tools.length} tools matching criteria`);

  for (const tool of tools) {
    try {
      // Check for dependencies before removing
      const { docs: relatedNews } = await payload.find({
        collection: "news",
        where: {
          or: [
            { related_tools: { contains: tool.id } },
            { primary_tool: { equals: tool.id } }
          ]
        },
        limit: 1,
      });

      const { docs: toolMetrics } = await payload.find({
        collection: "metrics",
        where: { tool: { equals: tool.id } },
        limit: 1,
      });

      const { docs: toolRankings } = await payload.find({
        collection: "rankings",
        where: { tool: { equals: tool.id } },
        limit: 1,
      });

      if (relatedNews.length > 0 || toolMetrics.length > 0 || toolRankings.length > 0) {
        removed.warnings.push({
          type: 'tool_dependencies',
          tool: tool['name'],
          id: tool.id,
          dependencies: {
            news: relatedNews.length,
            metrics: toolMetrics.length,
            rankings: toolRankings.length,
          },
        });
        log.push(`Warning: Tool ${tool['name']} has dependencies, skipping removal`);
        continue;
      }

      await payload.delete({
        collection: "tools",
        id: tool.id,
      });
      removed.removed++;
      log.push(`Removed tool: ${tool['name']} (${tool.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      removed.errors.push({
        type: 'tool',
        id: tool.id,
        name: tool['name'],
        error: errorMessage,
      });
      log.push(`Failed to remove tool ${tool.id}: ${errorMessage}`);
    }
  }

  return removed;
}

async function removeCompanies(payload: any, criteria: NonNullable<RemovalSpecification['companies']>, log: string[]): Promise<{ removed: number; errors: any[]; warnings: any[] }> {
  const removed = { removed: 0, errors: [] as any[], warnings: [] as any[] };
  
  const whereConditions: any = {};
  const orConditions: any[] = [];

  if (criteria.slugs) {
    orConditions.push(...criteria.slugs.map(slug => ({ slug: { equals: slug } })));
  }

  if (criteria.ids) {
    orConditions.push(...criteria.ids.map(id => ({ id: { equals: id } })));
  }

  if (criteria.names) {
    orConditions.push(...criteria.names.map(name => ({ name: { equals: name } })));
  }

  if (criteria.created_after) {
    whereConditions.createdAt = { greater_than: criteria.created_after };
  }

  if (orConditions.length > 0) {
    whereConditions.or = orConditions;
  }

  const { docs: companies } = await payload.find({
    collection: "companies",
    where: whereConditions,
    limit: 1000,
  });

  log.push(`Found ${companies.length} companies matching criteria`);

  for (const company of companies) {
    try {
      // Check for dependencies before removing
      const { docs: companyTools } = await payload.find({
        collection: "tools",
        where: { company: { equals: company.id } },
        limit: 1,
      });

      if (companyTools.length > 0) {
        removed.warnings.push({
          type: 'company_dependencies',
          company: company['name'],
          id: company.id,
          tools_count: companyTools.length,
        });
        log.push(`Warning: Company ${company['name']} has ${companyTools.length} tools, skipping removal`);
        continue;
      }

      await payload.delete({
        collection: "companies",
        id: company.id,
      });
      removed.removed++;
      log.push(`Removed company: ${company['name']} (${company.id})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      removed.errors.push({
        type: 'company',
        id: company.id,
        name: company['name'],
        error: errorMessage,
      });
      log.push(`Failed to remove company ${company.id}: ${errorMessage}`);
    }
  }

  return removed;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const payload = await getPayload({ config });
    
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const confirm_removal = formData.get('confirm_removal') === 'true';
    
    if (!file) {
      return NextResponse.json(
        { error: "No removal specification file provided" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { error: "File must be a JSON file" },
        { status: 400 }
      );
    }

    if (!confirm_removal) {
      return NextResponse.json(
        { error: "Removal must be explicitly confirmed with confirm_removal=true" },
        { status: 400 }
      );
    }

    // Read and parse the JSON file
    const fileContent = await file.text();
    let removalSpec: RemovalSpecification;
    
    try {
      removalSpec = JSON.parse(fileContent);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    const log: string[] = [`Started data removal process for ${file.name}`];
    const report = {
      filename: file.name,
      total_removed: 0,
      news_removed: 0,
      tools_removed: 0,
      companies_removed: 0,
      rankings_removed: 0,
      metrics_removed: 0,
      removal_log: '',
      errors: [] as any[],
      warnings: [] as any[],
      skipped_items: [] as any[],
    };

    // Remove news items
    if (removalSpec.news_items) {
      log.push("Processing news item removals...");
      const newsResult = await removeNewsItems(payload, removalSpec.news_items, log);
      report.news_removed = newsResult.removed;
      report.errors.push(...newsResult.errors);
      report.warnings.push(...newsResult.warnings);
    }

    // Remove tools
    if (removalSpec.tools) {
      log.push("Processing tool removals...");
      const toolsResult = await removeTools(payload, removalSpec.tools, log);
      report.tools_removed = toolsResult.removed;
      report.errors.push(...toolsResult.errors);
      report.warnings.push(...toolsResult.warnings);
    }

    // Remove companies
    if (removalSpec.companies) {
      log.push("Processing company removals...");
      const companiesResult = await removeCompanies(payload, removalSpec.companies, log);
      report.companies_removed = companiesResult.removed;
      report.errors.push(...companiesResult.errors);
      report.warnings.push(...companiesResult.warnings);
    }

    // Remove rankings
    if (removalSpec.rankings) {
      log.push("Processing ranking removals...");
      const whereConditions: any = {};
      const orConditions: any[] = [];

      if (removalSpec.rankings.periods) {
        orConditions.push(...removalSpec.rankings.periods.map(period => ({ period: { equals: period } })));
      }

      if (removalSpec.rankings.tool_ids) {
        orConditions.push(...removalSpec.rankings.tool_ids.map(toolId => ({ tool: { equals: toolId } })));
      }

      if (orConditions.length > 0) {
        whereConditions.or = orConditions;
      }

      try {
        const { docs: rankings } = await payload.find({
          collection: "rankings",
          where: whereConditions,
          limit: 1000,
        });

        for (const ranking of rankings) {
          await payload.delete({
            collection: "rankings",
            id: ranking.id,
          });
          report.rankings_removed++;
          log.push(`Removed ranking: ${ranking['period']} - Position ${ranking['position']}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({
          type: 'rankings',
          error: errorMessage,
        });
        log.push(`Failed to remove rankings: ${errorMessage}`);
      }
    }

    // Remove metrics
    if (removalSpec.metrics) {
      log.push("Processing metric removals...");
      const whereConditions: any = {};
      const orConditions: any[] = [];

      if (removalSpec.metrics.tool_ids) {
        orConditions.push(...removalSpec.metrics.tool_ids.map(toolId => ({ tool: { equals: toolId } })));
      }

      if (removalSpec.metrics.metric_keys) {
        orConditions.push(...removalSpec.metrics.metric_keys.map(key => ({ metric_key: { equals: key } })));
      }

      if (removalSpec.metrics.collected_after) {
        whereConditions.collected_at = { greater_than: removalSpec.metrics.collected_after };
      }

      if (removalSpec.metrics.collected_before) {
        whereConditions.collected_at = { 
          ...whereConditions.collected_at,
          less_than: removalSpec.metrics.collected_before 
        };
      }

      if (orConditions.length > 0) {
        whereConditions.or = orConditions;
      }

      try {
        const { docs: metrics } = await payload.find({
          collection: "metrics",
          where: whereConditions,
          limit: 1000,
        });

        for (const metric of metrics) {
          await payload.delete({
            collection: "metrics",
            id: metric.id,
          });
          report.metrics_removed++;
          log.push(`Removed metric: ${metric['metric_key']} for tool ${metric['tool']}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({
          type: 'metrics',
          error: errorMessage,
        });
        log.push(`Failed to remove metrics: ${errorMessage}`);
      }
    }

    report.total_removed = report.news_removed + report.tools_removed + 
                          report.companies_removed + report.rankings_removed + 
                          report.metrics_removed;

    report.removal_log = log.join('\n');
    
    log.push(`Removal completed. Total items removed: ${report.total_removed}`);
    log.push(`- News: ${report.news_removed}`);
    log.push(`- Tools: ${report.tools_removed}`);
    log.push(`- Companies: ${report.companies_removed}`);
    log.push(`- Rankings: ${report.rankings_removed}`);
    log.push(`- Metrics: ${report.metrics_removed}`);
    log.push(`- Errors: ${report.errors.length}`);
    log.push(`- Warnings: ${report.warnings.length}`);

    const processingDuration = Date.now() - startTime;

    loggers.api.info("Data removal completed", {
      filename: file.name,
      total_removed: report.total_removed,
      news: report.news_removed,
      tools: report.tools_removed,
      companies: report.companies_removed,
      rankings: report.rankings_removed,
      metrics: report.metrics_removed,
      errors: report.errors.length,
      warnings: report.warnings.length,
      duration: processingDuration,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully removed ${report.total_removed} items`,
      report: {
        ...report,
        processing_duration: processingDuration,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    loggers.api.error("Data removal failed:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: "Failed to process removal file",
      },
      { status: 500 }
    );
  }
}