/**
 * Article Management Schema Definitions
 * Extended schema for article ingestion and rankings tracking
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Enums
export const ingestionTypeEnum = pgEnum("ingestion_type", ["url", "text", "file"]);
export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "active",
  "archived",
  "deleted",
]);
export const changeTypeEnum = pgEnum("change_type", [
  "increase",
  "decrease",
  "new_entry",
  "no_change",
]);
export const processingActionEnum = pgEnum("processing_action", [
  "dry_run",
  "ingest",
  "update",
  "recalculate",
  "delete",
  "rollback",
]);
export const processingStatusEnum = pgEnum("processing_status", ["started", "completed", "failed"]);

/**
 * Articles table - Main table for storing ingested articles
 */
export const articles = pgTable(
  "articles",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 500 }).notNull(),
    summary: text("summary"),
    content: text("content").notNull(),
    // Full article body stored as markdown for long-form content
    contentMarkdown: text("content_markdown"),

    // Ingestion metadata
    ingestionType: varchar("ingestion_type", { length: 20 }).notNull(),
    sourceUrl: varchar("source_url", { length: 1000 }),
    sourceName: varchar("source_name", { length: 255 }),
    fileName: varchar("file_name", { length: 255 }),
    fileType: varchar("file_type", { length: 50 }),

    // Content analysis
    tags: text("tags").array().default(sql`'{}'::text[]`),
    category: varchar("category", { length: 100 }),
    importanceScore: integer("importance_score").default(5),
    sentimentScore: decimal("sentiment_score", { precision: 3, scale: 2 }),

    // Tool and company mentions
    toolMentions: jsonb("tool_mentions").default("[]"),
    companyMentions: jsonb("company_mentions").default("[]"),

    // Rankings snapshot
    rankingsSnapshot: jsonb("rankings_snapshot"),

    // Metadata
    author: varchar("author", { length: 255 }),
    publishedDate: timestamp("published_date"),
    ingestedAt: timestamp("ingested_at").defaultNow(),
    ingestedBy: varchar("ingested_by", { length: 255 }).default("admin"),

    // Status tracking
    status: varchar("status", { length: 20 }).default("active"),
    isProcessed: boolean("is_processed").default(false),
    processedAt: timestamp("processed_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    slugIdx: uniqueIndex("idx_articles_slug").on(table.slug),
    statusIdx: index("idx_articles_status").on(table.status),
    publishedDateIdx: index("idx_articles_published_date").on(table.publishedDate),
    importanceIdx: index("idx_articles_importance").on(table.importanceScore),
    ingestedAtIdx: index("idx_articles_ingested_at").on(table.ingestedAt),
    tagsIdx: index("idx_articles_tags").using("gin", table.tags),
    toolMentionsIdx: index("idx_articles_tool_mentions").using("gin", table.toolMentions),
    companyMentionsIdx: index("idx_articles_company_mentions").using("gin", table.companyMentions),
  })
);

/**
 * Article Rankings Changes table - Tracks specific ranking changes caused by each article
 */
export const articleRankingsChanges = pgTable(
  "article_rankings_changes",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    toolId: varchar("tool_id", { length: 50 }).notNull(),
    toolName: varchar("tool_name", { length: 255 }).notNull(),

    // Article source tracking for deduplication
    articleUrl: varchar("article_url", { length: 1000 }),

    // Ranking changes
    metricChanges: jsonb("metric_changes").notNull(),
    oldRank: integer("old_rank"),
    newRank: integer("new_rank"),
    rankChange: integer("rank_change"),

    // Score changes
    oldScore: decimal("old_score", { precision: 10, scale: 4 }),
    newScore: decimal("new_score", { precision: 10, scale: 4 }),
    scoreChange: decimal("score_change", { precision: 10, scale: 4 }),

    // Change metadata
    changeType: varchar("change_type", { length: 20 }),
    changeReason: text("change_reason"),

    // Rollback support
    isApplied: boolean("is_applied").default(true),
    appliedAt: timestamp("applied_at").defaultNow(),
    rolledBack: boolean("rolled_back").default(false),
    rolledBackAt: timestamp("rolled_back_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Indexes
    articleIdIdx: index("idx_article_rankings_article_id").on(table.articleId),
    toolIdIdx: index("idx_article_rankings_tool_id").on(table.toolId),
    appliedIdx: index("idx_article_rankings_applied").on(table.isApplied),
    changeTypeIdx: index("idx_article_rankings_change_type").on(table.changeType),
    articleUrlIdx: index("idx_article_rankings_article_url").on(table.articleUrl),
  })
);

/**
 * Article Processing Logs table - Logs for tracking article processing history
 */
export const articleProcessingLogs = pgTable(
  "article_processing_logs",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),

    // Processing details
    action: varchar("action", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),

    // Processing metadata
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"),

    // Results
    toolsAffected: integer("tools_affected").default(0),
    companiesAffected: integer("companies_affected").default(0),
    rankingsChanged: integer("rankings_changed").default(0),

    // Debug information
    errorMessage: text("error_message"),
    debugInfo: jsonb("debug_info"),

    // User tracking
    performedBy: varchar("performed_by", { length: 255 }).default("system"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Indexes
    articleIdIdx: index("idx_article_processing_article_id").on(table.articleId),
    actionIdx: index("idx_article_processing_action").on(table.action),
    statusIdx: index("idx_article_processing_status").on(table.status),
    createdIdx: index("idx_article_processing_created").on(table.createdAt),
  })
);

/**
 * Ranking Versions table - Complete snapshot versioning for rollback capability
 * Each version represents a complete state of rankings at a point in time
 */
export const rankingVersions = pgTable(
  "ranking_versions",
  {
    // Primary identifiers
    id: uuid("id").defaultRandom().primaryKey(),
    version: varchar("version", { length: 50 }).notNull().unique(), // e.g., "1.0.0", "1.0.1"

    // Article association (optional - versions can be created for various reasons)
    articleId: uuid("article_id").references(() => articles.id, { onDelete: "set null" }),

    // Complete rankings snapshot at this version
    rankingsSnapshot: jsonb("rankings_snapshot").notNull(),

    // Version metadata
    changesSummary: text("changes_summary"),
    newsItemsCount: integer("news_items_count").default(0),
    toolsAffected: integer("tools_affected").default(0),

    // Version lineage - self-reference requires explicit type
    previousVersionId: uuid("previous_version_id"),

    // User tracking
    createdBy: varchar("created_by", { length: 255 }).default("system"),
    createdAt: timestamp("created_at").defaultNow().notNull(),

    // Rollback tracking
    isRollback: boolean("is_rollback").default(false),
    rolledBackFromId: uuid("rolled_back_from_id"),
  },
  (table) => ({
    // Indexes
    versionIdx: uniqueIndex("idx_ranking_versions_version").on(table.version),
    articleIdIdx: index("idx_ranking_versions_article_id").on(table.articleId),
    createdAtIdx: index("idx_ranking_versions_created_at").on(table.createdAt),
    previousVersionIdx: index("idx_ranking_versions_previous").on(table.previousVersionId),
  })
);

// Type exports for TypeScript
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type ArticleRankingsChange = typeof articleRankingsChanges.$inferSelect;
export type NewArticleRankingsChange = typeof articleRankingsChanges.$inferInsert;
export type ArticleProcessingLog = typeof articleProcessingLogs.$inferSelect;
export type NewArticleProcessingLog = typeof articleProcessingLogs.$inferInsert;
export type RankingVersion = typeof rankingVersions.$inferSelect;
export type NewRankingVersion = typeof rankingVersions.$inferInsert;

// Extended types for API responses
export interface ArticleWithImpact extends Article {
  impact?: {
    toolsAffected: number;
    companiesMentioned: number;
    avgRankChange: number;
    avgScoreChange: number;
    toolsImproved: number;
    toolsDeclined: number;
    newToolsAdded: number;
  };
}

export interface DryRunResult {
  article: Partial<Article>;
  predictedChanges: {
    toolId: string;
    toolName: string;
    currentRank?: number;
    predictedRank?: number;
    rankChange?: number;
    currentScore?: number;
    predictedScore?: number;
    scoreChange?: number;
    metrics: Record<string, { old: number; new: number; change: number }>;
  }[];
  newTools: {
    name: string;
    category?: string;
    companyId?: string;
  }[];
  newCompanies: {
    name: string;
    website?: string;
  }[];
  summary: {
    totalToolsAffected: number;
    totalNewTools: number;
    totalNewCompanies: number;
    averageRankChange: number;
    averageScoreChange: number;
  };
}
