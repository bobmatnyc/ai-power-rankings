#!/usr/bin/env tsx

/**
 * Script to push database schema to Neon PostgreSQL
 */

import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

// Load environment variables
dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const DATABASE_URL = process.env['DATABASE_URL_UNPOOLED'] || process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function pushSchema() {
  console.log('🚀 Pushing schema to Neon database...\n');

  try {
    // Create connection
    const connection = neon(DATABASE_URL);
    const db = drizzle(connection, { schema });

    // Create tables
    const statements = [
      // Companies table
      sql`CREATE TABLE IF NOT EXISTS "companies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "data" jsonb DEFAULT '{}' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "companies_slug_unique" UNIQUE("slug")
      )`,

      // Migrations table
      sql`CREATE TABLE IF NOT EXISTS "migrations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "status" text NOT NULL,
        "started_at" timestamp,
        "completed_at" timestamp,
        "error" text,
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "migrations_name_unique" UNIQUE("name")
      )`,

      // News table
      sql`CREATE TABLE IF NOT EXISTS "news" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" text NOT NULL,
        "article_id" text,
        "title" text NOT NULL,
        "summary" text,
        "category" text,
        "source" text,
        "source_url" text,
        "published_at" timestamp NOT NULL,
        "date" timestamp,
        "data" jsonb DEFAULT '{}' NOT NULL,
        "tool_mentions" jsonb DEFAULT '[]',
        "importance_score" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "news_slug_unique" UNIQUE("slug"),
        CONSTRAINT "news_article_id_unique" UNIQUE("article_id")
      )`,

      // Rankings table
      sql`CREATE TABLE IF NOT EXISTS "rankings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "period" text NOT NULL,
        "algorithm_version" text DEFAULT 'v1.0' NOT NULL,
        "is_current" boolean DEFAULT false NOT NULL,
        "published_at" timestamp,
        "data" jsonb DEFAULT '[]' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "rankings_period_unique" UNIQUE("period")
      )`,

      // Tools table
      sql`CREATE TABLE IF NOT EXISTS "tools" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "slug" text NOT NULL,
        "name" text NOT NULL,
        "category" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "company_id" text,
        "data" jsonb DEFAULT '{}' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "tools_slug_unique" UNIQUE("slug")
      )`
    ];

    // Create indexes
    const indexStatements = [
      // Companies indexes
      sql`CREATE INDEX IF NOT EXISTS "companies_slug_idx" ON "companies" ("slug")`,
      sql`CREATE INDEX IF NOT EXISTS "companies_name_idx" ON "companies" ("name")`,
      sql`CREATE INDEX IF NOT EXISTS "companies_data_gin_idx" ON "companies" USING gin ("data")`,

      // Migrations indexes
      sql`CREATE INDEX IF NOT EXISTS "migrations_name_idx" ON "migrations" ("name")`,
      sql`CREATE INDEX IF NOT EXISTS "migrations_status_idx" ON "migrations" ("status")`,

      // News indexes
      sql`CREATE INDEX IF NOT EXISTS "news_slug_idx" ON "news" ("slug")`,
      sql`CREATE INDEX IF NOT EXISTS "news_article_id_idx" ON "news" ("article_id")`,
      sql`CREATE INDEX IF NOT EXISTS "news_published_idx" ON "news" ("published_at")`,
      sql`CREATE INDEX IF NOT EXISTS "news_category_idx" ON "news" ("category")`,
      sql`CREATE INDEX IF NOT EXISTS "news_source_idx" ON "news" ("source")`,
      sql`CREATE INDEX IF NOT EXISTS "news_importance_idx" ON "news" ("importance_score")`,
      sql`CREATE INDEX IF NOT EXISTS "news_data_gin_idx" ON "news" USING gin ("data")`,
      sql`CREATE INDEX IF NOT EXISTS "news_tool_mentions_gin_idx" ON "news" USING gin ("tool_mentions")`,

      // Rankings indexes
      sql`CREATE INDEX IF NOT EXISTS "rankings_period_idx" ON "rankings" ("period")`,
      sql`CREATE INDEX IF NOT EXISTS "rankings_current_idx" ON "rankings" ("is_current")`,
      sql`CREATE INDEX IF NOT EXISTS "rankings_published_idx" ON "rankings" ("published_at")`,
      sql`CREATE INDEX IF NOT EXISTS "rankings_data_gin_idx" ON "rankings" USING gin ("data")`,

      // Tools indexes
      sql`CREATE INDEX IF NOT EXISTS "tools_slug_idx" ON "tools" ("slug")`,
      sql`CREATE INDEX IF NOT EXISTS "tools_category_idx" ON "tools" ("category")`,
      sql`CREATE INDEX IF NOT EXISTS "tools_status_idx" ON "tools" ("status")`,
      sql`CREATE INDEX IF NOT EXISTS "tools_name_idx" ON "tools" ("name")`,
      sql`CREATE INDEX IF NOT EXISTS "tools_data_gin_idx" ON "tools" USING gin ("data")`
    ];

    // Execute table creation
    console.log('📊 Creating tables...');
    for (const statement of statements) {
      await db.execute(statement);
    }
    console.log('✅ Tables created successfully\n');

    // Execute index creation
    console.log('🔍 Creating indexes...');
    for (const statement of indexStatements) {
      await db.execute(statement);
    }
    console.log('✅ Indexes created successfully\n');

    // Verify tables exist
    const tablesQuery = sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tables = await db.execute(tablesQuery);
    console.log('📋 Tables in database:');
    tables.rows.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n🎉 Schema push completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run data migration: DATABASE_MIGRATION_MODE=migrate npm run db:migrate:json');
    console.log('2. Configure Vercel: ./scripts/setup-vercel-env.sh');
    console.log('3. Deploy to production: vercel --prod');

  } catch (error) {
    console.error('❌ Error pushing schema:', error);
    process.exit(1);
  }
}

// Run the script
pushSchema();