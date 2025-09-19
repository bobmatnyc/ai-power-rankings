import { type NextRequest, NextResponse } from "next/server";
import { isAuthenticated as checkAuth } from "@/lib/clerk-auth";
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { getDb } from "@/lib/db/connection";

/**
 * GET /api/admin/articles/[id]/recalculate?stream=true&dryRun=true
 * Stream recalculation progress using Server-Sent Events (supports preview mode)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const stream = searchParams.get("stream") === "true";
    const dryRun = searchParams.get("dryRun") === "true";
    const useCachedAnalysis = searchParams.get("useCachedAnalysis") === "true";

    // Check admin authentication
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check database availability
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    if (!stream) {
      return NextResponse.json({ error: "Use POST method for non-streaming requests" }, { status: 400 });
    }

    console.log(`[API] Starting SSE ${dryRun ? 'preview' : 'recalculation'} for article: ${id}`);

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Send progress updates
          const sendProgress = (progress: number, step: string) => {
            const data = JSON.stringify({ type: 'progress', progress, step });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          };

          // Initialize
          sendProgress(10, "Loading article from database...");

          const articleService = new ArticleDatabaseService();

          // Get the article to analyze
          const articlesRepo = articleService.getArticlesRepo();
          const article = await articlesRepo.getArticleById(id);

          if (!article) {
            const errorData = JSON.stringify({ type: 'error', message: 'Article not found' });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
            return;
          }

          sendProgress(20, dryRun ? "Analyzing article content for preview..." : "Analyzing article content with AI...");

          // Perform the recalculation with progress callback
          const result = await articleService.recalculateArticleRankingsWithProgress(
            id,
            (progress: number, step: string) => {
              sendProgress(progress, step);
            },
            { dryRun, useCachedAnalysis }
          );

          sendProgress(90, dryRun ? "Preparing preview..." : "Finalizing changes...");

          // Send completion with results
          const completeData = JSON.stringify({
            type: 'complete',
            changes: result.changes || [],
            summary: result.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
            isDryRun: dryRun
          });
          controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));

          sendProgress(100, dryRun ? "Preview ready!" : "Recalculation complete!");

          // Close the stream
          controller.close();
        } catch (error) {
          console.error(`[API] SSE error during ${dryRun ? 'preview' : 'recalculation'}:`, error);
          const errorData = JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to process article'
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error("[API] Error in SSE endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start process" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/articles/[id]/recalculate
 * Recalculate rankings for a specific article (fallback for non-SSE, supports preview mode)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;

    // Parse request body for options
    let body: { dryRun?: boolean; useCachedAnalysis?: boolean } = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const dryRun = body.dryRun === true;
    const useCachedAnalysis = body.useCachedAnalysis === true;

    // Check admin authentication
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check database availability
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    console.log(`[API] ${dryRun ? 'Previewing' : 'Recalculating'} rankings for article: ${id}`);

    const articleService = new ArticleDatabaseService();
    const result = await articleService.recalculateArticleRankingsWithProgress(
      id,
      undefined,
      { dryRun, useCachedAnalysis }
    );

    return NextResponse.json({
      success: true,
      message: dryRun
        ? "Preview generated successfully"
        : "Article rankings recalculated successfully",
      changes: result.changes || [],
      summary: result.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
      isDryRun: dryRun
    });
  } catch (error) {
    console.error("[API] Error processing article:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process article" },
      { status: 500 }
    );
  }
}