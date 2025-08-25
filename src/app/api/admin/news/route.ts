/**
 * Consolidated Admin News Management API
 * 
 * Endpoints:
 * - GET: Get ingestion reports, fetch articles
 * - POST: Ingest news, manual ingest, rollback
 * - DELETE: Remove news data
 */

import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
// import { NewsIngestor } from "@/lib/news-ingestor";
// import { fetchGoogleDriveNews } from "@/lib/news-fetcher";
// import { generateNewsId } from "@/lib/utils/news";

// Temporary helper until modules are available
function generateNewsId(title: string): string {
  return `news_${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
}

/**
 * GET /api/admin/news
 * 
 * Query params:
 * - action: 'reports' | 'fetch-article' | 'status'
 * - url: URL for fetch-article action
 * - days: number of days for reports (default 30)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "reports";

    switch (action) {
      case "reports": {
        // Get ingestion reports (replaces ingestion-reports)
        const days = parseInt(searchParams.get("days") || "30", 10);
        const newsRepo = getNewsRepo();
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const allNews = await newsRepo.getAll();
        const recentNews = allNews.filter(
          article => new Date(article.published_date || article.created_at) >= cutoffDate
        );

        // Group by ingestion batch
        const ingestionBatches = new Map();
        
        recentNews.forEach(article => {
          const batchId = (article as any).ingestion_batch || "manual";
          if (!ingestionBatches.has(batchId)) {
            ingestionBatches.set(batchId, {
              batch_id: batchId,
              articles: [],
              ingested_at: article.created_at,
              source: article.source || "unknown",
            });
          }
          ingestionBatches.get(batchId).articles.push({
            id: article.id,
            title: article.title,
            slug: article.slug,
            published_date: article.published_date,
            tool_mentions: article.tool_mentions?.length || 0,
          });
        });

        const reports = Array.from(ingestionBatches.values()).sort(
          (a, b) => new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime()
        );

        return NextResponse.json({
          reports,
          total_articles: recentNews.length,
          period_days: days,
        });
      }

      case "fetch-article": {
        // Fetch article content (replaces fetch-article)
        const url = searchParams.get("url");
        
        if (!url) {
          return NextResponse.json(
            { error: "URL parameter is required" },
            { status: 400 }
          );
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
        const newsRepo = getNewsRepo();
        const allNews = await newsRepo.getAll();
        
        const today = new Date();
        const thisMonth = allNews.filter(article => {
          const articleDate = new Date(article.published_date || article.created_at);
          return (
            articleDate.getMonth() === today.getMonth() &&
            articleDate.getFullYear() === today.getFullYear()
          );
        });

        return NextResponse.json({
          total_articles: allNews.length,
          this_month: thisMonth.length,
          last_ingestion: allNews[0]?.created_at || null,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    loggers.api.error("Error in admin/news GET", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "ingest": {
        // Ingest news from Google Drive (replaces ingest-news)
        const { 
          dry_run = false, 
          limit, 
          start_date, 
          end_date,
          source = "google-drive" 
        } = body;

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
          const newsData: any[] = [];

          if (dry_run) {
            return NextResponse.json({
              success: true,
              dry_run: true,
              articles_found: newsData.length,
              sample: newsData.slice(0, 5).map((article: any) => ({
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
          url, 
          published_at,
          source = "manual",
          tool_mentions = [],
          tags = [],
        } = body;

        if (!title || !content) {
          return NextResponse.json(
            { error: "Title and content are required" },
            { status: 400 }
          );
        }

        const newsRepo = getNewsRepo();
        const now = new Date().toISOString();

        const article = {
          id: generateNewsId(title),
          slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          title,
          summary: content.substring(0, 200) + "...",
          content,
          url,
          source,
          published_date: published_at || now,
          created_at: now,
          updated_at: now,
          tool_mentions,
          tags,
          // ingestion_batch: `manual-${Date.now()}`,
        } as any;

        await newsRepo.upsert(article);

        return NextResponse.json({
          success: true,
          article: {
            id: article.id,
            title: article.title,
            slug: article.slug,
          },
        });
      }

      case "rollback": {
        // Rollback ingestion batch (replaces rollback-ingestion)
        const { batch_id } = body;

        if (!batch_id) {
          return NextResponse.json(
            { error: "batch_id is required" },
            { status: 400 }
          );
        }

        const newsRepo = getNewsRepo();
        const allNews = await newsRepo.getAll();
        const batchArticles = allNews.filter(
          article => (article as any).ingestion_batch === batch_id
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
            await newsRepo.delete(article.id);
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
      }

      case "update-metrics": {
        // Update news metrics and analysis
        const { article_id, metrics } = body;

        if (!article_id) {
          return NextResponse.json(
            { error: "article_id is required" },
            { status: 400 }
          );
        }

        const newsRepo = getNewsRepo();
        const article = await newsRepo.getById(article_id);

        if (!article) {
          return NextResponse.json(
            { error: `Article ${article_id} not found` },
            { status: 404 }
          );
        }

        const updatedArticle = {
          ...article,
          metrics: {
            ...(article as any).metrics,
            ...metrics,
          },
          updated_at: new Date().toISOString(),
        } as any;

        await newsRepo.upsert(updatedArticle);

        return NextResponse.json({
          success: true,
          article: {
            id: updatedArticle.id,
            title: updatedArticle.title,
            metrics: updatedArticle.metrics,
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    loggers.api.error("Error in admin/news POST", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/news
 * 
 * Delete news article or batch
 */
export async function DELETE(request: NextRequest) {
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

    const newsRepo = getNewsRepo();

    if (id) {
      // Delete single article
      const article = await newsRepo.getById(id);
      
      if (!article) {
        return NextResponse.json(
          { error: `Article ${id} not found` },
          { status: 404 }
        );
      }

      await newsRepo.delete(id);

      return NextResponse.json({
        success: true,
        deleted: {
          id: article.id,
          title: article.title,
        },
      });
    }

    if (batch) {
      // Delete batch of articles
      const allNews = await newsRepo.getAll();
      const batchArticles = allNews.filter(
        article => (article as any).ingestion_batch === batch
      );

      const deleted = [];
      for (const article of batchArticles) {
        await newsRepo.delete(article.id);
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
    }
  } catch (error) {
    loggers.api.error("Error in admin/news DELETE", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  // Should not reach here
  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}