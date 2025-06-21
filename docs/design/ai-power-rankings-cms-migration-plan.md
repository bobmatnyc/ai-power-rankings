# AI Power Rankings Migration Plan: Vercel + Supabase Architecture

## Overview
Migrate AI Power Rankings to Payload CMS while **keeping your existing Supabase database**. Deploy Payload CMS to Vercel and connect it to your current Supabase PostgreSQL instance.

**Architecture:**
```
Vercel (Payload CMS App) ←→ Supabase (Existing PostgreSQL Database)
```

## Pre-Migration Setup

### 1. Get Supabase Database Connection Details
```bash
# In your Supabase dashboard, go to Settings > Database
# Copy the connection string:
# postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# You'll need:
SUPABASE_DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"
SUPABASE_URL="https://[project].supabase.co"
SUPABASE_ANON_KEY="your_anon_key"
```

### 2. Create Payload Project
```bash
# Create new Payload project
npx create-payload-app ai-power-rankings-cms
cd ai-power-rankings-cms

# Install additional dependencies
npm install @payloadcms/richtext-slate @payloadcms/db-postgres dotenv

# Set up environment variables
cat > .env.local << EOF
PAYLOAD_SECRET=your-payload-secret-key
SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_PAYLOAD_URL=http://localhost:3000
EOF
```

### 3. Payload Configuration for Supabase
```typescript
// payload.config.ts
import { buildConfig } from 'payload/config'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { slateEditor } from '@payloadcms/richtext-slate'
import path from 'path'

export default buildConfig({
  admin: {
    user: 'users',
    dateFormat: 'YYYY-MM-DD',
    meta: {
      titleSuffix: ' - AI Power Rankings Admin',
    },
  },
  editor: slateEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.SUPABASE_DATABASE_URL,
    },
    // Use different schema to avoid conflicts with existing tables
    schemaName: 'payload',
  }),
  serverURL: process.env.NEXT_PUBLIC_PAYLOAD_URL,
  collections: [
    // Collections defined below
  ],
  globals: [
    // Global settings defined below
  ],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
})
```

## Payload Schema (New Tables in Existing Database)

### 1. Core Collections

```typescript
// collections/Companies.ts
import { CollectionConfig } from 'payload/types'

export const Companies: CollectionConfig = {
  slug: 'companies',
  admin: {
    defaultColumns: ['name', 'headquarters', 'founded_year', 'company_type'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'supabase_company_id',
      type: 'text',
      admin: {
        description: 'Reference to original Supabase companies.id for migration',
        readOnly: true,
      },
      index: true,
    },
    {
      name: 'website_url',
      type: 'text',
    },
    {
      name: 'headquarters',
      type: 'text',
    },
    {
      name: 'founded_year',
      type: 'number',
      min: 1900,
      max: new Date().getFullYear(),
    },
    {
      name: 'company_size',
      type: 'select',
      options: ['startup', 'small', 'medium', 'large', 'enterprise'],
    },
    {
      name: 'company_type',
      type: 'select',
      options: ['startup', 'public', 'private', 'acquisition'],
    },
    {
      name: 'parent_company',
      type: 'relationship',
      relationTo: 'companies',
    },
    {
      name: 'logo_url',
      type: 'text',
    },
    {
      name: 'description',
      type: 'richText',
    },
  ],
}

// collections/Tools.ts
export const Tools: CollectionConfig = {
  slug: 'tools',
  admin: {
    defaultColumns: ['name', 'category', 'status', 'current_ranking'],
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'supabase_tool_id',
      type: 'text',
      admin: {
        description: 'Reference to original Supabase tools.id for migration',
        readOnly: true,
      },
      index: true,
    },
    {
      name: 'display_name',
      type: 'text',
    },
    {
      name: 'company',
      type: 'relationship',
      relationTo: 'companies',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      options: [
        'code-editor',
        'autonomous-agent', 
        'app-builder',
        'ide-assistant',
        'testing-tool',
        'open-source-framework',
        'specialized-platform',
        'documentation-tool',
        'code-review',
        'enterprise-platform'
      ],
      required: true,
      index: true,
    },
    {
      name: 'subcategory',
      type: 'text',
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'tagline',
      type: 'text',
      maxLength: 500,
    },
    {
      name: 'website_url',
      type: 'text',
    },
    {
      name: 'github_repo',
      type: 'text',
      validate: (val) => !val || /^[\w\-\.]+\/[\w\-\.]+$/.test(val) || 'Format: owner/repo',
    },
    {
      name: 'documentation_url',
      type: 'text',
    },
    {
      name: 'founded_date',
      type: 'date',
    },
    {
      name: 'first_tracked_date',
      type: 'date',
    },
    {
      name: 'pricing_model',
      type: 'select',
      options: ['free', 'freemium', 'paid', 'enterprise', 'usage-based', 'open-source'],
      required: true,
    },
    {
      name: 'license_type',
      type: 'select',
      options: ['open-source', 'proprietary', 'commercial', 'mit', 'apache', 'gpl'],
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: ['active', 'discontinued', 'beta', 'stealth', 'acquired'],
      defaultValue: 'active',
      index: true,
    },
    {
      name: 'logo_url',
      type: 'text',
    },
    {
      name: 'screenshot_url',
      type: 'text',
    },
    {
      name: 'is_featured',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'current_ranking',
      type: 'number',
      min: 1,
      index: true,
    },
    // Rich editorial content
    {
      name: 'the_real_story',
      type: 'richText',
      admin: {
        description: 'Editorial analysis explaining this tool\'s current position and trajectory',
      },
    },
    {
      name: 'competitive_analysis',
      type: 'richText',
    },
    {
      name: 'key_developments',
      type: 'json',
    },
    {
      name: 'notable_events',
      type: 'json',
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.name && !data.slug) {
          data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        }
        return data
      },
    ],
  },
}

// collections/Metrics.ts  
export const Metrics: CollectionConfig = {
  slug: 'metrics',
  admin: {
    defaultColumns: ['tool', 'metric_key', 'value_display', 'recorded_at', 'source'],
  },
  fields: [
    {
      name: 'tool',
      type: 'relationship',
      relationTo: 'tools',
      required: true,
    },
    {
      name: 'metric_key',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'supabase_metric_id',
      type: 'text',
      admin: {
        description: 'Reference to original Supabase metrics_history.id',
        readOnly: true,
      },
    },
    // Flexible value storage
    {
      name: 'value_integer',
      type: 'number',
    },
    {
      name: 'value_decimal',
      type: 'number',
    },
    {
      name: 'value_text',
      type: 'text',
    },
    {
      name: 'value_boolean',
      type: 'checkbox',
    },
    {
      name: 'value_json',
      type: 'json',
    },
    {
      name: 'recorded_at',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'collected_at',
      type: 'date',
      defaultValue: () => new Date(),
    },
    {
      name: 'source',
      type: 'text',
      defaultValue: 'manual_entry',
    },
    {
      name: 'source_url',
      type: 'text',
    },
    {
      name: 'confidence_score',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 1.0,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'is_estimate',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'value_display',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Generate display value
        if (data.value_text) data.value_display = data.value_text
        else if (data.value_number) data.value_display = data.value_number.toString()
        else if (data.value_boolean !== undefined) data.value_display = data.value_boolean ? 'Yes' : 'No'
        else if (data.value_json) data.value_display = JSON.stringify(data.value_json).substring(0, 50) + '...'
        return data
      },
    ],
  },
}

// collections/Rankings.ts
export const Rankings: CollectionConfig = {
  slug: 'rankings',
  admin: {
    defaultColumns: ['period', 'tool', 'position', 'score', 'movement'],
  },
  fields: [
    {
      name: 'period',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'tool',
      type: 'relationship',
      relationTo: 'tools',
      required: true,
    },
    {
      name: 'position',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'score',
      type: 'number',
      required: true,
    },
    // Score breakdown
    {
      name: 'market_traction_score',
      type: 'number',
    },
    {
      name: 'technical_capability_score',
      type: 'number',
    },
    {
      name: 'developer_adoption_score',
      type: 'number',
    },
    {
      name: 'development_velocity_score',
      type: 'number',
    },
    {
      name: 'platform_resilience_score',
      type: 'number',
    },
    {
      name: 'community_sentiment_score',
      type: 'number',
    },
    // Movement tracking
    {
      name: 'previous_position',
      type: 'number',
    },
    {
      name: 'movement',
      type: 'select',
      options: ['up', 'down', 'same', 'new', 'returning', 'dropped'],
    },
    {
      name: 'movement_positions',
      type: 'number',
    },
    {
      name: 'algorithm_version',
      type: 'text',
    },
    {
      name: 'data_completeness',
      type: 'number',
      min: 0,
      max: 1,
    },
  ],
}

// collections/News.ts
export const News: CollectionConfig = {
  slug: 'news',
  admin: {
    defaultColumns: ['title', 'source', 'published_at', 'importance_score', 'category'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'url',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'source',
      type: 'text',
      required: true,
    },
    {
      name: 'author',
      type: 'text',
    },
    {
      name: 'published_at',
      type: 'date',
      required: true,
      index: true,
    },
    {
      name: 'category',
      type: 'select',
      options: ['funding', 'product', 'industry', 'acquisition', 'benchmark', 'partnership'],
    },
    {
      name: 'importance_score',
      type: 'number',
      min: 1,
      max: 10,
      defaultValue: 5,
    },
    {
      name: 'related_tools',
      type: 'relationship',
      relationTo: 'tools',
      hasMany: true,
    },
    {
      name: 'primary_tool',
      type: 'relationship',
      relationTo: 'tools',
    },
    {
      name: 'sentiment',
      type: 'number',
      min: -1,
      max: 1,
    },
    {
      name: 'key_topics',
      type: 'json',
    },
    {
      name: 'is_featured',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
```

### 2. Global Configuration

```typescript
// globals/SiteSettings.ts
import { GlobalConfig } from 'payload/types'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'site_name',
      type: 'text',
      defaultValue: 'AI Power Rankings',
    },
    {
      name: 'site_description',
      type: 'textarea',
      defaultValue: 'The definitive monthly rankings of agentic AI coding tools',
    },
    {
      name: 'current_ranking_period',
      type: 'text',
    },
    {
      name: 'algorithm_version',
      type: 'text',
      defaultValue: 'v5.1',
    },
    {
      name: 'algorithm_weights',
      type: 'json',
      defaultValue: {
        agentic_capability: 0.30,
        innovation: 0.15,
        technical_capability: 0.125,
        developer_adoption: 0.125,
        market_traction: 0.125,
        business_sentiment: 0.075,
        development_velocity: 0.05,
        platform_resilience: 0.05
      },
    },
    {
      name: 'meta_description',
      type: 'textarea',
    },
    {
      name: 'og_image',
      type: 'text',
    },
  ],
}
```

## Data Migration Strategy (Same Database)

### 1. Migration Script (Supabase → Payload in Same DB)

```typescript
// scripts/migrate-to-payload.ts
import payload from 'payload'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

interface MigrationContext {
  companyMap: Map<string, string> // supabase_id → payload_id
  toolMap: Map<string, string>
  errors: string[]
}

async function initPayload() {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET!,
    local: true,
  })
  console.log('✅ Payload initialized with existing Supabase database')
}

async function migrateCompanies(ctx: MigrationContext) {
  console.log('🏢 Migrating companies from public.companies to payload.companies...')
  
  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .order('created_at')

  if (error) throw error

  for (const company of companies) {
    try {
      const payloadCompany = await payload.create({
        collection: 'companies',
        data: {
          name: company.name,
          slug: company.slug,
          supabase_company_id: company.id, // Keep reference to original
          website_url: company.website_url,
          headquarters: company.headquarters,
          founded_year: company.founded_year,
          company_size: company.company_size,
          company_type: company.company_type,
          logo_url: company.logo_url,
          description: company.description ? {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: company.description }]
              }
            ]
          } : undefined,
        }
      })

      ctx.companyMap.set(company.id, payloadCompany.id)
      console.log(`✅ Migrated company: ${company.name}`)
    } catch (error) {
      const errorMsg = `❌ Failed to migrate company ${company.name}: ${error}`
      console.error(errorMsg)
      ctx.errors.push(errorMsg)
    }
  }

  // Handle parent company relationships
  for (const company of companies) {
    if (company.parent_company_id && ctx.companyMap.has(company.parent_company_id)) {
      try {
        await payload.update({
          collection: 'companies',
          id: ctx.companyMap.get(company.id)!,
          data: {
            parent_company: ctx.companyMap.get(company.parent_company_id)
          }
        })
      } catch (error) {
        console.error(`❌ Failed to set parent company for ${company.name}: ${error}`)
      }
    }
  }

  console.log(`✅ Migrated ${companies.length} companies`)
}

async function migrateTools(ctx: MigrationContext) {
  console.log('🔧 Migrating tools from public.tools to payload.tools...')
  
  const { data: tools, error } = await supabase
    .from('tools')
    .select('*')
    .order('created_at')

  if (error) throw error

  for (const tool of tools) {
    try {
      const companyId = tool.company_id ? ctx.companyMap.get(tool.company_id) : null
      
      const payloadTool = await payload.create({
        collection: 'tools',
        data: {
          name: tool.name,
          slug: tool.slug,
          supabase_tool_id: tool.id, // Keep reference to original
          display_name: tool.display_name,
          company: companyId,
          category: tool.category,
          subcategory: tool.subcategory,
          description: tool.description ? {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: tool.description }]
              }
            ]
          } : undefined,
          tagline: tool.tagline,
          website_url: tool.website_url,
          github_repo: tool.github_repo,
          documentation_url: tool.documentation_url,
          founded_date: tool.founded_date,
          first_tracked_date: tool.first_tracked_date,
          pricing_model: tool.pricing_model,
          license_type: tool.license_type,
          status: tool.status,
          logo_url: tool.logo_url,
          screenshot_url: tool.screenshot_url,
          is_featured: tool.is_featured,
        }
      })

      ctx.toolMap.set(tool.id, payloadTool.id)
      console.log(`✅ Migrated tool: ${tool.name}`)
    } catch (error) {
      const errorMsg = `❌ Failed to migrate tool ${tool.name}: ${error}`
      console.error(errorMsg)
      ctx.errors.push(errorMsg)
    }
  }

  console.log(`✅ Migrated ${tools.length} tools`)
}

async function migrateMetrics(ctx: MigrationContext) {
  console.log('📊 Migrating recent metrics...')
  
  // Start with recent metrics to validate approach
  const { data: metrics, error } = await supabase
    .from('metrics_history')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(5000) // Start with recent 5k metrics

  if (error) throw error

  const batchSize = 100
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize)
    
    for (const metric of batch) {
      try {
        const toolId = ctx.toolMap.get(metric.tool_id)
        if (!toolId) continue

        await payload.create({
          collection: 'metrics',
          data: {
            tool: toolId,
            metric_key: metric.metric_key,
            supabase_metric_id: metric.id,
            value_integer: metric.value_integer,
            value_decimal: metric.value_decimal,
            value_text: metric.value_text,
            value_boolean: metric.value_boolean,
            value_json: metric.value_json,
            recorded_at: metric.recorded_at,
            collected_at: metric.collected_at,
            source: metric.source,
            source_url: metric.source_url,
            confidence_score: metric.confidence_score,
            notes: metric.notes,
            is_estimate: metric.is_estimate,
          }
        })
      } catch (error) {
        console.error(`❌ Failed to migrate metric: ${error}`)
      }
    }
    
    console.log(`✅ Migrated metrics batch ${i / batchSize + 1}/${Math.ceil(metrics.length / batchSize)}`)
  }

  console.log(`✅ Migrated ${metrics.length} recent metrics`)
}

async function migrateRankings(ctx: MigrationContext) {
  console.log('🏆 Migrating rankings...')
  
  const { data: rankings, error } = await supabase
    .from('ranking_cache')
    .select('*')
    .order('period', { ascending: false })

  if (error) throw error

  for (const ranking of rankings) {
    try {
      const toolId = ctx.toolMap.get(ranking.tool_id)
      if (!toolId) continue

      await payload.create({
        collection: 'rankings',
        data: {
          period: ranking.period,
          tool: toolId,
          position: ranking.position,
          score: ranking.score,
          market_traction_score: ranking.market_traction_score,
          technical_capability_score: ranking.technical_capability_score,
          developer_adoption_score: ranking.developer_adoption_score,
          development_velocity_score: ranking.development_velocity_score,
          platform_resilience_score: ranking.platform_resilience_score,
          community_sentiment_score: ranking.community_sentiment_score,
          previous_position: ranking.previous_position,
          movement: ranking.movement,
          movement_positions: ranking.movement_positions,
          algorithm_version: ranking.algorithm_version,
          data_completeness: ranking.data_completeness,
        }
      })
    } catch (error) {
      console.error(`❌ Failed to migrate ranking: ${error}`)
    }
  }

  console.log(`✅ Migrated ${rankings.length} rankings`)
}

async function migrateEditorialContent(ctx: MigrationContext) {
  console.log('✍️ Migrating editorial content...')
  
  const { data: editorial, error } = await supabase
    .from('ranking_editorial')
    .select('*')

  if (error) throw error

  for (const content of editorial) {
    try {
      const toolId = ctx.toolMap.get(content.tool_id)
      if (!toolId) continue

      await payload.update({
        collection: 'tools',
        id: toolId,
        data: {
          the_real_story: content.the_real_story ? {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: content.the_real_story }]
              }
            ]
          } : undefined,
          competitive_analysis: content.competitive_analysis ? {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: content.competitive_analysis }]
              }
            ]
          } : undefined,
          key_developments: content.key_developments,
          notable_events: content.notable_events,
        }
      })
    } catch (error) {
      console.error(`❌ Failed to migrate editorial content: ${error}`)
    }
  }

  console.log(`✅ Migrated ${editorial.length} editorial entries`)
}

async function runMigration() {
  const ctx: MigrationContext = {
    companyMap: new Map(),
    toolMap: new Map(),
    errors: []
  }

  try {
    await initPayload()
    
    console.log('🚀 Starting migration within same Supabase database...')
    console.log('   Original tables: public.companies, public.tools, etc.')
    console.log('   New tables: payload.companies, payload.tools, etc.')
    
    await migrateCompanies(ctx)
    await migrateTools(ctx)
    await migrateMetrics(ctx)
    await migrateRankings(ctx)
    await migrateEditorialContent(ctx)

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Companies: ${ctx.companyMap.size}`)
    console.log(`✅ Tools: ${ctx.toolMap.size}`)
    console.log('📝 Your original Supabase tables remain unchanged')
    console.log('📝 New Payload tables created in "payload" schema')
    
    if (ctx.errors.length > 0) {
      console.log(`\n⚠️ ${ctx.errors.length} errors occurred:`)
      ctx.errors.forEach(error => console.log(error))
    }

  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
runMigration().then(() => {
  console.log('Migration script completed')
  process.exit(0)
})
```

### 2. Validation Script

```typescript
// scripts/validate-migration.ts
import payload from 'payload'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

async function validateMigration() {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET!,
    local: true,
  })

  console.log('🔍 Validating migration...')

  // Count records in both systems
  const [
    supabaseCompanies,
    supabaseTools,
    payloadCompanies,
    payloadTools,
  ] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact' }),
    supabase.from('tools').select('id', { count: 'exact' }),
    payload.find({ collection: 'companies', limit: 0 }),
    payload.find({ collection: 'tools', limit: 0 }),
  ])

  console.log('\n📊 Record counts:')
  console.log(`Companies: ${supabaseCompanies.count} (original) → ${payloadCompanies.totalDocs} (migrated)`)
  console.log(`Tools: ${supabaseTools.count} (original) → ${payloadTools.totalDocs} (migrated)`)

  // Test relationship integrity
  const toolsWithCompanies = await payload.find({
    collection: 'tools',
    where: {
      company: { exists: true }
    }
  })

  console.log(`\n🔗 Tools with company relationships: ${toolsWithCompanies.totalDocs}`)

  // Verify Supabase references
  const toolWithReference = await payload.find({
    collection: 'tools',
    where: {
      supabase_tool_id: { exists: true }
    },
    limit: 1
  })

  if (toolWithReference.totalDocs > 0) {
    console.log(`✅ Supabase references preserved`)
  } else {
    console.log(`⚠️ Missing Supabase references`)
  }

  console.log('\n✅ Migration validation completed')
}

validateMigration()
```

## Vercel Deployment

### 1. Vercel Configuration

```json
// vercel.json
{
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/admin/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ],
  "env": {
    "PAYLOAD_SECRET": "@payload-secret",
    "SUPABASE_DATABASE_URL": "@supabase-database-url",
    "SUPABASE_URL": "@supabase-url",
    "SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

### 2. Package.json Scripts

```json
{
  "scripts": {
    "dev": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts nodemon",
    "build": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts next build",
    "start": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts NODE_ENV=production node server.js",
    "migrate:payload": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts ts-node scripts/migrate-to-payload.ts",
    "validate:migration": "cross-env PAYLOAD_CONFIG_PATH=src/payload.config.ts ts-node scripts/validate-migration.ts"
  }
}
```

### 3. Server.js for Vercel

```javascript
// server.js
const express = require('express')
const payload = require('payload')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const start = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET,
    express: express(),
    onInit: () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`)
    },
  })

  await app.prepare()

  const server = payload.express

  server.get('*', (req, res) => {
    return handle(req, res)
  })

  server.listen(process.env.PORT || 3000)
}

start()
```

## Deployment Steps

### 1. Test Locally First

```bash
# 1. Set up environment
cp .env.local .env

# 2. Initialize Payload (creates schema)
npm run payload migrate

# 3. Run migration script
npm run migrate:payload

# 4. Validate migration
npm run validate:migration

# 5. Start local development
npm run dev

# Visit http://localhost:3000/admin to see Payload admin
# Visit http://localhost:3000/api/tools to test API
```

### 2. Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Set environment variables in Vercel dashboard:
# PAYLOAD_SECRET=your-secret
# SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
# SUPABASE_URL=https://[project].supabase.co
# SUPABASE_ANON_KEY=your-key

# 4. Deploy
vercel --prod

# 5. Run migration on production (one-time)
vercel env pull .env.production
ENVIRONMENT=production npm run migrate:payload
```

## API Integration & Custom Endpoints

### 1. Ranking Algorithm Endpoint

```typescript
// api/calculate-rankings.ts
import { NextApiRequest, NextApiResponse } from 'next'
import payload from 'payload'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await payload.init({
      secret: process.env.PAYLOAD_SECRET!,
      local: true,
    })

    const { period } = req.body

    // Get all active tools
    const tools = await payload.find({
      collection: 'tools',
      where: {
        status: { equals: 'active' }
      },
      limit: 1000
    })

    // Get algorithm weights
    const siteSettings = await payload.findGlobal({
      slug: 'site-settings'
    })

    const rankings = []

    for (const tool of tools.docs) {
      // Get latest metrics for this tool
      const metrics = await payload.find({
        collection: 'metrics',
        where: {
          tool: { equals: tool.id }
        },
        sort: '-recorded_at',
        limit: 100
      })

      // Calculate score using your algorithm
      const score = calculateToolScore(tool, metrics.docs, siteSettings.algorithm_weights)
      
      rankings.push({
        tool: tool.id,
        score,
        period,
        // Add other calculated fields...
      })
    }

    // Sort and assign positions
    rankings.sort((a, b) => b.score - a.score)
    rankings.forEach((ranking, index) => {
      ranking.position = index + 1
    })

    // Save rankings to Payload
    for (const ranking of rankings) {
      await payload.create({
        collection: 'rankings',
        data: ranking
      })
    }

    res.json({ success: true, rankings: rankings.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

function calculateToolScore(tool, metrics, weights) {
  // Your existing algorithm logic here
  return 8.5 // Placeholder
}
```

### 2. Data Collection from Supabase Tables

```typescript
// api/sync-with-supabase.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import payload from 'payload'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await payload.init({
      secret: process.env.PAYLOAD_SECRET!,
      local: true,
    })

    // Sync new metrics from Supabase to Payload
    const { data: newMetrics } = await supabase
      .from('metrics_history')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

    for (const metric of newMetrics || []) {
      // Find corresponding Payload tool
      const payloadTool = await payload.find({
        collection: 'tools',
        where: {
          supabase_tool_id: { equals: metric.tool_id }
        },
        limit: 1
      })

      if (payloadTool.docs.length > 0) {
        await payload.create({
          collection: 'metrics',
          data: {
            tool: payloadTool.docs[0].id,
            metric_key: metric.metric_key,
            supabase_metric_id: metric.id,
            value_integer: metric.value_integer,
            value_decimal: metric.value_decimal,
            value_text: metric.value_text,
            value_boolean: metric.value_boolean,
            value_json: metric.value_json,
            recorded_at: metric.recorded_at,
            source: metric.source,
            // ... other fields
          }
        })
      }
    }

    res.json({ success: true, synced: newMetrics?.length || 0 })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

## Benefits of This Architecture

### ✅ **Keep Current Data**
- Your existing Supabase database stays intact
- Original tables remain unchanged
- Can run both systems in parallel during transition

### ✅ **Minimal Risk**
- No data migration between services
- Easy rollback if needed
- Gradual transition possible

### ✅ **Cost Effective**
- Keep existing Supabase plan
- Vercel free tier for hosting Payload
- No additional database costs

### ✅ **Powerful CMS**
- Rich text editing for "The Real Story"
- User roles and permissions
- Draft/publish workflows
- Built-in API generation

## Migration Timeline

### Day 1: Setup & Schema
- [ ] Create Payload project
- [ ] Configure Supabase connection
- [ ] Deploy Payload schema to Supabase

### Day 2: Data Migration
- [ ] Run migration script
- [ ] Validate data integrity
- [ ] Test Payload admin interface

### Day 3: Deployment
- [ ] Deploy to Vercel
- [ ] Configure environment variables
- [ ] Test production endpoints

### Day 4: Integration
- [ ] Update frontend to use Payload APIs
- [ ] Set up automated syncing
- [ ] Train team on new admin interface

This approach gives you all the benefits of Payload CMS while keeping your existing, proven Supabase infrastructure!