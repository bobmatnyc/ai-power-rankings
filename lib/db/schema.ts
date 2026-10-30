/**
 * Drizzle ORM Schema Definitions
 * Strategic JSONB usage for flexible data storage while maintaining queryability
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/** #183: the four entity kinds a tool row can have (CHECK `tools_kind_check`). */
export const TOOL_KINDS = ["model", "harness", "productivity", "other"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

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
    companyId: text("company_id"), // #183: also the model vendor; no vendor_company_id column

    // #183: entity kind and model fields (migration 0016). Nothing reads them until #186.
    kind: text("kind", { enum: TOOL_KINDS }).notNull().default("harness"),
    subcategory: text("subcategory"), // stored with underscores, e.g. 'app_builder' (Q-A4)
    openWeight: boolean("open_weight"), // NULL = unknown or not a model
    licence: text("licence"),
    parametersB: numeric("parameters_b"),
    activeParametersB: numeric("active_parameters_b"),
    contextWindow: integer("context_window"),
    priceInPerMtok: numeric("price_in_per_mtok"),
    priceOutPerMtok: numeric("price_out_per_mtok"),
    releaseDate: date("release_date", { mode: "string" }),
    hfRepo: text("hf_repo"),

    // Scoring fields for baseline + delta tracking
    baselineScore: jsonb("baseline_score").default("{}"), // Stores baseline scores per factor
    deltaScore: jsonb("delta_score").default("{}"), // Stores delta modifications per factor
    currentScore: jsonb("current_score").default("{}"), // Cached current score calculation
    scoreUpdatedAt: timestamp("score_updated_at", { withTimezone: true }), // Last time score was recalculated

    // Flexible JSONB storage for all other tool data
    // Preserves the existing JSON structure from /data/json/tools/
    data: jsonb("data").notNull().default("{}"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    // #183: kind filters for the per-kind ranking lists
    kindIdx: index("tools_kind_idx").on(table.kind),
    kindSubcategoryIdx: index("tools_kind_subcategory_idx").on(table.kind, table.subcategory),
    openWeightIdx: index("tools_open_weight_idx").on(table.openWeight).where(sql`kind = 'model'`),
    kindCheck: check("tools_kind_check", sql`kind IN ('model', 'harness', 'productivity', 'other')`),
    subcategoryCheck: check("tools_subcategory_check", sql`subcategory ~ '^[a-z0-9_]+$'`),
    openWeightCheck: check("tools_open_weight_check", sql`open_weight IS NULL OR kind = 'model'`),
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
    // #186: the list this board ranks (migration 0020). 'combined' is the legacy one-board
    // row (D55); the others hold one row per (period, list), ranked within the list.
    list: text("list", { enum: ["combined", "harness", "model", "productivity"] }).notNull().default("combined"),

    // Metadata
    algorithmVersion: text("algorithm_version").notNull().default("v1.0"),
    isCurrent: boolean("is_current").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    // Complete rankings data as JSONB
    // Preserves the structure from /public/data/rankings.json
    data: jsonb("data").notNull().default("[]"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    // #186: one row per (period, list); replaces the period-only rankings_period_idx.
    periodListIdx: uniqueIndex("rankings_period_list_idx").on(table.period, table.list),
    currentIdx: index("rankings_current_idx").on(table.isCurrent),
    // #186: at most one current board per list.
    oneCurrentPerListIdx: uniqueIndex("rankings_one_current_per_list_idx").on(table.list).where(sql`is_current`),
    listCheck: check("rankings_list_check", sql`list IN ('combined', 'harness', 'model', 'productivity')`),
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
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    date: timestamp("date", { withTimezone: true }),

    // Complete article data as JSONB
    // Preserves all fields from /data/json/news/
    data: jsonb("data").notNull().default("{}"),

    // Tool associations (stored as array in JSONB)
    toolMentions: jsonb("tool_mentions").default("[]"),

    // Metadata
    importanceScore: integer("importance_score").default(0),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    periodIdx: uniqueIndex("monthly_summaries_period_idx").on(table.period),
    generatedAtIdx: index("monthly_summaries_generated_at_idx").on(table.generatedAt),
    metadataIdx: index("monthly_summaries_metadata_idx").using("gin", table.metadata),
  })
);

/**
 * Monthly Report Versions table
 * #182: the one monthly report, append-only. Each generation inserts the next
 * `version` for its `YYYY-MM` period and never updates a row, so every prior
 * version stays readable. `monthly_summaries` and `state_of_ai_summaries` are
 * the read-only predecessors.
 */
export const monthlyReportVersions = pgTable(
  "monthly_report_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    period: text("period").notNull(), // Format: YYYY-MM
    version: integer("version").notNull(), // 1, 2, ... per period
    content: text("content").notNull(), // markdown, 300-450 words
    dataHash: text("data_hash").notNull(), // SHA-256 of the month's aggregated inputs
    metadata: jsonb("metadata").default("{}"), // model, counts, word_count, token usage
    generatedBy: text("generated_by").notNull(), // cron name, admin user id or cli
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    periodVersionIdx: uniqueIndex("monthly_report_versions_period_version_idx").on(
      table.period,
      table.version
    ),
    generatedAtIdx: index("monthly_report_versions_generated_at_idx").on(table.generatedAt),
  })
);

/**
 * Weekly Digests table
 * #181: one LLM-generated digest per closed ISO week, keyed `YYYY-Www`.
 * Kept apart from `monthly_summaries`: a `W` key would sort after every `YYYY-MM`
 * period and be read as the latest monthly report.
 */
export const weeklyDigests = pgTable(
  "weekly_digests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    week: text("week").notNull(), // Format: YYYY-Www (ISO-8601 week)
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(), // Monday 00:00 UTC
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(), // Sunday 23:59:59.999 UTC
    content: text("content").notNull(), // markdown: code-built title, model body, code-built sources
    dataHash: text("data_hash").notNull(), // SHA-256 of the week's input ids
    metadata: jsonb("metadata").default("{}"), // tier, article_count, model, token counts, ids
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    weekIdx: uniqueIndex("weekly_digests_week_idx").on(table.week),
    generatedAtIdx: index("weekly_digests_generated_at_idx").on(table.generatedAt),
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
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    generatedBy: text("generated_by").notNull(), // User ID/email who triggered generation
    metadata: jsonb("metadata").default("{}"), // article_count, date_range, model_used, etc.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    // #132: the stale-skip count was computed every run and silently dropped —
    // updateRun() never mapped it and no column existed to hold it.
    articlesSkippedStale: integer("articles_skipped_stale").default(0),
    rankingChanges: integer("ranking_changes").default(0),

    // Timing and details
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    searchQuery: text("search_query"),
    errorLog: jsonb("error_log").default("[]"),
    ingestedArticleIds: jsonb("ingested_article_ids").default("[]"),
    // #132: per-candidate outcomes (see CandidateOutcome in
    // lib/services/automated-ingestion.service.ts). Without this, a run that
    // discovered a fresh candidate and failed to insert it is indistinguishable
    // from a run where no fresh candidate existed. Capped at
    // CANDIDATE_OUTCOME_LIMIT entries.
    candidateOutcomes: jsonb("candidate_outcomes").default("[]"),
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 4 }).default("0"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Indexes
    statusIdx: index("idx_automated_ingestion_runs_status").on(table.status),
    runTypeIdx: index("idx_automated_ingestion_runs_run_type").on(table.runType),
    createdAtIdx: index("idx_automated_ingestion_runs_created_at").on(table.createdAt),
  })
);

/**
 * Paid provider call ledger (#325): one row per paid provider call.
 *
 * Why: run rows hold only a partial cost estimate, and three of the LLM paths
 *   (what's-new, State of AI, admin analyze) have no run row at all, so spend can
 *   only be attributed per call.
 * What: `reported_cost_usd` is the provider's own figure; `estimated_cost_usd` is
 *   tokens x an env unit price; `cost_is_estimated` is false only when a reported
 *   cost exists. `run_id` links a call made inside an ingestion run and is set to
 *   NULL if the run is deleted. `units` holds non-token quantities (credits,
 *   requests) for non-LLM providers. Written by `lib/services/provider-usage.ts`.
 * Test: `tests/unit/provider-usage-migration-325.test.ts` (matches migration 0029).
 */
export const providerUsageEvents = pgTable(
  "provider_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    model: text("model"),
    runId: uuid("run_id").references(() => automatedIngestionRuns.id, { onDelete: "set null" }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    units: numeric("units", { precision: 14, scale: 4 }),
    reportedCostUsd: numeric("reported_cost_usd", { precision: 12, scale: 6 }),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }),
    costIsEstimated: boolean("cost_is_estimated").notNull().default(true),
  },
  (table) => ({
    createdAtIdx: index("provider_usage_events_created_at_idx").on(table.createdAt),
    providerCreatedAtIdx: index("provider_usage_events_provider_created_at_idx").on(
      table.provider,
      table.createdAt
    ),
    runIdIdx: index("provider_usage_events_run_id_idx").on(table.runId),
  })
);

/**
 * Tool metrics history (#95) — private, kept forever.
 *
 * Why: collector metrics were only ever written over `tools.data.metrics`, so no
 *   month's values survived the next run. One row per tool per collection day
 *   keeps them. Nothing under app/ reads this table except the collect-metrics
 *   cron route, which writes it (`tests/unit/metrics-history-private-95.test.ts`).
 * What: `metrics` holds one top-level key per collector (`npm`, `pypi`,
 *   `github`, `vscode`); each leaf is `{ value, source, as_of, flags? }`. The
 *   route upserts on (tool_id, collected_date) with `metrics || EXCLUDED.metrics`.
 *   `tool_id` is set to NULL if the tool is deleted, so history outlives it.
 * Test: `tests/unit/metrics-history-migration-95.test.ts` (matches migration 0014).
 */
export const toolMetricsHistory = pgTable(
  "tool_metrics_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id").references(() => tools.id, { onDelete: "set null" }),
    toolSlug: text("tool_slug").notNull(),
    collectedDate: date("collected_date", { mode: "string" }).notNull(), // UTC invocation day, YYYY-MM-DD
    period: text("period").notNull(), // YYYY-MM
    metrics: jsonb("metrics").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    toolDateIdx: uniqueIndex("tool_metrics_history_tool_date_idx").on(table.toolId, table.collectedDate),
    periodIdx: index("tool_metrics_history_period_idx").on(table.period),
    metricsIdx: index("tool_metrics_history_metrics_gin_idx").using("gin", table.metrics),
  })
);

/**
 * Metrics collection ledger (#95): one row per collector shard per collection day.
 *
 * Why: each shard runs in its own cron invocation, so a missing or failed shard
 *   must be visible on its own (`.github/workflows/check-metrics-history.yml`).
 * What: status is `ok`, `partial` or `failed`; the counts satisfy
 *   recorded + not_found + failed + skipped_timeout = attempted (flagged is a
 *   subset of recorded). Upserted on (collected_date, collector, shard).
 * Test: `tests/unit/metrics-history-migration-95.test.ts`
 */
export const metricsCollectionRuns = pgTable(
  "metrics_collection_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectedDate: date("collected_date", { mode: "string" }).notNull(),
    period: text("period").notNull(),
    collector: text("collector").notNull(),
    shard: integer("shard").notNull(),
    shardCount: integer("shard_count").notNull(),
    status: text("status").notNull(),
    attempted: integer("attempted").notNull().default(0),
    recorded: integer("recorded").notNull().default(0),
    flagged: integer("flagged").notNull().default(0),
    notFound: integer("not_found").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    skippedTimeout: integer("skipped_timeout").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dateCollectorShardIdx: uniqueIndex("metrics_collection_runs_date_collector_shard_idx").on(
      table.collectedDate,
      table.collector,
      table.shard
    ),
  })
);

/**
 * Model-harness links (#183, D29): one row says "this model runs in this harness".
 *
 * Why: the models and harness pages cross-link (B-2), and both directions are
 *   many-to-many, so the relation needs its own table rather than a JSON list.
 * What: `model_tool_id` must reference a `kind='model'` tool and `harness_tool_id` a
 *   `kind='harness'` tool. Postgres cannot CHECK that across tables and there is no trigger
 *   (Q-A5): the writer (B-2) checks it, and `TOOL_LINK_KIND_VIOLATIONS_SQL` in
 *   `lib/db/tool-links.ts` finds any row that breaks it. Deleting either tool deletes
 *   the link. Unique per (model, harness) pair; no self-link.
 * Test: `tests/unit/tool-kind-links-migration-183.test.ts` (parity with migration 0016),
 *   `tests/unit/tool-kind-links-pglite-183.test.ts` (constraints on real Postgres).
 */
export const toolLinks = pgTable(
  "tool_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    modelToolId: uuid("model_tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    harnessToolId: uuid("harness_tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    relation: text("relation", { enum: ["native", "supports"] }).notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    modelHarnessIdx: uniqueIndex("tool_links_model_harness_idx").on(table.modelToolId, table.harnessToolId),
    harnessIdx: index("tool_links_harness_idx").on(table.harnessToolId),
    relationCheck: check("tool_links_relation_check", sql`relation IN ('native', 'supports')`),
    noSelfLinkCheck: check("tool_links_no_self_link_check", sql`model_tool_id <> harness_tool_id`),
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
export type MonthlyReportVersion = typeof monthlyReportVersions.$inferSelect;
export type NewMonthlyReportVersion = typeof monthlyReportVersions.$inferInsert;
export type WeeklyDigest = typeof weeklyDigests.$inferSelect;
export type NewWeeklyDigest = typeof weeklyDigests.$inferInsert;
export type StateOfAiSummary = typeof stateOfAiSummaries.$inferSelect;
export type NewStateOfAiSummary = typeof stateOfAiSummaries.$inferInsert;
export type AutomatedIngestionRun = typeof automatedIngestionRuns.$inferSelect;
export type NewAutomatedIngestionRun = typeof automatedIngestionRuns.$inferInsert;
export type ProviderUsageEvent = typeof providerUsageEvents.$inferSelect; // #325
export type NewProviderUsageEvent = typeof providerUsageEvents.$inferInsert; // #325
export type ToolLink = typeof toolLinks.$inferSelect;
export type NewToolLink = typeof toolLinks.$inferInsert;

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
