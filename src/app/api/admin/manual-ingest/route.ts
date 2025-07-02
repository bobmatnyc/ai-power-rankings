import { NextRequest, NextResponse } from "next/server";
import { NewsRepositoryV2 } from "@/lib/json-db/news-repository-v2";
import { ToolsRepository } from "@/lib/json-db/tools-repository";
import type { NewsArticle } from "@/lib/json-db/schemas";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.content || !body.source_url) {
      return NextResponse.json(
        { error: "Missing required fields: title, content, or source_url" },
        { status: 400 }
      );
    }

    const newsRepo = new NewsRepositoryV2();
    const toolRepo = new ToolsRepository();

    // Check if article already exists with this URL
    const existingArticles = await newsRepo.search(body.source_url);
    if (existingArticles.length > 0) {
      const existing = existingArticles.find((a: NewsArticle) => a.source_url === body.source_url);
      if (existing) {
        return NextResponse.json(
          { error: "Article with this URL already exists", articleId: existing.id },
          { status: 409 }
        );
      }
    }

    // Validate tool mentions
    const validToolMentions: string[] = [];
    if (body.tool_mentions && Array.isArray(body.tool_mentions)) {
      for (const toolId of body.tool_mentions) {
        try {
          const tool = await toolRepo.getById(toolId);
          if (tool) {
            validToolMentions.push(toolId);
          } else {
            // Try to find by slug
            const toolBySlug = await toolRepo.getBySlug(toolId);
            if (toolBySlug) {
              validToolMentions.push(toolBySlug.id);
            } else {
              console.warn(`Tool not found: ${toolId}`);
            }
          }
        } catch (error) {
          console.warn(`Error validating tool ${toolId}:`, error);
        }
      }
    }

    // Generate ID and slug
    const id = crypto.randomUUID();
    const slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Ensure published_date is a valid ISO string
    let publishedDate = body.published_date;
    if (!publishedDate) {
      publishedDate = new Date().toISOString();
    } else {
      try {
        // Parse and re-format to ensure valid ISO string
        publishedDate = new Date(publishedDate).toISOString();
      } catch {
        publishedDate = new Date().toISOString();
      }
    }

    // Create article object
    const article: NewsArticle = {
      id,
      slug,
      title: body.title.substring(0, 500),
      content: body.content,
      summary: body.summary || body.content.substring(0, 500),
      author: body.author || "Unknown",
      published_date: publishedDate,
      source: body.source || new URL(body.source_url).hostname.replace("www.", ""),
      source_url: body.source_url,
      tags: body.tags || [],
      tool_mentions: validToolMentions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save article
    const savedArticle = await newsRepo.upsert(article);

    // Create an ingestion report for tracking
    const report = await newsRepo.createIngestionReport({
      filename: "manual-ingestion",
      status: "completed",
      total_items: 1,
      processed_items: 1,
      failed_items: 0,
      duplicate_items: 0,
      new_tools_created: 0,
      new_companies_created: 0,
      processing_log: `Manually ingested article: ${article.title}`,
      errors: [],
      ingested_news_ids: [article.id],
      created_tools: [],
      created_companies: [],
    });

    return NextResponse.json({
      success: true,
      article: savedArticle,
      reportId: report.id,
      message: "Article successfully ingested",
    });
  } catch (error) {
    console.error("Error in manual-ingest:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save article" },
      { status: 500 }
    );
  }
}
