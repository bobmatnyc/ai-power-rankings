/**
 * Articles Repository Module
 * Re-exports all article-related repositories and services for backward compatibility
 */

// Core CRUD operations
export { ArticlesCoreRepository } from "./articles-core.repository";

// Query and search operations
export { ArticlesQueryRepository } from "./articles-query.repository";

// Statistics and impact analysis
export { ArticlesStatisticsService } from "./articles-statistics.service";

// Ranking and processing operations
export { ArticlesRankingService } from "./articles-ranking.service";

// Slug generation operations
export { ArticlesSlugService } from "./articles-slug.service";

// Entity auto-creation operations
export {
  ArticlesEntitiesService,
  type AutoToolInput,
  type AutoToolResult,
  type AutoCompanyInput,
  type AutoCompanyResult,
} from "./articles-entities.service";
