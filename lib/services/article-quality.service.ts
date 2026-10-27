/**
 * Article Quality Assessment Service
 * Uses LLM to evaluate article quality, relevance, and credibility for ingestion filtering
 */

import { getOpenRouterService, type GenerationMetadata } from '@/lib/services/openrouter.service';
import { getOpenRouterModel } from '@/lib/services/openrouter-model';
// #172: the same JSON extraction #203 gave article analysis; truncation is already
// rejected inside OpenRouterService.generate via readCompletion.
import { extractJsonObject } from '@/lib/services/llm-completion';
import { loggers } from '@/lib/logger';

/**
 * Quality assessment result from LLM evaluation
 */
export interface QualityAssessment {
  qualityScore: number; // 0-10 scale
  relevanceScore: number; // 0-10 scale
  credibilityScore: number; // 0-10 scale
  reasoning: string;
  suggestedCategories: string[];
  shouldIngest: boolean;
  estimatedCost: number;
  // #167: the provider error when the LLM call itself failed, so the caller can tell
  // "assessment never ran" (e.g. OpenRouter out of credits) from a quality rejection.
  error?: string;
}

/**
 * Article data required for quality assessment
 */
export interface ArticleToAssess {
  title: string;
  content: string;
  source: string;
  url?: string;
  publishedAt?: Date;
}

/**
 * Default assessment returned when LLM evaluation fails
 */
const DEFAULT_ASSESSMENT: Omit<QualityAssessment, 'estimatedCost'> = {
  qualityScore: 5,
  relevanceScore: 5,
  credibilityScore: 5,
  reasoning: 'Assessment failed - using default scores',
  suggestedCategories: [],
  shouldIngest: false,
};

/**
 * Minimum thresholds for article ingestion. Exported read-only so the run summary
 * can log the values it buckets rejections against (#172); the values are unchanged.
 */
export const INGEST_THRESHOLDS = {
  minimumAverageScore: 7.0,
  minimumRelevanceScore: 7,
} as const;

/**
 * #172: completion budget for one assessment. The verdict is five short JSON fields,
 * ~150-300 tokens. 1000 left no margin for a model that reasons or pads before the
 * object; 2000 is ~7x the verdict. A reply that still hits the cap fails as truncation
 * (assessment_failed), never as a quality verdict.
 */
export const ASSESSMENT_MAX_TOKENS = 2000;

/**
 * System prompt for the quality assessment LLM
 */
const SYSTEM_PROMPT = `You are a strict content evaluator for AI Power Rankings, a site tracking AI coding tools and their capabilities.

Your job is to REJECT articles that don't contain direct, substantive information about AI coding tools. Be aggressive about filtering out low-value content.

REJECT (relevanceScore <= 4) these article types:
- **Listicles/roundups**: "Top 10 AI trends", "Best tools of 2025" with no depth on any tool
- **Abstract AI references**: Venture capital reports, earnings calls, market overviews that mention AI in passing but aren't ABOUT AI coding tools
- **Index/summary pages**: Articles that mostly link to other articles without original analysis
- **Paywalled stubs**: Teaser content with no extractable substance (just a headline and 1-2 sentences)
- **Generic industry reports**: Reports where AI/coding tools aren't the primary subject

ACCEPT (relevanceScore >= 7) only when the article is **primarily about** one or more of:
- Specific AI coding tools, IDEs, or assistants (e.g., Copilot, Cursor, Claude Code)
- LLM capabilities for code generation, debugging, or developer productivity
- Benchmarks, comparisons, or evaluations of AI developer tools
- Technical deep-dives into how AI coding tools work
- Developer experience reports with specific AI tools

The article must contain **extractable facts, data, or insights** directly useful to someone evaluating AI coding tools. Merely mentioning AI, machine learning, or tech funding is NOT sufficient.

Evaluate:
1. **Quality** (0-10): Writing depth, original analysis, citations. Score 0-3 for stubs/teasers with no substance.
2. **Relevance** (0-10): Is this PRIMARILY about AI coding tools? Score 0-4 if AI coding tools are only mentioned tangentially.
3. **Credibility** (0-10): Source reputation, author expertise, factual accuracy.

Respond ONLY with valid JSON in this exact format:
{
  "qualityScore": <number 0-10>,
  "relevanceScore": <number 0-10>,
  "credibilityScore": <number 0-10>,
  "reasoning": "<brief explanation>",
  "suggestedCategories": ["<category1>", "<category2>"]
}

Categories to choose from: AI Assistants, Code Generation, IDE Integration, Testing Tools, Documentation, DevOps, Security, Performance, General AI News`;

/**
 * Article Quality Assessment Service
 * Evaluates articles using LLM to determine ingestion worthiness
 */
export class ArticleQualityService {
  // #172: anthropic/claude-sonnet-4 was retired on OpenRouter; resolve the shared id per call.
  private get model(): string {
    return getOpenRouterModel();
  }

  /**
   * Assess a single article for quality, relevance, and credibility
   * @param article - Article to assess
   * @returns Quality assessment with scores and recommendation
   */
  async assessArticle(article: ArticleToAssess): Promise<QualityAssessment> {
    const openRouter = getOpenRouterService();

    const userPrompt = this.buildUserPrompt(article);

    try {
      const { content, metadata } = await openRouter.generate(
        {
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3, // #172: sonnet-5.5 accepts temperature, so the value is unchanged
          max_tokens: ASSESSMENT_MAX_TOKENS, // #172: was 1000; see the constant
        },
        {
          maxAttempts: 2,
          timeoutMs: 15000,
          operation: 'article_quality', // #325: ledger row label
        }
      );

      const assessment = this.parseAssessmentResponse(content, metadata);

      loggers.api.info('Article quality assessment completed', {
        title: article.title.substring(0, 50),
        source: article.source,
        qualityScore: assessment.qualityScore,
        relevanceScore: assessment.relevanceScore,
        credibilityScore: assessment.credibilityScore,
        shouldIngest: assessment.shouldIngest,
        cost: assessment.estimatedCost.toFixed(4),
      });

      return assessment;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      loggers.api.error('Article quality assessment failed', {
        title: article.title.substring(0, 50),
        source: article.source,
        error: message,
      });

      return {
        ...DEFAULT_ASSESSMENT,
        estimatedCost: 0,
        error: message, // #167: keep the provider error for the run's failure reason
      };
    }
  }

  /**
   * Assess multiple articles in batch (parallel processing)
   *
   * Processes articles in concurrent batches of BATCH_SIZE to avoid
   * sequential OpenRouter timeouts that can hang the entire pipeline.
   *
   * Includes a circuit breaker: if more than 30% of assessments fail,
   * remaining articles are skipped with an `error` and never ingested
   * (#172: accepting them ingested unassessed content).
   *
   * @param articles - Array of articles to assess
   * @returns Array of quality assessments in same order as input
   */
  async batchAssess(articles: ArticleToAssess[]): Promise<QualityAssessment[]> {
    const BATCH_SIZE = 5; // Process 5 articles concurrently
    const FAILURE_THRESHOLD = Math.floor(articles.length * 0.3);

    const assessments: QualityAssessment[] = [];
    let totalCost = 0;
    let qualityFailures = 0;
    let circuitBreakerTripped = false;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);

      // Circuit breaker: if too many failures, skip remaining articles (#172)
      if (!circuitBreakerTripped && qualityFailures > FAILURE_THRESHOLD) {
        loggers.api.warn(
          // #172: the remaining articles are skipped, not accepted.
          `Too many quality failures (${qualityFailures}/${articles.length}), skipping remaining articles`,
          { failureThreshold: FAILURE_THRESHOLD, remaining: articles.length - i }
        );
        circuitBreakerTripped = true;
      }

      if (circuitBreakerTripped) {
        // #172: fail closed. An unassessed article is never accepted; it carries `error` so
        // the run records `assessment_failed`, and stops spending calls on a failing provider.
        for (const _article of batch) {
          assessments.push({
            ...DEFAULT_ASSESSMENT,
            reasoning: 'Circuit breaker open: assessment skipped',
            estimatedCost: 0,
            error: `circuit breaker open: assessment unavailable after ${qualityFailures} failures`,
          });
        }
        continue;
      }

      // Process batch in parallel; per-article errors are caught here so
      // one failure cannot reject the entire Promise.all
      const batchResults = await Promise.all(
        batch.map((article) =>
          this.assessArticle(article).catch((error) => {
            qualityFailures++;
            const message = error instanceof Error ? error.message : String(error);
            loggers.api.error('Quality assessment threw in batch', {
              title: article.title.substring(0, 50),
              error: message,
            });
            return {
              ...DEFAULT_ASSESSMENT,
              estimatedCost: 0,
              error: message, // #167: see assessArticle's catch
            } as QualityAssessment;
          })
        )
      );

      // Track failures from assessArticle's internal error handler (returns DEFAULT_ASSESSMENT)
      for (const result of batchResults) {
        if (result.reasoning === DEFAULT_ASSESSMENT.reasoning) {
          qualityFailures++;
        }
        assessments.push(result);
        totalCost += result.estimatedCost;
      }
    }

    const ingestCount = assessments.filter((a) => a.shouldIngest).length;

    loggers.api.info('Batch article assessment completed', {
      totalArticles: articles.length,
      articlesToIngest: ingestCount,
      rejectedArticles: articles.length - ingestCount,
      qualityFailures,
      circuitBreakerTripped,
      totalCost: totalCost.toFixed(4),
    });

    return assessments;
  }

  /**
   * Build user prompt for article assessment
   * @param article - Article to assess
   * @returns Formatted prompt string
   */
  private buildUserPrompt(article: ArticleToAssess): string {
    const publishedInfo = article.publishedAt
      ? `Published: ${article.publishedAt.toISOString().split('T')[0]}`
      : '';

    return `Evaluate this article:

Title: ${article.title}
Source: ${article.source}
${article.url ? `URL: ${article.url}` : ''}
${publishedInfo}

Content:
${article.content.substring(0, 4000)}${article.content.length > 4000 ? '\n[Content truncated...]' : ''}`;
  }

  /**
   * Parse LLM response into QualityAssessment
   * @param content - Raw LLM response content
   * @param metadata - Generation metadata for cost tracking
   * @returns Parsed quality assessment
   */
  private parseAssessmentResponse(
    content: string,
    metadata: GenerationMetadata
  ): QualityAssessment {
    try {
      // #172: tolerate a fence or prose around the object; never repair a cut-off one.
      const parsed = extractJsonObject(content) as {
        qualityScore?: number;
        relevanceScore?: number;
        credibilityScore?: number;
        reasoning?: string;
        suggestedCategories?: string[];
      };

      // #172: a reply with no numeric score at all (`{}`, drifted keys) is not a verdict.
      if (![parsed.qualityScore, parsed.relevanceScore, parsed.credibilityScore].some(Number.isFinite)) {
        throw new Error('reply has no numeric score');
      }

      // Validate and clamp scores to 0-10 range
      const qualityScore = this.clampScore(parsed.qualityScore);
      const relevanceScore = this.clampScore(parsed.relevanceScore);
      const credibilityScore = this.clampScore(parsed.credibilityScore);

      // Calculate average score
      const averageScore = (qualityScore + relevanceScore + credibilityScore) / 3;

      // Determine if article should be ingested
      const shouldIngest =
        averageScore >= INGEST_THRESHOLDS.minimumAverageScore &&
        relevanceScore >= INGEST_THRESHOLDS.minimumRelevanceScore;

      return {
        qualityScore,
        relevanceScore,
        credibilityScore,
        reasoning: parsed.reasoning || 'No reasoning provided',
        suggestedCategories: Array.isArray(parsed.suggestedCategories)
          ? parsed.suggestedCategories
          : [],
        shouldIngest,
        estimatedCost: metadata.estimatedCost,
      };
    } catch (error) {
      // #172: an unparseable reply is an assessment failure, not a quality verdict. Carry
      // `error` so the run records `assessment_failed`; log at error level, without content.
      const message = error instanceof Error ? error.message : String(error);
      loggers.api.error('Failed to parse LLM assessment response', {
        error: message,
        model: metadata.model,
        contentLength: content.length,
      });

      return {
        ...DEFAULT_ASSESSMENT,
        estimatedCost: metadata.estimatedCost,
        error: `Quality assessment reply unparseable: ${message}`,
      };
    }
  }

  /**
   * Clamp score to valid 0-10 range
   * @param score - Raw score value
   * @returns Clamped score between 0 and 10
   */
  private clampScore(score: unknown): number {
    if (typeof score !== 'number' || isNaN(score)) {
      return 5; // Default to middle score if invalid
    }
    return Math.max(0, Math.min(10, score));
  }
}

/**
 * Singleton instance for application-wide use
 */
let articleQualityServiceInstance: ArticleQualityService | null = null;

/**
 * Get or create Article Quality Service instance
 * @returns Singleton Article Quality service
 */
export function getArticleQualityService(): ArticleQualityService {
  if (!articleQualityServiceInstance) {
    articleQualityServiceInstance = new ArticleQualityService();
  }
  return articleQualityServiceInstance;
}
