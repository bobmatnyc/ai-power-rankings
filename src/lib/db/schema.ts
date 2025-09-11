/**
 * Drizzle ORM Schema Definitions
 * Strategic JSONB usage for flexible data storage while maintaining queryability
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Tools table - AI coding tools and assistants
 * Using JSONB for flexible metadata while keeping key fields indexed
 */
export const tools = pgTable('tools', {
  // Primary identifiers
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  
  // Core attributes as columns for efficient querying
  category: text('category').notNull(), // e.g., 'code-editor', 'autonomous-agent'
  status: text('status').notNull().default('active'), // 'active', 'inactive', 'deprecated'
  companyId: text('company_id'),
  
  // Flexible JSONB storage for all other tool data
  // Preserves the existing JSON structure from /data/json/tools/
  data: jsonb('data').notNull().default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes for common queries
  slugIdx: uniqueIndex('tools_slug_idx').on(table.slug),
  categoryIdx: index('tools_category_idx').on(table.category),
  statusIdx: index('tools_status_idx').on(table.status),
  nameIdx: index('tools_name_idx').on(table.name),
  // GIN index for JSONB queries
  dataIdx: index('tools_data_gin_idx').using('gin', table.data),
}));

/**
 * Rankings table - Monthly AI tool rankings
 * Stores entire ranking period data in JSONB
 */
export const rankings = pgTable('rankings', {
  // Primary identifiers
  id: uuid('id').defaultRandom().primaryKey(),
  period: text('period').notNull(), // e.g., '2025-09'
  
  // Metadata
  algorithmVersion: text('algorithm_version').notNull().default('v1.0'),
  isCurrent: boolean('is_current').notNull().default(false),
  publishedAt: timestamp('published_at'),
  
  // Complete rankings data as JSONB
  // Preserves the structure from /public/data/rankings.json
  data: jsonb('data').notNull().default('[]'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes
  periodIdx: uniqueIndex('rankings_period_idx').on(table.period),
  currentIdx: index('rankings_current_idx').on(table.isCurrent),
  publishedIdx: index('rankings_published_idx').on(table.publishedAt),
  // GIN index for JSONB queries
  dataIdx: index('rankings_data_gin_idx').using('gin', table.data),
}));

/**
 * News table - AI industry news and articles
 * Flexible JSONB storage with key fields extracted
 */
export const news = pgTable('news', {
  // Primary identifiers
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  articleId: text('article_id').unique(), // Legacy ID from JSON
  
  // Core searchable fields
  title: text('title').notNull(),
  summary: text('summary'),
  category: text('category'),
  source: text('source'),
  sourceUrl: text('source_url'),
  
  // Dates
  publishedAt: timestamp('published_at').notNull(),
  date: timestamp('date'),
  
  // Complete article data as JSONB
  // Preserves all fields from /data/json/news/
  data: jsonb('data').notNull().default('{}'),
  
  // Tool associations (stored as array in JSONB)
  toolMentions: jsonb('tool_mentions').default('[]'),
  
  // Metadata
  importanceScore: integer('importance_score').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Indexes
  slugIdx: uniqueIndex('news_slug_idx').on(table.slug),
  articleIdIdx: uniqueIndex('news_article_id_idx').on(table.articleId),
  publishedIdx: index('news_published_idx').on(table.publishedAt),
  categoryIdx: index('news_category_idx').on(table.category),
  sourceIdx: index('news_source_idx').on(table.source),
  importanceIdx: index('news_importance_idx').on(table.importanceScore),
  // GIN indexes for JSONB
  dataIdx: index('news_data_gin_idx').using('gin', table.data),
  toolMentionsIdx: index('news_tool_mentions_gin_idx').using('gin', table.toolMentions),
  // Full text search index on title and summary
  titleSearchIdx: index('news_title_search_idx').using('gin', sql`to_tsvector('english', ${table.title})`),
}));

/**
 * Companies table - Optional, for future normalization
 * Currently company data is embedded in tools
 */
export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  
  // All company data as JSONB
  data: jsonb('data').notNull().default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('companies_slug_idx').on(table.slug),
  nameIdx: index('companies_name_idx').on(table.name),
  dataIdx: index('companies_data_gin_idx').using('gin', table.data),
}));

/**
 * Migration tracking table
 * Tracks JSON to PostgreSQL migration status
 */
export const migrations = pgTable('migrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  status: text('status').notNull(), // 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  error: text('error'),
  metadata: jsonb('metadata').default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  nameIdx: uniqueIndex('migrations_name_idx').on(table.name),
  statusIdx: index('migrations_status_idx').on(table.status),
}));

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