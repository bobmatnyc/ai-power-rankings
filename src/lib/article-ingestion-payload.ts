import { getPayload } from "payload";
import config from "@payload-config";
import { logger } from "./logger";
import { NewsItem } from "./article-validator";
import { getSourceCredibility } from "./news-aging";

export interface IngestionReport {
  timestamp: string;
  file_name: string;
  total_articles: number;
  ingested: number;
  duplicates_removed: number;
  validation_errors: number;
  errors: string[];
  ingested_articles: Array<{
    id: string;
    title: string;
    url: string;
    status: "new" | "updated" | "duplicate";
  }>;
}

export async function ingestArticles(
  articles: NewsItem[],
  fileName: string
): Promise<IngestionReport> {
  const payload = await getPayload({ config });
  const report: IngestionReport = {
    timestamp: new Date().toISOString(),
    file_name: fileName,
    total_articles: articles.length,
    ingested: 0,
    duplicates_removed: 0,
    validation_errors: 0,
    errors: [],
    ingested_articles: [],
  };

  for (const article of articles) {
    try {
      // Check if article with same URL already exists
      const { docs: existingArticles } = await payload.find({
        collection: "news",
        where: {
          url: { equals: article.source.url },
        },
        limit: 100,
      });

      // Remove existing articles with same URL to avoid duplicates
      if (existingArticles.length > 0) {
        for (const existingArticle of existingArticles) {
          await payload.delete({
            collection: "news",
            id: existingArticle.id,
          });
        }

        report.duplicates_removed += existingArticles.length;
        logger.info(
          `Removed ${existingArticles.length} duplicate(s) for URL: ${article.source.url}`
        );
      }

      // Get all tools to map against (needed for both tools_mentioned and metrics)
      const { docs: allTools } = await payload.find({
        collection: "tools",
        limit: 1000,
      });

      // Get tool relationships by mapping tool IDs/names
      const relatedTools: string[] = [];
      let primaryTool: string | undefined;

      if (article.tools_mentioned && article.tools_mentioned.length > 0) {

        const toolMap = new Map<string, string>();
        allTools.forEach((tool: any) => {
          const toolId = String(tool.id);
          if (tool['supabase_tool_id']) {
            toolMap.set(String(tool['supabase_tool_id']), toolId);
          }
          toolMap.set(String(tool['slug']), toolId);
          toolMap.set(String(tool['name']).toLowerCase(), toolId);
        });

        for (const toolMention of article.tools_mentioned) {
          const toolId = toolMention.tool_id;
          const payloadToolId = toolMap.get(toolId) || 
                               toolMap.get(toolId.toLowerCase()) ||
                               toolMap.get(toolId.replace(/-/g, ''));
          
          if (payloadToolId) {
            relatedTools.push(payloadToolId);
            if (!primaryTool) {
              primaryTool = payloadToolId;
            }
          }
        }
      }

      // Determine category based on article type
      const categoryMap: Record<string, string> = {
        'funding': 'funding',
        'acquisition': 'acquisition',
        'product_launch': 'product',
        'product_update': 'product',
        'benchmark': 'benchmark',
        'partnership': 'partnership',
        'company_announcement': 'industry',
        'industry_news': 'industry',
        'default': 'industry',
      };

      const category = categoryMap[article.type] || categoryMap['default'];

      // Determine if this is a company announcement
      const isCompanyAnnouncement =
        article.metadata?.is_company_announcement ||
        article.type === "company_announcement" ||
        article.type === "company_news" ||
        article.source.name.toLowerCase().includes("blog") ||
        article.source.name.toLowerCase().includes("press release");

      // Get source credibility
      const sourceCredibility =
        article.metadata?.source_credibility || getSourceCredibility(article.source.name);

      // Transform article data for Payload News collection
      const newsData = {
        title: article.title,
        summary: article.summary || '',
        content: article.content?.full_text ? [
          {
            children: [{ text: article.content.full_text }]
          }
        ] : undefined,
        url: article.source.url,
        source: article.source.name,
        author: article.source.author || null,
        published_at: article.published_date,
        category,
        importance_score: article.impact_assessment?.importance === 'critical' ? 10 : 
                         article.impact_assessment?.importance === 'high' ? 8 :
                         article.impact_assessment?.importance === 'medium' ? 5 : 3,
        related_tools: relatedTools,
        primary_tool: primaryTool,
        sentiment: 0, // Default to neutral since sentiment_score is not in the schema
        key_topics: article.tags || [],
        is_featured: false,
        // Store additional metadata in a metadata field if the News collection supports it
        metadata: {
          discovered_date: article.discovered_date || new Date().toISOString(),
          type: article.type,
          is_company_announcement: isCompanyAnnouncement,
          source_credibility: sourceCredibility,
          tools_mentioned: article.tools_mentioned,
          metrics_mentioned: article.metrics_mentioned || [],
          key_quotes: article.content?.key_quotes || [],
          data_points: article.content?.data_points || [],
          verification: article.verification || {},
          impact_assessment: article.impact_assessment || {},
          original_id: article.id,
        },
      };

      // Insert the article into Payload
      const createdNews = await payload.create({
        collection: "news",
        data: newsData,
      });

      report.ingested++;
      report.ingested_articles.push({
        id: String(createdNews.id),
        title: article.title,
        url: article.source.url,
        status: existingArticles.length > 0 ? "updated" : "new",
      });

      logger.info(`Successfully ingested article: ${article.title}`);

      // If metrics are mentioned, also update metrics_history
      if (article.metrics_mentioned && article.metrics_mentioned.length > 0) {
        for (const metric of article.metrics_mentioned) {
          try {
            // Find the tool in Payload to get the correct ID
            const toolRef = relatedTools.find((toolId: string) => 
              allTools.some((tool: any) => String(tool.id) === toolId && 
                (tool['supabase_tool_id'] === metric.tool_id || 
                 tool['slug'] === metric.tool_id ||
                 String(tool['name']).toLowerCase() === metric.tool_id.toLowerCase()))
            );

            if (!toolRef) {
              logger.warn(`Tool not found for metric: ${metric.tool_id}`);
              continue;
            }

            const metricEntry = {
              tool: toolRef,
              metric_key: metric.metric_key,
              value_integer: typeof metric.value === "number" ? Math.floor(metric.value) : null,
              value_decimal:
                typeof metric.value === "number" && !Number.isInteger(metric.value)
                  ? metric.value
                  : null,
              value_text: typeof metric.value === "string" ? metric.value : null,
              value_boolean: typeof metric.value === "boolean" ? metric.value : null,
              value_json: typeof metric.value === "object" ? metric.value : null,
              unit: metric.unit || null,
              source: "news_article",
              source_url: article.source.url,
              notes: `From article: ${article.title}`,
              collected_at: article.published_date,
            };

            await payload.create({
              collection: "metrics",
              data: metricEntry,
            });

          } catch (metricError) {
            logger.warn(`Error processing metric for ${metric.tool_id}:`, metricError);
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      report.errors.push(`Article "${article.title}": ${errorMessage}`);
      logger.error(`Failed to ingest article "${article.title}":`, error);
    }
  }

  return report;
}