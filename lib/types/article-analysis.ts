/**
 * Article Analysis Types
 * Types for AI analysis results and data transformation in article ingestion
 */

// Imported types are used in documentation and future enhancements

// ==================== AI Analysis Types ====================

export interface AIAnalysisResult {
  readonly title: string;
  readonly summary: string;
  readonly source?: string;
  readonly tags: readonly string[];
  readonly category?: string;
  readonly importance_score: number;
  readonly overall_sentiment: number;
  readonly published_date?: string;
  readonly tool_mentions: readonly ToolMentionAnalysis[];
  readonly company_mentions: readonly CompanyMentionAnalysis[];
  readonly content?: string;
  readonly rewritten_excerpt?: string;
  readonly sourceUrl?: string;
  readonly url?: string;

  // Additional fields required by rankings calculator
  readonly key_insights?: string[];
  readonly ranking_impacts?: {
    readonly positive_impacts?: Array<{
      readonly tool: string;
      readonly impact_type: string;
      readonly magnitude: number;
      readonly reason: string;
    }>;
    readonly negative_impacts?: Array<{
      readonly tool: string;
      readonly impact_type: string;
      readonly magnitude: number;
      readonly reason: string;
    }>;
  };
}

export interface ToolMentionAnalysis {
  readonly name?: string;
  readonly tool_name?: string;
  readonly tool: string; // Required by rankings calculator
  readonly relevance: number;
  readonly sentiment: number;
  readonly context: string;
}

export interface CompanyMentionAnalysis {
  readonly name?: string;
  readonly company_name?: string;
  readonly company: string; // Required by rankings calculator
  readonly relevance?: number;
  readonly context: string;
  readonly tools?: string[]; // Optional field sometimes present
}

// ==================== Rankings Data Types ====================

export interface CurrentRanking {
  readonly id: string;
  readonly tool_id: string;
  readonly tool_name: string;
  readonly name: string;
  readonly rank: number;
  readonly score: number;
  readonly metrics: Record<string, unknown>;
}

export interface RankingChange {
  readonly toolId: string;
  readonly toolName: string;
  readonly currentRank?: number;
  readonly predictedRank?: number;
  readonly rankChange?: number;
  readonly currentScore?: number;
  readonly predictedScore?: number;
  readonly scoreChange?: number;
  readonly metrics: Record<string, unknown>;
}

// ==================== Entity Detection Types ====================

export interface NewToolEntity {
  readonly name: string;
  readonly category?: string;
  readonly companyId?: string;
}

export interface NewCompanyEntity {
  readonly name: string;
  readonly website?: string;
}

export interface EntityIdentificationResult {
  readonly newTools: readonly NewToolEntity[];
  readonly newCompanies: readonly NewCompanyEntity[];
}

// ==================== Snapshot Types ====================

export interface RankingsSnapshot {
  readonly timestamp: string;
  readonly rankings: readonly CurrentRanking[];
}

// ==================== Processing Context Types ====================

export interface ExtractedLink {
  readonly href: string;
  readonly text: string;
}

export interface ArticleProcessingContext {
  readonly url?: string;
  readonly fileName?: string;
  readonly author?: string;
  readonly links?: readonly ExtractedLink[];
}

export interface ArticleIngestionMetadata {
  readonly author?: string;
}

// ==================== Data Transformation Helpers ====================

export interface ValidatedToolMention {
  readonly name: string;
  readonly relevance: number;
  readonly sentiment: number;
  readonly context: string;
  readonly toolId?: string; // Optional tool ID from database
}

export interface ValidatedCompanyMention {
  readonly name: string;
  readonly relevance: number;
  readonly context: string;
}

// ==================== Type Guards ====================

export function isToolMentionAnalysis(value: unknown): value is ToolMentionAnalysis {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).name === "string" &&
    typeof (value as any).relevance === "number" &&
    typeof (value as any).sentiment === "number" &&
    typeof (value as any).context === "string"
  );
}

export function isCompanyMentionAnalysis(value: unknown): value is CompanyMentionAnalysis {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).name === "string" &&
    typeof (value as any).relevance === "number" &&
    typeof (value as any).context === "string"
  );
}

export function isCurrentRanking(value: unknown): value is CurrentRanking {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).id === "string" &&
    typeof (value as any).tool_id === "string" &&
    typeof (value as any).tool_name === "string" &&
    typeof (value as any).rank === "number" &&
    typeof (value as any).score === "number"
  );
}

// ==================== Data Transformation Functions ====================

/**
 * Safely convert unknown value to string with default
 */
export function safeToString(value: unknown, defaultValue = "0"): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * Safely convert value to number with bounds checking
 */
export function safeToNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(num)) return defaultValue;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Ensure array format for unknown value
 */
export function ensureArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Validate and clean tool mention data
 */
export function validateToolMention(mention: unknown): ValidatedToolMention | null {
  if (typeof mention === "string") {
    return {
      name: mention,
      relevance: 0.5,
      sentiment: 0,
      context: "",
    };
  }

  if (typeof mention === "object" && mention !== null) {
    const mentionObj = mention as any;
    return {
      name: mentionObj.name || mentionObj.tool_name || mentionObj.tool || "Unknown",
      relevance: typeof mentionObj.relevance === "number" ? mentionObj.relevance : 0.5,
      sentiment: typeof mentionObj.sentiment === "number" ? mentionObj.sentiment : 0,
      context: typeof mentionObj.context === "string" ? mentionObj.context : "",
    };
  }

  return null;
}

/**
 * Validate and clean company mention data
 */
export function validateCompanyMention(mention: unknown): ValidatedCompanyMention | null {
  if (typeof mention === "string") {
    return {
      name: mention,
      relevance: 0.5,
      context: "",
    };
  }

  if (typeof mention === "object" && mention !== null) {
    const mentionObj = mention as any;
    return {
      name: mentionObj.name || mentionObj.company_name || mentionObj.company || "Unknown",
      relevance: typeof mentionObj.relevance === "number" ? mentionObj.relevance : 0.5,
      context: typeof mentionObj.context === "string" ? mentionObj.context : "",
    };
  }

  return null;
}

/**
 * Clean and validate tool mentions array
 */
export function cleanToolMentions(mentions: unknown): ValidatedToolMention[] {
  return ensureArray(mentions)
    .map(validateToolMention)
    .filter((mention): mention is ValidatedToolMention => mention !== null);
}

/**
 * Clean and validate company mentions array
 */
export function cleanCompanyMentions(mentions: unknown): ValidatedCompanyMention[] {
  return ensureArray(mentions)
    .map(validateCompanyMention)
    .filter((mention): mention is ValidatedCompanyMention => mention !== null);
}

// ==================== Score Validation ====================

/**
 * Validate importance score (1-10)
 */
export function validateImportanceScore(score: unknown): number {
  return safeToNumber(score, 1, 10, 5);
}

/**
 * Validate sentiment score (-1 to 1, formatted to 2 decimal places)
 */
export function validateSentimentScore(score: unknown): string {
  const numScore = safeToNumber(score, -1, 1, 0);
  return numScore.toFixed(2);
}

// ==================== Date Validation ====================

/**
 * Validate and parse published date
 */
export function validatePublishedDate(dateValue: unknown): Date {
  if (!dateValue) return new Date();

  const date = new Date(String(dateValue));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}
