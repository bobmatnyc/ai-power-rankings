/**
 * Types Module Index
 * Centralized exports for all type definitions
 */

// ==================== API Types ====================
export type {
  APIArticle,
  APIError,
  // Common API types
  APIResponse,
  APITool,
  // Article API types
  ArticleMetadata,
  ArticleRequest,
  ArticlesResponse,
  CompanyMention,
  PaginatedResponse,
  RankedTool,
  RankingAlgorithm,
  RankingEntry,
  RankingMetrics,
  // Rankings API types
  RankingScores,
  RankingStats,
  RankingsResponse,
  RankingsSearchParams,
  // Next.js route handler types
  RouteContext,
  // Tool API types
  ToolInfo,
  ToolMention,
  ToolRequest,
  ToolRouteContext,
  ToolsResponse,
  // Search and filter types
  ToolsSearchParams,
  UpdateArticleRequest,
  UpdateToolRequest,
} from "./api";
export {
  createErrorResponse,
  createPaginatedResponse,
  createRankingsResult,
  // Response builders
  createSuccessResponse,
  createToolsResult,
} from "./api";
// ==================== Article Analysis Types ====================
export type {
  // Analysis result types
  AIAnalysisResult,
  ArticleIngestionMetadata,
  ArticleProcessingContext,
  CompanyMentionAnalysis,
  // Rankings types
  CurrentRanking,
  EntityIdentificationResult,
  NewCompanyEntity,
  // Entity types
  NewToolEntity,
  RankingChange,
  // Snapshot and context types
  RankingsSnapshot,
  ToolMentionAnalysis,
  ValidatedCompanyMention,
  // Validation types
  ValidatedToolMention,
} from "./article-analysis";
export {
  cleanCompanyMentions,
  cleanToolMentions,
  ensureArray,
  isCompanyMentionAnalysis,
  isCurrentRanking,
  // Type guards
  isToolMentionAnalysis,
  safeToNumber,
  // Data transformation functions
  safeToString,
  validateCompanyMention,
  // Score validation
  validateImportanceScore,
  // Date validation
  validatePublishedDate,
  validateSentimentScore,
  validateToolMention,
} from "./article-analysis";
// ==================== Branded Types ====================
export type {
  ArticleId,
  // Core branded types
  Brand,
  BrandedIdArray,
  // Collection types
  BrandedIdMap,
  BrandedIdSet,
  CategoryId,
  CompanyId,
  ProcessingLogId,
  RankingId,
  ToolId,
  UserId,
} from "./branded";
export {
  assertions,
  compareBrandedIds,
  isArticleId,
  isCategoryId,
  isCompanyId,
  isProcessingLogId,
  isRankingId,
  // Type guards
  isToolId,
  isUserId,
  safeToArticleId,
  safeToCategoryId,
  safeToCompanyId,
  safeToProcessingLogId,
  safeToRankingId,
  // Safe converters
  safeToToolId,
  safeToUserId,
  toArticleId,
  toArticleIdArray,
  toCategoryId,
  toCompanyId,
  toCompanyIdArray,
  toProcessingLogId,
  toRankingId,
  // Creation functions
  toToolId,
  // Array helpers
  toToolIdArray,
  toUserId,
  toUserIdArray,
  // Utilities
  unwrapBrand,
} from "./branded";
// ==================== Path Types ====================
export type {
  AdminRoute,
  // API path types
  APIPath,
  APIVersion,
  // Route types
  AppRoute,
  ArticleAPIEndpoint,
  AssetPath,
  CatchAllSegment,
  CompanyAPIEndpoint,
  CompanyRoute,
  CompanyRouteParams,
  DynamicRoute,
  // Next.js types
  DynamicSegment,
  IconPath,
  ImagePath,
  // Locale types
  Locale,
  LocaleSlug,
  LocalizedAppRoute,
  LocalizedCompanyRoute,
  LocalizedNewsRoute,
  LocalizedPagePath,
  // Localized path types
  LocalizedPath,
  LocalizedRootPath,
  // Localized route types
  LocalizedToolRoute,
  ManifestPath,
  NewsAPIEndpoint,
  NewsRoute,
  NewsRouteParams,
  NewsSearchParams,
  OptionalCatchAllSegment,
  RankingsAPIEndpoint,
  RobotsTxtPath,
  // Parameter types
  RouteParams,
  SearchParams,
  // SEO types
  SitemapPath,
  // Asset types
  StaticAsset,
  // API endpoint types
  ToolAPIEndpoint,
  ToolRoute,
  ToolRouteParams,
  ToolSearchParams,
  VersionedAPIPath,
} from "./paths";
export {
  adminPath,
  apiPath,
  companyPath,
  extractLocale,
  // Path validation
  isAPIPath,
  isLocalizedPath,
  localizedCompanyPath,
  localizedNewsPath,
  // Path construction helpers
  localizedPath,
  localizedToolPath,
  newsPath,
  stripLocale,
  toolPath,
  versionedApiPath,
} from "./paths";
// ==================== Result Pattern ====================
export type {
  AppError,
  // Type aliases
  AppResult,
  AsyncAppResult,
  AsyncResult,
  DatabaseError,
  NetworkError,
  NotFoundError,
  // Core Result types
  Result,
  // Error types
  ValidationError,
} from "./result";
export {
  chain,
  chainAsync,
  chainErr,
  combineAsyncResults,
  // Collection functions
  combineResults,
  databaseError,
  err,
  errAsync,
  filterErr,
  filterOk,
  isErr,
  // Type guards
  isOk,
  // Transformation functions
  map,
  mapAsync,
  mapErr,
  mapErrAsync,
  // Pattern matching
  match,
  matchAsync,
  networkError,
  notFoundError,
  // Constructor functions
  ok,
  okAsync,
  // Exception handling
  tryCatch,
  tryCatchAsync,
  // Utility functions
  unwrap,
  unwrapErr,
  unwrapOr,
  unwrapOrElse,
  // Validation
  validate,
  // Error constructors
  validationError,
  validator,
} from "./result";
