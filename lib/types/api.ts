/**
 * API Types and Interfaces
 * Provides type-safe API request/response structures
 */

import type { AppError, ArticleId, CompanyId, Result, ToolId } from "./index";

// ==================== Common API Types ====================

export interface APIResponse<T> {
  readonly data?: T;
  readonly error?: string;
  readonly message?: string;
  readonly timestamp: string;
}

export interface PaginatedResponse<T> extends APIResponse<T> {
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface APIError {
  readonly error: string;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;
}

// ==================== Tool API Types ====================

export interface ToolInfo {
  readonly company: {
    readonly name: string;
    readonly id?: CompanyId;
  };
  readonly product: {
    readonly description: string;
    readonly tagline?: string;
    readonly pricing_model?: string;
    readonly license_type: string;
  };
  readonly links: {
    readonly website?: string;
    readonly github?: string;
    readonly documentation?: string;
  };
  readonly technical: {
    readonly supported_languages?: string[];
    readonly ide_integrations?: string[];
    readonly api_available?: boolean;
  };
  readonly business: {
    readonly pricing_model?: string;
    readonly free_tier?: boolean;
  };
  readonly metrics: {
    readonly swe_bench?: {
      readonly verified?: number;
      readonly lite?: number;
      readonly full?: number;
    };
    readonly github_stars?: number;
    readonly user_count?: number;
  };
  readonly metadata: {
    readonly logo_url?: string;
  };
}

export interface ToolScoring {
  readonly baseline_score?: Record<string, number>;
  readonly delta_score?: Record<string, number>;
  readonly current_score?: Record<string, number>;
  readonly score_updated_at?: string;
}

export interface APITool {
  readonly id: ToolId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly status: "active" | "inactive" | "deprecated";
  readonly created_at: string;
  readonly updated_at: string;
  readonly tags: readonly string[];
  readonly info: ToolInfo;
  readonly scoring?: ToolScoring;
  readonly use_cases?: readonly string[];
  readonly website_url?: string; // Root-level website URL for icon display
  readonly logo_url?: string; // Root-level logo URL for icon display
}

export interface ToolsResponse extends APIResponse<{ tools: readonly APITool[] }> {
  readonly data: {
    readonly tools: readonly APITool[];
    readonly _source: string;
    readonly _timestamp: string;
  };
}

// ==================== Rankings API Types ====================

export interface RankingScores {
  readonly overall: number;
  readonly base_score: number;
  readonly news_impact: number;
  readonly agentic_capability: number;
  readonly innovation: number;
}

export interface RankingMetrics {
  readonly news_articles_count: number;
  readonly recent_funding_rounds: number;
  readonly recent_product_launches: number;
  readonly users: number;
  readonly swe_bench_score?: number | null;
}

export interface RankedTool {
  readonly id: ToolId;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly status: string;
  readonly website_url: string;
  readonly description: string;
}

export interface RankingEntry {
  readonly rank: number;
  readonly previousRank?: number | null;
  readonly rankChange: number;
  readonly changeReason: string;
  readonly tool: RankedTool;
  readonly total_score: number;
  readonly scores: RankingScores;
  readonly metrics: RankingMetrics;
  readonly tier?: string;
}

export interface RankingAlgorithm {
  readonly version: string;
  readonly name: string;
  readonly date: string;
  readonly weights: {
    readonly newsImpact: number;
    readonly baseScore: number;
  };
}

export interface RankingStats {
  readonly total_tools: number;
  readonly tools_with_news: number;
  readonly avg_news_boost: number;
  readonly max_news_impact: number;
}

export interface RankingsResponse extends APIResponse<{ rankings: readonly RankingEntry[] }> {
  readonly data: {
    readonly rankings: readonly RankingEntry[];
    readonly algorithm: RankingAlgorithm;
    readonly stats: RankingStats;
    readonly _source: string;
    readonly _timestamp: string;
    readonly _cacheVersion: string;
  };
}

// ==================== Article API Types ====================

export interface ArticleMetadata {
  readonly author?: string;
  readonly publishedDate?: string;
  readonly category?: string;
  readonly tags: readonly string[];
}

export interface ToolMention {
  readonly name: string;
  readonly relevance: number;
  readonly sentiment: number;
  readonly context: string;
}

export interface CompanyMention {
  readonly name: string;
  readonly relevance: number;
  readonly context: string;
}

export interface APIArticle {
  readonly id: ArticleId;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly sourceUrl?: string;
  readonly sourceName?: string;
  readonly ingestionType: "url" | "file" | "text";
  readonly toolMentions: readonly ToolMention[];
  readonly companyMentions: readonly CompanyMention[];
  readonly importanceScore: number;
  readonly sentimentScore: string;
  readonly metadata: ArticleMetadata;
  readonly status: "active" | "inactive" | "draft";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ArticlesResponse extends APIResponse<{ articles: readonly APIArticle[] }> {
  readonly data: {
    readonly articles: readonly APIArticle[];
    readonly _source: string;
    readonly _timestamp: string;
  };
}

// ==================== Request Types ====================

export interface ToolRequest {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly website?: string;
  readonly github?: string;
  readonly companyId?: CompanyId;
}

export interface ArticleRequest {
  readonly title: string;
  readonly content: string;
  readonly sourceUrl?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly metadata?: Partial<ArticleMetadata>;
}

export type UpdateToolRequest = Partial<ToolRequest>;

export type UpdateArticleRequest = Partial<ArticleRequest>;

// ==================== Search and Filter Types ====================

export interface ToolsSearchParams {
  readonly q?: string;
  readonly category?: string;
  readonly status?: "active" | "inactive" | "deprecated";
  readonly sortBy?: "name" | "rank" | "score" | "created_at";
  readonly sortOrder?: "asc" | "desc";
  readonly page?: number;
  readonly limit?: number;
}

export interface RankingsSearchParams {
  readonly category?: string;
  readonly tier?: string;
  readonly limit?: number;
  readonly includeMetrics?: boolean;
}

// ==================== Next.js Route Handler Types ====================

export interface RouteContext {
  readonly params: {
    readonly slug: string;
    readonly [key: string]: string;
  };
}

export interface ToolRouteContext extends RouteContext {
  readonly params: {
    readonly slug: string;
  };
}

// ==================== Response Builders ====================

export function createSuccessResponse<T>(data: T, message?: string): APIResponse<T> {
  return {
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(
  error: string,
  code?: string,
  details?: Record<string, unknown>
): APIError {
  return {
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
  };
}

export function createPaginatedResponse<T>(
  data: T,
  pagination: PaginatedResponse<T>["pagination"],
  message?: string
): PaginatedResponse<T> {
  return {
    data,
    message,
    pagination,
    timestamp: new Date().toISOString(),
  };
}

// ==================== Type-Safe Result Builders ====================

export function createToolsResult(tools: readonly APITool[]): Result<ToolsResponse, AppError> {
  try {
    const response: ToolsResponse = {
      data: {
        tools,
        _source: "json-db",
        _timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
    return { success: true, data: response };
  } catch (error) {
    return {
      success: false,
      error: {
        type: "database",
        operation: "createToolsResult",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

export function createRankingsResult(
  rankings: readonly RankingEntry[],
  algorithm: RankingAlgorithm,
  stats: RankingStats
): Result<RankingsResponse, AppError> {
  try {
    const response: RankingsResponse = {
      data: {
        rankings,
        algorithm,
        stats,
        _source: "json-db",
        _timestamp: new Date().toISOString(),
        _cacheVersion: "2025-07-29-v1",
      },
      timestamp: new Date().toISOString(),
    };
    return { success: true, data: response };
  } catch (error) {
    return {
      success: false,
      error: {
        type: "database",
        operation: "createRankingsResult",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}
