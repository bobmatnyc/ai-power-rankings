/**
 * The monthly report generator (#182).
 *
 * Why: #182 merges the two monthly generators into this one. It used to write
 *   a ~1,500-word summary into `monthly_summaries`, while
 *   `state-of-ai-summary.service.ts` wrote a 400-600-word editorial into
 *   `state_of_ai_summaries`. Every caller of either (the daily-news cron, the
 *   monthly cron, the admin routes, the CLI script) now reaches this class.
 * What: Generates one 300-450-word report per `YYYY-MM` period through
 *   OpenRouter, rejects a reply outside that length, and appends it as the
 *   period's next version in `monthly_report_versions` (#114). The read
 *   functions are re-exported from `monthly-report.repository.ts` so the pages
 *   keep one import.
 * Test: `tests/unit/whats-new-auto-regenerate.test.ts`,
 *   `tests/unit/monthly-report-182.test.ts`.
 */

import { getOpenRouterApiKey } from "@/lib/startup-validation";
import { getOpenRouterModel } from "@/lib/services/openrouter-model";
import { readCompletion } from "@/lib/services/llm-completion";
import { loggers } from "@/lib/logger";
import { OPENROUTER_USAGE_REQUEST, recordOpenRouterUsage } from "@/lib/services/provider-usage"; // #325
import {
  MONTHLY_REPORT_MAX_WORDS,
  MONTHLY_REPORT_MIN_WORDS,
  assertReportWordCount,
} from "@/lib/services/monthly-report-words";
import {
  type StoredMonthlyReport,
  appendReportVersion,
  getLatestStoredSummary,
  getStoredSummary,
} from "@/lib/services/monthly-report.repository";
import {
  WhatsNewAggregationService,
  type MonthlyDataSources,
} from "./whats-new-aggregation.service";

// #54/#182: the page readers need no OpenRouter key; they live in the repository.
export {
  getLatestStoredSummary,
  getStoredSummary,
  getStoredSummaryVersion,
  listPeriods,
  listReportVersions,
  type StoredMonthlyReport,
  type StoredReportVersionInfo,
  type StoredSummaryPeriod,
} from "@/lib/services/monthly-report.repository";

export interface SummaryGenerationResult {
  summary: StoredMonthlyReport;
  isNew: boolean;
  generationTimeMs: number;
}

/**
 * Result of one cron-driven regeneration attempt (#160). "skipped" and
 * "failed" both leave every stored summary row exactly as it was.
 */
export type AutoRegenerationOutcome =
  | { status: "generated"; period: string; generationTimeMs: number }
  | {
      status: "skipped";
      period: string;
      reason:
        | "unchanged"
        | "no-articles-this-month"
        | "insufficient-time-budget"
        | "ingestion-failed";
    }
  | { status: "failed"; period: string; error: string };

/**
 * #160: below this remaining budget the cron skips the LLM call instead of
 * risking Vercel killing the whole ingestion run at `maxDuration`.
 */
export const MIN_GENERATION_BUDGET_MS = 60_000;

/**
 * Completion ceiling. #182: the report is ~600 tokens, but the ceiling stays
 * where #172 left it so a reasoning-heavy reply is not cut off; tokens are
 * billed as used, not as allowed.
 */
const WHATS_NEW_MAX_TOKENS = 16000;

/** Who started a generation, recorded on the stored version. */
export const GENERATED_BY_DAILY_CRON = "cron-daily-news";
export const GENERATED_BY_MONTHLY_CRON = "cron-monthly-summary";

export class WhatsNewSummaryService {
  private apiKey: string;
  private aggregationService: WhatsNewAggregationService;

  constructor() {
    this.apiKey = getOpenRouterApiKey();
    this.aggregationService = new WhatsNewAggregationService();
  }

  /**
   * Parse period string (YYYY-MM) into month and year numbers
   */
  private parsePeriod(period: string): { month: number; year: number } {
    const [yearStr, monthStr] = period.split("-");
    return {
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
    };
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
        prompt += `   Published: ${article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'Unknown'}\n`;
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
   * Fast-path: Get cached summary without hash validation
   * Returns cached summary instantly if it exists, null otherwise
   * Use this for quick reads where stale data is acceptable
   */
  async getCachedSummary(period?: string): Promise<StoredMonthlyReport | null> {
    // #54: shares the key-free read the /whats-new pages use.
    return getStoredSummary(period || new Date().toISOString().slice(0, 7));
  }

  /**
   * Most recent stored summary by period (`YYYY-MM` sorts chronologically),
   * or null when none is stored. Reads only; never generates.
   */
  async getLatestSummary(): Promise<StoredMonthlyReport | null> {
    return getLatestStoredSummary(); // #54: shared key-free read
  }

  /**
   * Why: #182: the one entry point every non-cron-daily caller uses: the
   * admin regenerate POST, the admin "State of AI" route, the monthly cron and
   * the CLI script.
   * What: Without `forceRegenerate`, returns the newest stored report
   * unchanged (`isNew: false`, no LLM call) when its `dataHash` matches the
   * period's current data. Otherwise generates and appends a new version,
   * recording `generatedBy`. Throws on any failure; nothing is stored then.
   * Test: `tests/unit/monthly-report-182.test.ts`.
   */
  async generateMonthlySummary(
    period?: string,
    forceRegenerate = false,
    generatedBy = "admin"
  ): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    const targetPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    loggers.api.info(`Generating monthly summary for period: ${targetPeriod}`);

    const { month, year } = this.parsePeriod(targetPeriod);
    const aggregatedData = await this.aggregationService.getMonthlyData(month, year);
    const dataHash = this.aggregationService.calculateDataHash(aggregatedData);

    if (!forceRegenerate) {
      const existing = await getStoredSummary(targetPeriod);
      if (existing && existing.dataHash === dataHash) {
        loggers.api.info("Returning cached summary (data unchanged)", { period: targetPeriod });
        return { summary: existing, isNew: false, generationTimeMs: Date.now() - startTime };
      }
    }

    return this.generateAndStore(targetPeriod, aggregatedData, dataHash, startTime, generatedBy);
  }

  /**
   * Why: #160 — the summary must follow the month's news without an admin,
   * but each generation is a paid LLM call, so only the CRON_SECRET-gated
   * daily-news cron calls this, once per run.
   * What: Skips at once when `timeBudgetMs` is under
   * `MIN_GENERATION_BUDGET_MS`. Otherwise aggregates `period`'s data and
   * hashes it the same way the stored report's `dataHash` was computed, and
   * skips when the hash matches the newest stored report or when the month
   * has no active articles yet. Otherwise makes one LLM call, aborted after
   * `timeBudgetMs`, and appends the period's next version (#182); earlier
   * versions are never changed. Throws on any failure before the insert, so
   * nothing is stored; callers wrap it (`autoRegenerateMonthlySummary`).
   * Test: `tests/unit/whats-new-auto-regenerate.test.ts`.
   */
  async regenerateIfChanged(
    period: string,
    timeBudgetMs: number,
    generatedBy = GENERATED_BY_DAILY_CRON
  ): Promise<AutoRegenerationOutcome> {
    // #160: checked before any database read, so a run that used most of the
    // function limit on ingestion spends none of the rest here.
    if (timeBudgetMs < MIN_GENERATION_BUDGET_MS) {
      return { status: "skipped", period, reason: "insufficient-time-budget" };
    }
    const startTime = Date.now();
    const stored = await this.getCachedSummary(period);

    const { month, year } = this.parsePeriod(period);
    const aggregatedData = await this.aggregationService.getMonthlyData(month, year);
    const dataHash = this.aggregationService.calculateDataHash(aggregatedData);

    if (stored && stored.dataHash === dataHash) {
      return { status: "skipped", period, reason: "unchanged" };
    }
    // #160: an empty new month would replace last month's summary with a
    // vacuous one; the public GET keeps serving the latest stored row instead.
    if (aggregatedData.newsArticles.length === 0) {
      return { status: "skipped", period, reason: "no-articles-this-month" };
    }

    const result = await this.generateAndStore(
      period,
      aggregatedData,
      dataHash,
      startTime,
      generatedBy,
      AbortSignal.timeout(timeBudgetMs)
    );
    return { status: "generated", period, generationTimeMs: result.generationTimeMs };
  }

  /**
   * One LLM call for `targetPeriod`, then an append of that period's next
   * version. The version is written only after the reply is complete,
   * non-empty and 300-450 words, so any failure stores nothing.
   */
  private async generateAndStore(
    targetPeriod: string,
    aggregatedData: MonthlyDataSources,
    dataHash: string,
    startTime: number,
    generatedBy: string,
    signal?: AbortSignal
  ): Promise<SummaryGenerationResult> {
    const dataPrompt = this.formatDataForPrompt(aggregatedData);

    // #182: one prompt for the one monthly report, replacing the ~1,500-word
    // summary prompt here and the 400-600-word editorial prompt.
    const systemPrompt = `You write the monthly "What's New" report for AI Power Rankings (aipowerranking.com), read by developers choosing AI coding tools.

Synthesize the month's news articles, new tools, ranking updates and site changes into one short report.

Length: ${MONTHLY_REPORT_MIN_WORDS}-${MONTHLY_REPORT_MAX_WORDS} words in total. A reply outside that range is discarded.

Structure, in markdown:
1. A one-line "# " title naming the month.
2. **The month in brief** (2-3 sentences): the most significant developments.
3. **Key developments**: the major news, launches and funding, with inline markdown links to the source articles in the form [link text](url).
4. **New tools and ranking updates**: new tools as a short bullet list (bold tool names, no links to /tools/ pages), then any ranking update.
5. **What to watch** (1-2 sentences).

Tone: factual and specific. Use tool names, counts and dates from the source material. Do not invent facts. Avoid filler such as "the landscape continues to evolve rapidly", and avoid "delve" and "robust".

Return only the report markdown.`;

    const userPrompt = `Write the monthly report from this data:

${dataPrompt}

Remember: ${MONTHLY_REPORT_MIN_WORDS}-${MONTHLY_REPORT_MAX_WORDS} words, markdown, links only to the source article URLs given above.`;

    // #172: anthropic/claude-sonnet-4 was retired on OpenRouter; resolve the shared id once
    // so the call and the stored metadata name the same model.
    const modelName = getOpenRouterModel();

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
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: WHATS_NEW_MAX_TOKENS,
          ...OPENROUTER_USAGE_REQUEST, // #325: ask for usage.cost
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        loggers.api.error("OpenRouter API error", { status: response.status, error: errorText });
        throw new Error(`OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      // #325: one ledger row per billed completion. Never throws.
      await recordOpenRouterUsage({ operation: "whats_new_summary", model: modelName, body: data });
      // #172: a summary cut off at max_tokens must not overwrite a stored one; log
      // finish_reason/length/model either way.
      const { content } = readCompletion(data, {
        label: "WhatsNewSummary",
        model: modelName,
        maxTokens: WHATS_NEW_MAX_TOKENS,
      });

      // #160: whitespace-only content must not overwrite a stored summary either.
      if (typeof content !== "string" || content.trim() === "") {
        throw new Error("No content in OpenRouter response");
      }
      // #182: the one monthly report is 300-450 words; anything else is not stored.
      const wordCount = assertReportWordCount(content);

      const llmDuration = Date.now() - llmStartTime;

      const metadata = {
        model: modelName,
        generation_time_ms: llmDuration,
        article_count: aggregatedData.metadata.totalArticles,
        ranking_change_count: aggregatedData.metadata.totalRankingChanges,
        new_tool_count: aggregatedData.metadata.totalNewTools,
        site_change_count: aggregatedData.metadata.totalSiteChanges,
        data_period_start: aggregatedData.metadata.startDate.toISOString(),
        data_period_end: aggregatedData.metadata.endDate.toISOString(),
        word_count: wordCount,
      };

      // #114/#182: append the next version; prior versions stay readable.
      const summary = await appendReportVersion({
        period: targetPeriod,
        content,
        dataHash,
        metadata,
        generatedBy,
        generatedAt: new Date(),
      });

      const generationTimeMs = Date.now() - startTime;

      loggers.api.info("Monthly summary generated successfully", {
        period: targetPeriod,
        version: summary.version,
        generatedBy,
        generationTimeMs,
        llmDuration,
        wordCount,
        articleCount: aggregatedData.metadata.totalArticles,
      });

      return { summary, isNew: true, generationTimeMs };
    } catch (error) {
      loggers.api.error("Failed to generate monthly summary", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
