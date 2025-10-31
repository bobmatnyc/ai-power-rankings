/**
 * What's New Summary Service
 * Generates LLM-powered monthly summaries using OpenRouter API
 */

import { getDb } from "@/lib/db/connection";
import { monthlySummaries } from "@/lib/db/schema";
import type { MonthlySummary, NewMonthlySummary } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOpenRouterApiKey } from "@/lib/startup-validation";
import { loggers } from "@/lib/logger";
import {
  WhatsNewAggregationService,
  type MonthlyDataSources,
} from "./whats-new-aggregation.service";

export interface SummaryGenerationResult {
  summary: MonthlySummary;
  isNew: boolean;
  generationTimeMs: number;
}

export class WhatsNewSummaryService {
  private apiKey: string;
  private aggregationService: WhatsNewAggregationService;

  constructor() {
    this.apiKey = getOpenRouterApiKey();
    this.aggregationService = new WhatsNewAggregationService();
  }

  /**
   * Format aggregated data into LLM prompt
   */
  private formatDataForPrompt(data: MonthlyDataSources): string {
    let prompt = `# Monthly Data Summary for ${data.metadata.period}\n\n`;

    // News Articles Section
    if (data.newsArticles.length > 0) {
      prompt += `## NEWS ARTICLES (Top ${Math.min(data.newsArticles.length, 15)} by Importance)\n\n`;
      data.newsArticles.slice(0, 15).forEach((article, idx) => {
        prompt += `${idx + 1}. **${article.title}**\n`;
        if (article.summary) {
          prompt += `   Summary: ${article.summary}\n`;
        }
        prompt += `   Importance: ${article.importanceScore || 0}/10\n`;
        prompt += `   Published: ${new Date(article.publishedAt).toLocaleDateString()}\n`;
        if (article.source) {
          prompt += `   Source: ${article.source}\n`;
        }
        if (article.sourceUrl) {
          prompt += `   URL: ${article.sourceUrl}\n`;
        }
        // Extract tool mentions if available
        if (article.toolMentions && Array.isArray(article.toolMentions)) {
          const tools = article.toolMentions.map((m: any) => m.tool || m).filter(Boolean);
          if (tools.length > 0) {
            prompt += `   Tools Mentioned: ${tools.join(", ")}\n`;
          }
        }
        prompt += `\n`;
      });
    } else {
      prompt += `## NEWS ARTICLES\nNo significant news articles in this period.\n\n`;
    }

    // Ranking Changes Section
    if (data.rankingChanges.length > 0) {
      prompt += `## RANKING CHANGES\n\n`;
      data.rankingChanges.forEach((change) => {
        prompt += `- Period ${change.period}: ${change.algorithmVersion} with ${change.toolCount} tools\n`;
        if (change.publishedAt) {
          prompt += `  Published: ${new Date(change.publishedAt).toLocaleDateString()}\n`;
        }
      });
      prompt += `\n`;
    } else {
      prompt += `## RANKING CHANGES\nNo ranking updates in this period.\n\n`;
    }

    // New Tools Section
    if (data.newTools.length > 0) {
      prompt += `## NEW TOOLS ADDED\n\n`;
      data.newTools.forEach((tool) => {
        prompt += `- **${tool.name}** (${tool.category})\n`;
        prompt += `  Added: ${new Date(tool.createdAt).toLocaleDateString()}\n`;
        if (tool.scoreUpdatedAt) {
          prompt += `  Score Updated: ${new Date(tool.scoreUpdatedAt).toLocaleDateString()}\n`;
        }
      });
      prompt += `\n`;
    } else {
      prompt += `## NEW TOOLS ADDED\nNo new tools added in this period.\n\n`;
    }

    // Site Updates Section
    if (data.siteChanges.length > 0) {
      prompt += `## SITE UPDATES (from CHANGELOG)\n\n`;
      data.siteChanges.forEach((version) => {
        prompt += `### Version ${version.version} (${version.date})\n`;
        const groupedChanges = version.changes.reduce(
          (acc, change) => {
            if (!acc[change.type]) {
              acc[change.type] = [];
            }
            acc[change.type].push(change.description);
            return acc;
          },
          {} as Record<string, string[]>
        );

        Object.entries(groupedChanges).forEach(([type, descriptions]) => {
          prompt += `**${type.charAt(0).toUpperCase() + type.slice(1)}:**\n`;
          descriptions.forEach((desc) => {
            prompt += `- ${desc}\n`;
          });
        });
        prompt += `\n`;
      });
    } else {
      prompt += `## SITE UPDATES\nNo site updates in this period.\n\n`;
    }

    return prompt;
  }

  /**
   * Generate monthly summary using Claude Sonnet 4.5
   */
  async generateMonthlySummary(period?: string, forceRegenerate = false): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const targetPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    loggers.api.info(`Generating monthly summary for period: ${targetPeriod}`);

    // 1. Check for existing summary
    if (!forceRegenerate) {
      const existing = await db
        .select()
        .from(monthlySummaries)
        .where(eq(monthlySummaries.period, targetPeriod))
        .limit(1);

      if (existing.length > 0) {
        const summary = existing[0];
        const generationTimeMs = Date.now() - startTime;

        // Check if data has changed
        const aggregatedData = await this.aggregationService.getMonthlyData(targetPeriod);
        const currentHash = this.aggregationService.calculateDataHash(aggregatedData);

        if (currentHash === summary.dataHash) {
          loggers.api.info("Returning cached summary (data unchanged)", { period: targetPeriod });
          return {
            summary,
            isNew: false,
            generationTimeMs,
          };
        } else {
          loggers.api.info("Data changed, regenerating summary", {
            period: targetPeriod,
            oldHash: summary.dataHash.slice(0, 8),
            newHash: currentHash.slice(0, 8),
          });
        }
      }
    }

    // 2. Aggregate data from all sources
    const aggregatedData = await this.aggregationService.getMonthlyData(targetPeriod);
    const dataHash = this.aggregationService.calculateDataHash(aggregatedData);

    // 3. Format data for LLM prompt
    const dataPrompt = this.formatDataForPrompt(aggregatedData);

    // 4. Generate summary using Claude Sonnet 4.5
    const systemPrompt = `You are an expert AI industry analyst creating a comprehensive monthly "What's New" summary for AI Power Rankings.

Your task is to synthesize news articles, ranking changes, new tools, and site updates into a cohesive narrative that helps readers understand the month's key developments in AI coding tools.

Structure your response as a professional article with 4 main paragraphs (~1500 words total):

1. **Market Overview** (150-200 words): Synthesize the most significant trends and events
2. **Key Developments** (150-200 words): Highlight major news, funding, product launches
3. **Ranking & Tool Changes** (150-200 words): Discuss new tools and significant ranking movements
4. **Looking Ahead** (150-200 words): Identify emerging trends and implications

Important guidelines:
- Write in a professional, journalistic tone
- Use specific data points, tool names, and figures from the source material
- Include inline markdown links to relevant articles and tools using format: [link text](url)
- Focus on what matters most to developers evaluating AI coding tools
- Be analytical, not just descriptive - explain why things matter
- Maintain objectivity while highlighting significant developments

Format your response as clean markdown that's ready to display.`;

    const userPrompt = `Create a comprehensive monthly summary based on this data:

${dataPrompt}

Remember to:
- Write approximately 1500 words across 4 paragraphs
- Include specific links to articles and tools
- Focus on significant developments
- Explain implications for the AI coding tool landscape
- Use markdown formatting for readability

Generate the summary now:`;

    try {
      const llmStartTime = Date.now();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Referer: process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3007",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 16000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        loggers.api.error("OpenRouter API error", { status: response.status, error: errorText });
        throw new Error(`OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No content in OpenRouter response");
      }

      const llmDuration = Date.now() - llmStartTime;

      // 5. Save or update summary in database
      const metadata = {
        model: "anthropic/claude-sonnet-4",
        generation_time_ms: llmDuration,
        article_count: aggregatedData.metadata.totalArticles,
        ranking_change_count: aggregatedData.metadata.totalRankingChanges,
        new_tool_count: aggregatedData.metadata.totalNewTools,
        site_change_count: aggregatedData.metadata.totalSiteChanges,
        data_period_start: aggregatedData.metadata.startDate.toISOString(),
        data_period_end: aggregatedData.metadata.endDate.toISOString(),
      };

      const summaryData: NewMonthlySummary = {
        period: targetPeriod,
        content,
        dataHash,
        metadata,
        generatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Upsert: insert or update if exists
      const result = await db
        .insert(monthlySummaries)
        .values(summaryData)
        .onConflictDoUpdate({
          target: monthlySummaries.period,
          set: {
            content,
            dataHash,
            metadata,
            generatedAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const generationTimeMs = Date.now() - startTime;

      loggers.api.info("Monthly summary generated successfully", {
        period: targetPeriod,
        generationTimeMs,
        llmDuration,
        contentLength: content.length,
        articleCount: aggregatedData.metadata.totalArticles,
      });

      return {
        summary: result[0],
        isNew: true,
        generationTimeMs,
      };
    } catch (error) {
      loggers.api.error("Failed to generate monthly summary", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get existing summary or generate if missing
   */
  async getSummary(period?: string): Promise<MonthlySummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const targetPeriod = period || new Date().toISOString().slice(0, 7);

    const existing = await db
      .select()
      .from(monthlySummaries)
      .where(eq(monthlySummaries.period, targetPeriod))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // No existing summary, generate one
    const result = await this.generateMonthlySummary(targetPeriod);
    return result.summary;
  }

  /**
   * Invalidate (delete) cached summary for a period
   */
  async invalidateSummary(period: string): Promise<void> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    await db.delete(monthlySummaries).where(eq(monthlySummaries.period, period));
    loggers.api.info(`Invalidated summary for period: ${period}`);
  }
}
