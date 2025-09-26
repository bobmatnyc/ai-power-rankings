/**
 * Consolidated Admin News Management API
 *
 * Endpoints:
 * - GET: Get ingestion reports, fetch articles
 * - POST: Ingest news, manual ingest, rollback
 * - DELETE: Remove news data
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { ArticlesRepository } from "@/lib/db/repositories/articles.repository";
import { loggers } from "@/lib/logger";
import type { Article } from "@/lib/db/article-schema";

// import { NewsIngestor } from "@/lib/news-ingestor";
// import { fetchGoogleDriveNews } from "@/lib/news-fetcher";
// import { generateNewsId } from "@/lib/utils/news";

// Removed unused generateNewsId function

/**
 * GET /api/admin/news
 *
 * Query params:
 * - action: 'reports' | 'fetch-article' | 'status'
 * - url: URL for fetch-article action
 * - days: number of days for reports (default 30)
 */
export async function GET(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "reports";

    switch (action) {
      case "reports": {
        // Get ingestion reports (replaces ingestion-reports)
        const days = parseInt(searchParams.get("days") || "30", 10);
        const articlesRepo = new ArticlesRepository();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        try {
          const allArticles = await articlesRepo.findAll();
          const recentArticles = allArticles.filter(
            (article) => new Date(article.publishedDate || article.createdAt) >= cutoffDate
          );

          // Group by ingestion batch
          interface BatchData {
            batch_id: string;
            articles: Array<{
              id: string;
              title: string;
              slug: string | null;
              published_date: Date | null;
              tool_mentions: number;
            }>;
            ingested_at: Date;
            source: string;
          }
          const ingestionBatches = new Map<string, BatchData>();

          recentArticles.forEach((article: Article) => {
            // Using ingestionType as a proxy for batch ID
            const batchId = article.ingestionType || "manual";
            if (!ingestionBatches.has(batchId)) {
              ingestionBatches.set(batchId, {
                batch_id: batchId,
                articles: [],
                ingested_at: article.createdAt,
                source: article.sourceName || "unknown",
              });
            }
            ingestionBatches.get(batchId).articles.push({
              id: article.id,
              title: article.title,
              slug: article.slug,
              published_date: article.publishedDate,
              tool_mentions: article.toolMentions?.length || 0,
            });
          });
          const reports = Array.from(ingestionBatches.values()).sort(
            (a: BatchData, b: BatchData) =>
              new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime()
          );

          return NextResponse.json({
            reports,
            total_articles: recentArticles.length,
            period_days: days,
          });
        } catch (dbError) {
          loggers.api.warn("Could not fetch articles from database", { dbError });
          return NextResponse.json({
            reports: [],
            total_articles: 0,
            period_days: days,
            error: "Database unavailable",
          });
        }
      }

      case "fetch-article": {
        // Fetch article content (replaces fetch-article)
        const url = searchParams.get("url");

        if (!url) {
          return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
        }

        // This would typically fetch and parse the article
        // For now, return a placeholder
        return NextResponse.json({
          url,
          title: "Article Title",
          content: "Article content would be fetched here",
          published_at: new Date().toISOString(),
        });
      }

      case "status": {
        // Get ingestion status
        const articlesRepo = new ArticlesRepository();

        try {
          const allArticles = await articlesRepo.findAll();

          const today = new Date();
          const thisMonth = allArticles.filter((article) => {
            const articleDate = new Date(article.publishedDate || article.createdAt);
            return (
              articleDate.getMonth() === today.getMonth() &&
              articleDate.getFullYear() === today.getFullYear()
            );
          });

          return NextResponse.json({
            total_articles: allArticles.length,
            this_month: thisMonth.length,
            last_ingestion: allArticles[0]?.createdAt || null,
          });
        } catch (dbError) {
          loggers.api.warn("Could not fetch status from database", { dbError });
          return NextResponse.json({
            total_articles: 0,
            this_month: 0,
            last_ingestion: null,
            error: "Database unavailable",
          });
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/news GET", { error, userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/news
 *
 * Actions:
 * - ingest: Ingest news from Google Drive
 * - manual-ingest: Manually add news article
 * - rollback: Rollback ingestion batch
 * - update-metrics: Update news metrics
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "ingest": {
        // Ingest news from Google Drive (replaces ingest-news)
        const { dry_run = false, limit, start_date, end_date, source = "google-drive" } = body;

        loggers.api.info("Starting news ingestion", {
          dry_run,
          limit,
          start_date,
          end_date,
          source,
        });

        try {
          // Fetch news from Google Drive
          // const newsData = await fetchGoogleDriveNews({
          //   startDate: start_date,
          //   endDate: end_date,
          //   limit,
          // });

          // Placeholder for now
          interface NewsItem {
            id: string;
            title: string;
            url: string;
            publishedDate: Date;
            toolMentions?: string[];
          }
          const newsData: NewsItem[] = [];

          if (dry_run) {
            return NextResponse.json({
              success: true,
              dry_run: true,
              articles_found: newsData.length,
              sample: newsData.slice(0, 5).map((article) => ({
                title: article.title,
                published_date: article.published_date,
                source: article.source,
              })),
            });
          }

          // Ingest the news
          // const ingestor = new NewsIngestor();
          // const result = await ingestor.ingestBatch(newsData, source);

          // Placeholder result
          const result = {
            ingested: 0,
            skipped: 0,
            errors: [],
            batch_id: `batch-${Date.now()}`,
          };

          return NextResponse.json({
            success: true,
            ingested: result.ingested,
            skipped: result.skipped,
            errors: result.errors,
            batch_id: result.batch_id,
          });
        } catch (ingestionError) {
          loggers.api.error("News ingestion failed", { error: ingestionError });
          return NextResponse.json(
            {
              error: "Ingestion failed",
              details: ingestionError instanceof Error ? ingestionError.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      }

      case "manual-ingest": {
        // Manually add news article (replaces manual-ingest)
        const {
          title,
          content,
          author,
          summary,
          url,
          source_url,
          published_at,
          source = "manual",
          tool_mentions = [],
          tags = [],
          category,
          importance_score,
        } = body;

        if (!title || !content) {
          return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
        }

        const articlesRepo = new ArticlesRepository();

        try {
          const article = await articlesRepo.createArticle({
            title,
            slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            summary: summary || `${content.substring(0, 200)}...`,
            content,
            author,
            sourceUrl: url || source_url,
            sourceName: source,
            publishedDate: published_at ? new Date(published_at) : new Date(),
            toolMentions: tool_mentions,
            tags,
            category,
            importanceScore: importance_score,
            status: "active",
            ingestionType: "text",
            ingestedBy: userId,
          });

          return NextResponse.json({
            success: true,
            article: {
              id: article.id,
              title: article.title,
              slug: article.slug,
            },
          });
        } catch (dbError) {
          loggers.api.error("Failed to create article", { dbError });
          return NextResponse.json(
            { error: "Failed to create article", details: dbError },
            { status: 500 }
          );
        }
      }

      case "rollback": {
        // Rollback ingestion batch (replaces rollback-ingestion)
        const { batch_id } = body;

        if (!batch_id) {
          return NextResponse.json({ error: "batch_id is required" }, { status: 400 });
        }

        const articlesRepo = new ArticlesRepository();

        try {
          const allArticles = await articlesRepo.findAll();
          const batchArticles = allArticles.filter(
            (article: Article) => article.ingestionType === batch_id
          );

          if (batchArticles.length === 0) {
            return NextResponse.json(
              { error: `No articles found for batch ${batch_id}` },
              { status: 404 }
            );
          }

          const deletedIds = [];
          const errors = [];

          for (const article of batchArticles) {
            try {
              await articlesRepo.deleteArticle(article.id);
              deletedIds.push(article.id);
            } catch (error) {
              errors.push({
                id: article.id,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          return NextResponse.json({
            success: true,
            batch_id,
            deleted: deletedIds.length,
            errors,
          });
        } catch (dbError) {
          loggers.api.error("Failed to rollback batch", { dbError });
          return NextResponse.json({ error: "Failed to rollback batch" }, { status: 500 });
        }
      }

      case "update-metrics": {
        // Update news metrics and analysis
        const { article_id, metrics } = body;

        if (!article_id) {
          return NextResponse.json({ error: "article_id is required" }, { status: 400 });
        }

        const articlesRepo = new ArticlesRepository();

        try {
          const article = await articlesRepo.findById(article_id);

          if (!article) {
            return NextResponse.json({ error: `Article ${article_id} not found` }, { status: 404 });
          }

          const updatedArticle = await articlesRepo.updateArticle(article_id, {
            // Articles don't have a metadata field in the schema
            // Store metrics data in a different way or extend schema if needed
            importanceScore: metrics.importance_score || article.importanceScore,
            sentimentScore: metrics.sentiment_score || article.sentimentScore,
          });

          return NextResponse.json({
            success: true,
            article: {
              id: updatedArticle?.id,
              title: updatedArticle?.title,
              importanceScore: updatedArticle?.importanceScore,
              sentimentScore: updatedArticle?.sentimentScore,
            },
          });
        } catch (dbError) {
          loggers.api.error("Failed to update metrics", { dbError });
          return NextResponse.json({ error: "Failed to update metrics" }, { status: 500 });
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    loggers.api.error("Error in admin/news POST", { error, userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/news
 *
 * Delete news article or batch
 */
export async function DELETE(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }
  const { userId } = authResult;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const batch = searchParams.get("batch");

    if (!id && !batch) {
      return NextResponse.json(
        { error: "Either id or batch parameter is required" },
        { status: 400 }
      );
    }

    const articlesRepo = new ArticlesRepository();

    if (id) {
      // Delete single article
      try {
        const article = await articlesRepo.findById(id);

        if (!article) {
          return NextResponse.json({ error: `Article ${id} not found` }, { status: 404 });
        }

        await articlesRepo.deleteArticle(id);

        return NextResponse.json({
          success: true,
          deleted: {
            id: article.id,
            title: article.title,
          },
        });
      } catch (dbError) {
        loggers.api.error("Failed to delete article", { dbError });
        return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
      }
    }

    if (batch) {
      // Delete batch of articles
      try {
        const allArticles = await articlesRepo.findAll();
        const batchArticles = allArticles.filter(
          (article: Article) => article.ingestionType === batch
        );

        const deleted = [];
        for (const article of batchArticles) {
          await articlesRepo.deleteArticle(article.id);
          deleted.push({
            id: article.id,
            title: article.title,
          });
        }

        return NextResponse.json({
          success: true,
          batch,
          deleted_count: deleted.length,
          deleted,
        });
      } catch (dbError) {
        loggers.api.error("Failed to delete batch", { dbError });
        return NextResponse.json({ error: "Failed to delete batch" }, { status: 500 });
      }
    }

    // Should not reach here if id or batch was provided
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    loggers.api.error("Error in admin/news DELETE", { error, userId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
