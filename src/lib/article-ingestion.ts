import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
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
      const { data: existingArticles, error: checkError } = await supabase
        .from("news_updates")
        .select("id, url")
        .eq("url", article.source.url);

      if (checkError) {
        throw checkError;
      }

      // Remove existing articles with same URL
      if (existingArticles && existingArticles.length > 0) {
        const { error: deleteError } = await supabase
          .from("news_updates")
          .delete()
          .eq("url", article.source.url);

        if (deleteError) {
          throw deleteError;
        }

        report.duplicates_removed += existingArticles.length;
        logger.info(
          `Removed ${existingArticles.length} duplicate(s) for URL: ${article.source.url}`
        );
      }

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

      // Transform article data for database
      const newsUpdate = {
        id: article.id,
        title: article.title,
        summary: article.summary || null,
        source: article.source.name,
        source_author: article.source.author || null,
        url: article.source.url,
        published_date: article.published_date,
        discovered_date: article.discovered_date || new Date().toISOString(),
        type: article.type,
        content: article.content?.full_text || null,
        related_tools: article.tools_mentioned.map((t) => t.tool_id),
        metrics_mentioned: article.metrics_mentioned || [],
        tags: article.tags || [],
        impact_assessment: article.impact_assessment || {},
        verification_status: article.verification?.status || "unverified",
        metadata: {
          ...article.metadata,
          is_company_announcement: isCompanyAnnouncement,
          source_credibility: sourceCredibility,
          tools_mentioned: article.tools_mentioned,
          key_quotes: article.content?.key_quotes || [],
          data_points: article.content?.data_points || [],
          verification: article.verification || {},
        },
      };

      // Insert the article
      const { error: insertError } = await supabase
        .from("news_updates")
        .insert(newsUpdate)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      report.ingested++;
      report.ingested_articles.push({
        id: article.id,
        title: article.title,
        url: article.source.url,
        status: existingArticles && existingArticles.length > 0 ? "updated" : "new",
      });

      logger.info(`Successfully ingested article: ${article.title}`);

      // If metrics are mentioned, also update metrics_history
      if (article.metrics_mentioned && article.metrics_mentioned.length > 0) {
        for (const metric of article.metrics_mentioned) {
          try {
            const metricEntry = {
              tool_id: metric.tool_id,
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

            const { error: metricError } = await supabase
              .from("metrics_history")
              .insert(metricEntry);

            if (metricError) {
              logger.warn(`Failed to insert metric for ${metric.tool_id}:`, metricError);
            }
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
