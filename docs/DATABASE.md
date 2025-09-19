# 🗄️ AI Power Rankings - Database Architecture

## Overview

AI Power Rankings uses **PostgreSQL** as its primary database with **Drizzle ORM** for type-safe database operations. This document covers the complete database setup, schema design, and operational procedures.

## 🎯 Quick Reference

### Essential Commands

```bash
# Development
pnpm run db:push        # Push schema changes directly to database
pnpm run db:studio      # Open Drizzle Studio UI for database inspection

# Production
pnpm run db:generate    # Generate migration files from schema changes
pnpm run db:migrate     # Apply migrations to database
```

## 🏗️ Architecture

### Technology Stack

- **Database**: PostgreSQL 15+
- **ORM**: Drizzle ORM v0.44+
- **Connection**: Pooled connections via Vercel/Supabase
- **Type Safety**: Full TypeScript integration
- **Migrations**: Automated schema migrations

### Configuration Files

- `/drizzle.config.ts` - Drizzle configuration
- `/src/lib/db/schema.ts` - Database schema definitions
- `/src/lib/db/index.ts` - Database connection setup
- `/src/lib/db/migrations/` - Migration files directory

## 📊 Database Schema

### Core Tables

#### Tools Table
```typescript
export const tools = pgTable('tools', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  website: text('website'),
  github_url: text('github_url'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
```

#### Rankings Table
```typescript
export const rankings = pgTable('rankings', {
  id: serial('id').primaryKey(),
  tool_id: integer('tool_id').references(() => tools.id),
  period: date('period').notNull(),
  rank: integer('rank').notNull(),
  score: real('score').notNull(),
  tier: text('tier').notNull(),
  metrics: jsonb('metrics'),
  created_at: timestamp('created_at').defaultNow(),
});
```

#### News Articles Table
```typescript
export const articles = pgTable('articles', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  published_date: timestamp('published_date'),
  source: text('source'),
  content: text('content'),
  metrics: jsonb('metrics'),
  tags: text('tags').array(),
  created_at: timestamp('created_at').defaultNow(),
});
```

#### Companies Table
```typescript
export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  website: text('website'),
  logo_url: text('logo_url'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});
```

## 🔧 Database Operations

### Connection Setup

```typescript
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env["DATABASE_URL"]!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

### Common Queries

#### Fetching All Tools
```typescript
import { db } from '@/lib/db';
import { tools } from '@/lib/db/schema';

const allTools = await db.select().from(tools);
```

#### Get Tool by Slug
```typescript
import { eq } from 'drizzle-orm';

const tool = await db
  .select()
  .from(tools)
  .where(eq(tools.slug, 'cursor'))
  .limit(1);
```

#### Latest Rankings
```typescript
import { desc } from 'drizzle-orm';

const latestRankings = await db
  .select()
  .from(rankings)
  .orderBy(desc(rankings.period))
  .limit(50);
```

#### Insert New Article
```typescript
const newArticle = await db
  .insert(articles)
  .values({
    title: 'AI Coding Revolution',
    url: 'https://example.com/article',
    source: 'TechCrunch',
    published_date: new Date(),
  })
  .returning();
```

## 🚀 Migration Workflow

### Development Workflow

1. **Modify Schema**: Edit `/src/lib/db/schema.ts`
2. **Push Changes**: `pnpm run db:push` (direct schema sync)
3. **Verify**: `pnpm run db:studio` (inspect changes)

### Production Workflow

1. **Modify Schema**: Edit `/src/lib/db/schema.ts`
2. **Generate Migration**: `pnpm run db:generate`
3. **Review Migration**: Check files in `/src/lib/db/migrations/`
4. **Apply Migration**: `pnpm run db:migrate`
5. **Verify**: Check production database

### Migration Best Practices

- Always test migrations in development first
- Review generated SQL before applying to production
- Keep migrations small and focused
- Never modify existing migration files
- Use transactions for complex migrations

## 🔍 Drizzle Studio

Access the visual database browser:

```bash
pnpm run db:studio
```

Features:
- Browse all tables and data
- Execute queries
- Modify data directly
- Export data
- View relationships

Default URL: `http://localhost:4983`

## 🔐 Environment Variables

Required environment variables:

```env
# Development (.env.local)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DIRECT_DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Production (.env.production)
DATABASE_URL=postgresql://user:password@host:5432/dbname?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://user:password@host:5432/dbname
```

- `DATABASE_URL`: Pooled connection for application queries
- `DIRECT_DATABASE_URL`: Direct connection for migrations

## 📈 Performance Optimization

### Indexes

Key indexes for performance:

```sql
-- Tools lookup
CREATE INDEX idx_tools_slug ON tools(slug);

-- Rankings queries
CREATE INDEX idx_rankings_period ON rankings(period DESC);
CREATE INDEX idx_rankings_tool_period ON rankings(tool_id, period DESC);

-- Articles by date
CREATE INDEX idx_articles_published ON articles(published_date DESC);
```

### Query Optimization

- Use `select()` with specific columns instead of `*`
- Implement pagination for large datasets
- Use database-level filtering instead of application filtering
- Leverage indexes for common query patterns

## 🛡️ Backup and Recovery

### Backup Strategy

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20250129.sql
```

### Automated Backups

- Vercel/Supabase provides automated daily backups
- Point-in-time recovery available
- Regular backup testing recommended

## 🔥 Troubleshooting

### Common Issues

#### Connection Errors
- Verify `DATABASE_URL` is set correctly
- Check network/firewall settings
- Ensure database server is running

#### Migration Failures
- Check for conflicting schema changes
- Verify database permissions
- Review migration SQL for errors

#### Type Errors
- Run `pnpm run db:generate` after schema changes
- Ensure TypeScript types are regenerated
- Check for version mismatches

### Debug Commands

```bash
# Test database connection
npx drizzle-kit check

# View pending migrations
npx drizzle-kit migrations list

# Generate SQL without applying
npx drizzle-kit generate --dry-run
```

## 📚 Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vercel PostgreSQL Guide](https://vercel.com/docs/storage/vercel-postgres)
- [Database Schema Design Best Practices](https://orm.drizzle.team/docs/guides/database-design)

## 🎯 Migration from JSON

The project has migrated from JSON file storage to PostgreSQL. Legacy JSON files are archived in `/data/json/` for reference. All new development should use the database exclusively.

### Data Migration Script

```bash
# One-time migration from JSON to database
pnpm run migrate:json-to-db
```

This completes the database architecture documentation for AI Power Rankings.