/**
 * Article Quality Assessment Service
 * Uses LLM to evaluate article quality, relevance, and credibility for ingestion filtering
 */

import { getOpenRouterService, type GenerationMetadata } from '@/lib/services/openrouter.service';
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
 * Minimum thresholds for article ingestion
 */
const INGEST_THRESHOLDS = {
  minimumAverageScore: 7.0,
  minimumRelevanceScore: 7,
};

/**
 * System prompt for the quality assessment LLM
 */
const SYSTEM_PROMPT = `You are an expert content evaluator for AI Power Rankings, a site tracking AI coding tools and their capabilities.

Evaluate articles for:
1. **Quality** (0-10): Writing quality, depth, accuracy, citations
2. **Relevance** (0-10): How relevant to AI coding tools, LLMs, developer tools
3. **Credibility** (0-10): Source reputation, author expertise, factual accuracy

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
  private readonly model = 'anthropic/claude-sonnet-4';

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
          temperature: 0.3,
          max_tokens: 1000,
        },
        {
          maxAttempts: 3,
          timeoutMs: 30000,
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
      loggers.api.error('Article quality assessment failed', {
        title: article.title.substring(0, 50),
        source: article.source,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ...DEFAULT_ASSESSMENT,
        estimatedCost: 0,
      };
    }
  }

  /**
   * Assess multiple articles in batch
   * @param articles - Array of articles to assess
   * @returns Array of quality assessments in same order as input
   */
  async batchAssess(articles: ArticleToAssess[]): Promise<QualityAssessment[]> {
    const assessments: QualityAssessment[] = [];
    let totalCost = 0;

    for (const article of articles) {
      const assessment = await this.assessArticle(article);
      assessments.push(assessment);
      totalCost += assessment.estimatedCost;
    }

    const ingestCount = assessments.filter((a) => a.shouldIngest).length;

    loggers.api.info('Batch article assessment completed', {
      totalArticles: articles.length,
      articlesToIngest: ingestCount,
      rejectedArticles: articles.length - ingestCount,
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
      // Extract JSON from response (handle markdown code blocks)
      let jsonContent = content.trim();

      // Remove markdown code block if present
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonContent) as {
        qualityScore?: number;
        relevanceScore?: number;
        credibilityScore?: number;
        reasoning?: string;
        suggestedCategories?: string[];
      };

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
      loggers.api.warn('Failed to parse LLM assessment response', {
        error: error instanceof Error ? error.message : String(error),
        contentPreview: content.substring(0, 200),
      });

      return {
        ...DEFAULT_ASSESSMENT,
        estimatedCost: metadata.estimatedCost,
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
