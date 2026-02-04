/**
 * State of AI Summary Service
 * Generates LLM-powered monthly "State of AI" editorial summaries
 */

import { getDb } from "@/lib/db/connection";
import { stateOfAiSummaries } from "@/lib/db/schema";
import type { StateOfAiSummary, NewStateOfAiSummary } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { loggers } from "@/lib/logger";
import {
  WhatsNewAggregationService,
  type MonthlyDataSources,
} from "./whats-new-aggregation.service";
import { getOpenRouterService } from "./openrouter.service";

export interface StateOfAiGenerationResult {
  summary: StateOfAiSummary;
  isNew: boolean;
  generationTimeMs: number;
}

export class StateOfAiSummaryService {
  private aggregationService: WhatsNewAggregationService;
  private openRouterService = getOpenRouterService();

  constructor() {
    this.aggregationService = new WhatsNewAggregationService();
  }

  /**
   * Get current month and year
   */
  private getCurrentMonthYear(): { month: number; year: number } {
    const now = new Date();
    return {
      month: now.getMonth() + 1, // 1-12
      year: now.getFullYear(),
    };
  }

  /**
   * Format month number to name
   */
  private formatMonthName(month: number): string {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month - 1] || "Unknown";
  }

  /**
   * Format aggregated data into LLM prompt for State of AI editorial
   */
  private formatDataForPrompt(data: MonthlyDataSources, month: number, year: number): string {
    const monthName = this.formatMonthName(month);
    let prompt = `# AI Industry Data for ${monthName} ${year} State of AI Editorial\n\n`;

    prompt += `## Overview\n`;
    prompt += `- Period: Last 4 weeks (≈${monthName} ${year})\n`;
    prompt += `- Total Articles: ${data.metadata.totalArticles}\n`;
    prompt += `- New Tools: ${data.metadata.totalNewTools}\n`;
    prompt += `- Ranking Changes: ${data.metadata.totalRankingChanges}\n\n`;

    // Top News Articles (focus on most important)
    if (data.newsArticles.length > 0) {
      prompt += `## KEY NEWS ARTICLES (Top 10 by Importance)\n\n`;
      data.newsArticles.slice(0, 10).forEach((article, idx) => {
        prompt += `${idx + 1}. **${article.title}**\n`;
        if (article.summary) {
          prompt += `   ${article.summary}\n`;
        }
        prompt += `   Importance: ${article.importanceScore || 0}/10\n`;
        if (article.sourceUrl) {
          prompt += `   URL: ${article.sourceUrl}\n`;
        }
        // Extract tool mentions
        if (article.toolMentions && Array.isArray(article.toolMentions)) {
          const tools = article.toolMentions.map((m: any) => m.tool || m).filter(Boolean);
          if (tools.length > 0) {
            prompt += `   Tools: ${tools.join(", ")}\n`;
          }
        }
        prompt += `\n`;
      });
    }

    // Tool Rankings and Changes
    if (data.rankingChanges.length > 0) {
      prompt += `## RANKING CHANGES & TOOL LANDSCAPE\n\n`;
      data.rankingChanges.forEach((change) => {
        prompt += `- ${change.period}: ${change.toolCount} tools tracked (${change.algorithmVersion})\n`;
      });
      prompt += `\n`;
    }

    // New Tools Launches
    if (data.newTools.length > 0) {
      prompt += `## NEW TOOLS LAUNCHED\n\n`;
      data.newTools.forEach((tool) => {
        prompt += `- **${tool.name}** (${tool.category})\n`;
      });
      prompt += `\n`;
    }

    // Site Changes (Platform Updates)
    if (data.siteChanges.length > 0) {
      prompt += `## PLATFORM UPDATES (AI Power Rankings)\n\n`;
      data.siteChanges.forEach((version) => {
        prompt += `### Version ${version.version}\n`;
        version.changes.forEach((change) => {
          prompt += `- [${change.type}] ${change.description}\n`;
        });
        prompt += `\n`;
      });
    }

    return prompt;
  }

  /**
   * Generate State of AI editorial summary using Claude Sonnet 4
   */
  async generateStateOfAi(
    month?: number,
    year?: number,
    generatedBy?: string,
    forceRegenerate = false
  ): Promise<StateOfAiGenerationResult> {
    const startTime = Date.now();
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    // Default to current month/year
    const { month: targetMonth, year: targetYear } = month && year
      ? { month, year }
      : this.getCurrentMonthYear();

    const monthName = this.formatMonthName(targetMonth);

    loggers.api.info(`Generating State of AI for ${monthName} ${targetYear}`);

    // 1. Check for existing summary
    if (!forceRegenerate) {
      const existing = await db
        .select()
        .from(stateOfAiSummaries)
        .where(
          and(
            eq(stateOfAiSummaries.month, targetMonth),
            eq(stateOfAiSummaries.year, targetYear)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const summary = existing[0];
        const generationTimeMs = Date.now() - startTime;

        loggers.api.info("Returning existing State of AI summary", {
          month: targetMonth,
          year: targetYear,
        });

        return {
          summary,
          isNew: false,
          generationTimeMs,
        };
      }
    }

    // 2. Aggregate data for the target month
    const aggregatedData = await this.aggregationService.getMonthlyData(targetMonth, targetYear);

    // 3. Format data for LLM prompt
    const dataPrompt = this.formatDataForPrompt(aggregatedData, targetMonth, targetYear);

    // 4. Generate monthly update using Claude Sonnet 4
    const systemPrompt = `You are writing the monthly "AI Power Rankings: ${monthName} ${targetYear} Update" for aipowerranking.com.

This is a brief monthly update announcing changes to the platform—new tools added, ranking shifts, methodology improvements, and notable market movements. This is NOT deep strategic analysis (save that for the weekly newsletter).

## Output Structure (4-5 sections, 400-600 words total)

**Title:** AI Power Rankings: ${monthName} ${targetYear} Update

**Opening** (2-3 sentences)
State what this is and the time period covered. No throat-clearing.
Example: "Here's what changed on AI Power Rankings in ${monthName} ${targetYear}. Four new tools, one methodology update, and a notable shift in the enterprise tier."

**New Additions** (bullet list)
List new tools added with one-line context on why they matter.
Format each as: - **Tool Name** — Brief description of category/positioning. Why it earned inclusion.
Keep to 4-6 additions maximum. If more were added, group by category.
IMPORTANT: Do NOT create links to /tools/ pages - just use bold text for tool names.

**Ranking Movement** (optional section - only include if significant)
Only include if movements are significant enough to warrant attention:
- A tool moved 5+ positions
- A major vendor entered or exited a tier
- A methodology change caused systematic repositioning
Format: "[Tool] moved from [position] to [position] following [specific reason]."
If no significant movements, omit this section entirely.

**Methodology Update** (when applicable)
Brief explanation of what changed and why it improves the rankings.
Example: "Security weighting increased from 10% to 15% of total score following Q1 CVE disclosures."
If no methodology changes, omit this section.

**What's Next** (1-2 sentences, optional)
Preview of next month's focus areas. Creates continuity.
Example: "February will add multi-agent orchestration tools as that category matures."

**Closing** (always include)
Attribution and pointer to the full newsletter:
"For strategic analysis of what these developments mean for your organization, subscribe to the [AI Power Rankings newsletter](https://aipowerranking.com/newsletter). Full methodology and tool evaluations at [aipowerranking.com](https://aipowerranking.com)."

## Voice and Tone

- **Informational, not advisory**: Lead with what changed. Strategic implications are supporting context, not the main event.
- **Efficient but warm**: Brief doesn't mean cold. Use first person where natural ("I added..." or "We updated...").
- **Platform-proud without selling**: Let quality show without marketing language.
- **Signal the work**: Each update should make clear that research and evaluation are ongoing.

Good: "The rankings now cover 47 tools across 6 categories—the most comprehensive evaluation I'm aware of in this space."
Avoid: "AI Power Rankings continues to be the definitive resource for..."

## Prohibited Language (Death List)

NEVER use these words/phrases:
- "delve", "robust", "landscape" (except explicit competitive context)
- "The AI coding tools market continues to evolve rapidly" (or similar filler)
- Generic platitudes or buzzwords
- Apologies for brevity or promises of deeper analysis later

## Format Requirements

- 400-600 words total (under 1,000 max)
- 4-5 sections maximum with clear **bold headers**
- Bullet lists for tool additions
- Specific counts: "4 new tools" not "several additions"
- Specific dates: "added ${monthName} 15" not "recently added"
- Specific metrics: "200K context window" not "large context"
- Only link to newsletter (https://aipowerranking.com/newsletter) and main site (https://aipowerranking.com) - do NOT link to /tools/ pages
- Valid markdown format

Generate only the update content in markdown format.`;

    const userPrompt = `Based on this ${monthName} ${targetYear} data, write the AI Power Rankings monthly update:

${dataPrompt}

Write the monthly update now (4-5 sections, 400-600 words, markdown format - only link to newsletter and main site, NOT to /tools/ pages):`;

    try {
      const llmStartTime = Date.now();

      const { content, metadata: llmMetadata } = await this.openRouterService.generate({
        model: "anthropic/claude-sonnet-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4, // Slightly higher for editorial creativity
        max_tokens: 2000,
      });

      const llmDuration = Date.now() - llmStartTime;

      // 5. Save summary in database
      const metadata = {
        model: "anthropic/claude-sonnet-4",
        generation_time_ms: llmDuration,
        article_count: aggregatedData.metadata.totalArticles,
        ranking_change_count: aggregatedData.metadata.totalRankingChanges,
        new_tool_count: aggregatedData.metadata.totalNewTools,
        site_change_count: aggregatedData.metadata.totalSiteChanges,
        data_period_start: aggregatedData.metadata.startDate.toISOString(),
        data_period_end: aggregatedData.metadata.endDate.toISOString(),
        word_count: content.split(/\s+/).length,
        cost_usd: llmMetadata.estimatedCost,
        prompt_tokens: llmMetadata.promptTokens,
        completion_tokens: llmMetadata.completionTokens,
      };

      const summaryData: NewStateOfAiSummary = {
        month: targetMonth,
        year: targetYear,
        content,
        generatedAt: new Date(),
        generatedBy: generatedBy || "system",
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Upsert: insert or update if exists
      const result = await db
        .insert(stateOfAiSummaries)
        .values(summaryData)
        .onConflictDoUpdate({
          target: [stateOfAiSummaries.month, stateOfAiSummaries.year],
          set: {
            content,
            generatedAt: new Date(),
            generatedBy: generatedBy || "system",
            metadata,
            updatedAt: new Date(),
          },
        })
        .returning();

      const generationTimeMs = Date.now() - startTime;

      loggers.api.info("State of AI editorial generated successfully", {
        month: targetMonth,
        year: targetYear,
        monthName,
        generationTimeMs,
        llmDuration,
        wordCount: metadata.word_count,
        contentLength: content.length,
        articleCount: aggregatedData.metadata.totalArticles,
        cost: llmMetadata.estimatedCost.toFixed(4),
      });

      return {
        summary: result[0],
        isNew: true,
        generationTimeMs,
      };
    } catch (error) {
      loggers.api.error("Failed to generate State of AI editorial", {
        month: targetMonth,
        year: targetYear,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get existing State of AI summary
   */
  async getSummary(month?: number, year?: number): Promise<StateOfAiSummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const { month: targetMonth, year: targetYear } = month && year
      ? { month, year }
      : this.getCurrentMonthYear();

    const result = await db
      .select()
      .from(stateOfAiSummaries)
      .where(
        and(
          eq(stateOfAiSummaries.month, targetMonth),
          eq(stateOfAiSummaries.year, targetYear)
        )
      )
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get current month's summary or fallback to previous month
   */
  async getCurrentSummary(): Promise<StateOfAiSummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const { month: currentMonth, year: currentYear } = this.getCurrentMonthYear();

    // Try current month first
    let result = await db
      .select()
      .from(stateOfAiSummaries)
      .where(
        and(
          eq(stateOfAiSummaries.month, currentMonth),
          eq(stateOfAiSummaries.year, currentYear)
        )
      )
      .limit(1);

    if (result.length > 0) {
      return result[0];
    }

    // Fallback to most recent summary
    result = await db
      .select()
      .from(stateOfAiSummaries)
      .orderBy(desc(stateOfAiSummaries.year), desc(stateOfAiSummaries.month))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * List all State of AI summaries
   */
  async listSummaries(limit = 12): Promise<StateOfAiSummary[]> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    return await db
      .select()
      .from(stateOfAiSummaries)
      .orderBy(desc(stateOfAiSummaries.year), desc(stateOfAiSummaries.month))
      .limit(limit);
  }
}
