/**
 * Drizzle ORM Schema Definitions
 * Strategic JSONB usage for flexible data storage while maintaining queryability
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Tools table - AI coding tools and assistants
 * Using JSONB for flexible metadata while keeping key fields indexed
 */
export const tools = pgTable(
  "tools",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),

    // Core attributes as columns for efficient querying
    category: text("category").notNull(), // e.g., 'code-editor', 'autonomous-agent'
    status: text("status").notNull().default("active"), // 'active', 'inactive', 'deprecated'
    companyId: text("company_id"),

    // Scoring fields for baseline + delta tracking
    baselineScore: jsonb("baseline_score").default("{}"), // Stores baseline scores per factor
    deltaScore: jsonb("delta_score").default("{}"), // Stores delta modifications per factor
    currentScore: jsonb("current_score").default("{}"), // Cached current score calculation
    scoreUpdatedAt: timestamp("score_updated_at"), // Last time score was recalculated

    // Flexible JSONB storage for all other tool data
    // Preserves the existing JSON structure from /data/json/tools/
    data: jsonb("data").notNull().default("{}"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for common queries
    slugIdx: uniqueIndex("tools_slug_idx").on(table.slug),
    categoryIdx: index("tools_category_idx").on(table.category),
    statusIdx: index("tools_status_idx").on(table.status),
    nameIdx: index("tools_name_idx").on(table.name),
    // Timestamp indexes for sorting and filtering recent updates
    updatedAtIdx: index("tools_updated_at_idx").on(table.updatedAt),
    createdAtIdx: index("tools_created_at_idx").on(table.createdAt),
    // GIN index for JSONB queries
    dataIdx: index("tools_data_gin_idx").using("gin", table.data),
  })
);

/**
 * Rankings table - Monthly AI tool rankings
 * Stores entire ranking period data in JSONB
 */
export const rankings = pgTable(
  "rankings",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    period: text("period").notNull(), // e.g., '2025-09'

    // Metadata
    algorithmVersion: text("algorithm_version").notNull().default("v1.0"),
    isCurrent: boolean("is_current").notNull().default(false),
    publishedAt: timestamp("published_at"),

    // Complete rankings data as JSONB
    // Preserves the structure from /public/data/rankings.json
    data: jsonb("data").notNull().default("[]"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    periodIdx: uniqueIndex("rankings_period_idx").on(table.period),
    currentIdx: index("rankings_current_idx").on(table.isCurrent),
    publishedIdx: index("rankings_published_idx").on(table.publishedAt),
    // GIN index for JSONB queries
    dataIdx: index("rankings_data_gin_idx").using("gin", table.data),
  })
);

/**
 * News table - AI industry news and articles
 * Flexible JSONB storage with key fields extracted
 */
export const news = pgTable(
  "news",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    articleId: text("article_id").unique(), // Legacy ID from JSON

    // Core searchable fields
    title: text("title").notNull(),
    summary: text("summary"),
    category: text("category"),
    source: text("source"),
    sourceUrl: text("source_url"),

    // Dates
    publishedAt: timestamp("published_at").notNull(),
    date: timestamp("date"),

    // Complete article data as JSONB
    // Preserves all fields from /data/json/news/
    data: jsonb("data").notNull().default("{}"),

    // Tool associations (stored as array in JSONB)
    toolMentions: jsonb("tool_mentions").default("[]"),

    // Metadata
    importanceScore: integer("importance_score").default(0),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    slugIdx: uniqueIndex("news_slug_idx").on(table.slug),
    articleIdIdx: uniqueIndex("news_article_id_idx").on(table.articleId),
    publishedIdx: index("news_published_idx").on(table.publishedAt),
    createdAtIdx: index("news_created_at_idx").on(table.createdAt),
    categoryIdx: index("news_category_idx").on(table.category),
    sourceIdx: index("news_source_idx").on(table.source),
    importanceIdx: index("news_importance_idx").on(table.importanceScore),
    // GIN indexes for JSONB
    dataIdx: index("news_data_gin_idx").using("gin", table.data),
    toolMentionsIdx: index("news_tool_mentions_gin_idx").using("gin", table.toolMentions),
    // Full text search index on title and summary
    titleSearchIdx: index("news_title_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.title})`
    ),
  })
);

/**
 * Companies table - Optional, for future normalization
 * Currently company data is embedded in tools
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),

    // All company data as JSONB
    data: jsonb("data").notNull().default("{}"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("companies_slug_idx").on(table.slug),
    nameIdx: index("companies_name_idx").on(table.name),
    dataIdx: index("companies_data_gin_idx").using("gin", table.data),
  })
);

/**
 * Migration tracking table
 * Tracks JSON to PostgreSQL migration status
 */
export const migrations = pgTable(
  "migrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    status: text("status").notNull(), // 'pending', 'running', 'completed', 'failed'
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    error: text("error"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("migrations_name_idx").on(table.name),
    statusIdx: index("migrations_status_idx").on(table.status),
  })
);

/**
 * Monthly Summaries table
 * Stores LLM-generated "What's New" monthly summaries
 */
export const monthlySummaries = pgTable(
  "monthly_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    period: text("period").notNull().unique(), // Format: YYYY-MM
    content: text("content").notNull(), // LLM-generated markdown content
    dataHash: text("data_hash").notNull(), // SHA-256 hash for change detection
    metadata: jsonb("metadata").default("{}"), // article_count, tool_count, model_used, etc.
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    periodIdx: uniqueIndex("monthly_summaries_period_idx").on(table.period),
    generatedAtIdx: index("monthly_summaries_generated_at_idx").on(table.generatedAt),
    metadataIdx: index("monthly_summaries_metadata_idx").using("gin", table.metadata),
  })
);

/**
 * State of AI Summaries table
 * Stores LLM-generated monthly "State of AI" editorial summaries
 */
export const stateOfAiSummaries = pgTable(
  "state_of_ai_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    month: integer("month").notNull(), // 1-12
    year: integer("year").notNull(), // e.g., 2025
    content: text("content").notNull(), // LLM-generated markdown content (400-500 words)
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    generatedBy: text("generated_by").notNull(), // User ID/email who triggered generation
    metadata: jsonb("metadata").default("{}"), // article_count, date_range, model_used, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint: only one summary per month/year combination
    monthYearIdx: uniqueIndex("state_of_ai_summaries_month_year_idx").on(table.month, table.year),
    generatedAtIdx: index("state_of_ai_summaries_generated_at_idx").on(table.generatedAt),
    metadataIdx: index("state_of_ai_summaries_metadata_idx").using("gin", table.metadata),
  })
);

/**
 * User Preferences
 * NOTE: User preferences are now stored in Clerk's privateMetadata
 * instead of a separate database table for simplified architecture.
 * See /app/api/user/preferences/route.ts for implementation.
 */

/**
 * Automated Ingestion Runs table
 * Tracks automated AI news ingestion runs and metrics
 */
export const automatedIngestionRuns = pgTable(
  "automated_ingestion_runs",
  {
    // Primary identifier
    id: uuid("id").defaultRandom().primaryKey(),

    // Run details
    runType: varchar("run_type", { length: 50 }).notNull(), // 'daily_news', 'monthly_summary', 'manual'
    status: varchar("status", { length: 20 }).notNull().default("running"), // 'running', 'completed', 'failed'

    // Metrics
    articlesDiscovered: integer("articles_discovered").default(0),
    articlesPassedQuality: integer("articles_passed_quality").default(0),
    articlesIngested: integer("articles_ingested").default(0),
    articlesSkipped: integer("articles_skipped").default(0),
    articlesSkippedSemantic: integer("articles_skipped_semantic").default(0),
    rankingChanges: integer("ranking_changes").default(0),

    // Timing and details
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    searchQuery: text("search_query"),
    errorLog: jsonb("error_log").default("[]"),
    ingestedArticleIds: jsonb("ingested_article_ids").default("[]"),
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 4 }).default("0"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    statusIdx: index("idx_automated_ingestion_runs_status").on(table.status),
    runTypeIdx: index("idx_automated_ingestion_runs_run_type").on(table.runType),
    createdAtIdx: index("idx_automated_ingestion_runs_created_at").on(table.createdAt),
  })
);

// Type exports for TypeScript
export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;
export type Ranking = typeof rankings.$inferSelect;
export type NewRanking = typeof rankings.$inferInsert;
export type NewsArticle = typeof news.$inferSelect;
export type NewNewsArticle = typeof news.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Migration = typeof migrations.$inferSelect;
export type NewMigration = typeof migrations.$inferInsert;
export type MonthlySummary = typeof monthlySummaries.$inferSelect;
export type NewMonthlySummary = typeof monthlySummaries.$inferInsert;
export type StateOfAiSummary = typeof stateOfAiSummaries.$inferSelect;
export type NewStateOfAiSummary = typeof stateOfAiSummaries.$inferInsert;
export type AutomatedIngestionRun = typeof automatedIngestionRuns.$inferSelect;
export type NewAutomatedIngestionRun = typeof automatedIngestionRuns.$inferInsert;

// Enum types for type safety
export type AutomatedIngestionRunStatus = "running" | "completed" | "failed";
export type IngestionRunType = "daily_news" | "monthly_summary" | "manual";
export type DiscoverySource = "manual" | "brave_search" | "rss_feed";

export type {
  Article,
  ArticleProcessingLog,
  ArticleRankingsChange,
  NewArticle,
  NewArticleProcessingLog,
  NewArticleRankingsChange,
  NewRankingVersion,
  RankingVersion,
} from "./article-schema";
// Export article tables from article-schema.ts
export {
  articleProcessingLogs,
  articleRankingsChanges,
  articleStatusEnum,
  articles,
  rankingVersions,
} from "./article-schema";
