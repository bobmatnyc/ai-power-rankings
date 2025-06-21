# Complete Migration Plan: AI Power Rankings to Payload CMS

## Overview
Migrate the AI Power Rankings platform from Supabase to Payload CMS while maintaining full data integrity, editorial workflows, and automated ranking capabilities.

## Pre-Migration Setup

### 1. Environment Preparation
```bash
# Create new Payload project
npx create-payload-app ai-power-rankings-cms
cd ai-power-rankings-cms

# Install additional dependencies
npm install @payloadcms/richtext-slate @payloadcms/plugin-cloud-storage dotenv csv-parser

# Set up environment variables
cat > .env.local << EOF
PAYLOAD_SECRET=your-secret-key-here
MONGODB_URI=mongodb://localhost:27017/ai-power-rankings
# Or use your existing PostgreSQL
DATABASE_URI=postgresql://user:pass@localhost:5432/ai_power_rankings
NEXT_PUBLIC_PAYLOAD_URL=http://localhost:3000
EOF
```

### 2. Database Configuration
```typescript
// payload.config.ts
import { buildConfig } from 'payload/config'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { slateEditor } from '@payloadcms/richtext-slate'

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
      connectionString: process.env.DATABASE_URI,
    },
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

## Schema Migration

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
      name: 'website_url',
      type: 'text',
      validate: (val) => /^https?:\/\//.test(val) || 'Must be a valid URL',
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
      admin: {
        description: 'Array of recent developments affecting ranking',
      },
    },
    {
      name: 'notable_events',
      type: 'json',
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Auto-generate slug from name if not provided
        if (data.name && !data.slug) {
          data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        }
        return data
      },
    ],
  },
}

// collections/ToolCapabilities.ts
export const ToolCapabilities: CollectionConfig = {
  slug: 'tool-capabilities',
  admin: {
    defaultColumns: ['tool', 'capability_type', 'value_display'],
  },
  fields: [
    {
      name: 'tool',
      type: 'relationship',
      relationTo: 'tools',
      required: true,
    },
    {
      name: 'capability_type',
      type: 'select',
      options: [
        'autonomy_level',
        'context_window_size', 
        'supports_multi_file',
        'supported_languages',
        'supported_platforms',
        'integration_types',
        'llm_providers',
        'deployment_options',
        'swe_bench_score',
        'max_file_size',
        'offline_capable',
        'custom_models'
      ],
      required: true,
    },
    {
      name: 'value_text',
      type: 'text',
    },
    {
      name: 'value_number',
      type: 'number',
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
        // Generate display value for admin
        if (data.value_text) data.value_display = data.value_text
        else if (data.value_number) data.value_display = data.value_number.toString()
        else if (data.value_boolean !== undefined) data.value_display = data.value_boolean ? 'Yes' : 'No'
        else if (data.value_json) data.value_display = JSON.stringify(data.value_json).substring(0, 50) + '...'
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
      name: 'scraped_at',
      type: 'date',
      defaultValue: () => new Date(),
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

## Data Migration Scripts

### 1. Core Migration Script

```typescript
// scripts/migrate-data.ts
import payload from 'payload'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

interface MigrationContext {
  companyMap: Map<string, string>
  toolMap: Map<string, string>
  errors: string[]
}

async function initPayload() {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET!,
    local: true,
  })
  console.log('✅ Payload initialized')
}

async function migrateCompanies(ctx: MigrationContext) {
  console.log('🏢 Migrating companies...')
  
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

  // Handle parent company relationships in second pass
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
  console.log('🔧 Migrating tools...')
  
  const { data: tools, error } = await supabase
    .from('tools')
    .select(`
      *,
      companies!tools_company_id_fkey(name, slug)
    `)
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

async function migrateToolCapabilities(ctx: MigrationContext) {
  console.log('⚙️ Migrating tool capabilities...')
  
  const { data: capabilities, error } = await supabase
    .from('tool_capabilities')
    .select('*')

  if (error) throw error

  for (const capability of capabilities) {
    try {
      const toolId = ctx.toolMap.get(capability.tool_id)
      if (!toolId) {
        console.warn(`⚠️ Tool not found for capability: ${capability.tool_id}`)
        continue
      }

      await payload.create({
        collection: 'tool-capabilities',
        data: {
          tool: toolId,
          capability_type: capability.capability_type,
          value_text: capability.value_text,
          value_number: capability.value_number,
          value_boolean: capability.value_boolean,
          value_json: capability.value_json,
        }
      })
    } catch (error) {
      const errorMsg = `❌ Failed to migrate capability: ${error}`
      console.error(errorMsg)
      ctx.errors.push(errorMsg)
    }
  }

  console.log(`✅ Migrated ${capabilities.length} capabilities`)
}

async function migrateMetrics(ctx: MigrationContext) {
  console.log('📊 Migrating metrics...')
  
  const { data: metrics, error } = await supabase
    .from('metrics_history')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(10000) // Start with recent metrics

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

  console.log(`✅ Migrated ${metrics.length} metrics`)
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

async function migrateNews(ctx: MigrationContext) {
  console.log('📰 Migrating news...')
  
  const { data: news, error } = await supabase
    .from('news_updates')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(1000) // Recent news

  if (error) throw error

  for (const article of news) {
    try {
      // Map related tools
      const relatedToolIds = []
      if (article.related_tools && Array.isArray(article.related_tools)) {
        for (const toolId of article.related_tools) {
          const payloadToolId = ctx.toolMap.get(toolId)
          if (payloadToolId) relatedToolIds.push(payloadToolId)
        }
      }

      const primaryToolId = article.primary_tool_id ? ctx.toolMap.get(article.primary_tool_id) : null

      await payload.create({
        collection: 'news',
        data: {
          title: article.title,
          summary: article.summary,
          content: article.content ? {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: article.content }]
              }
            ]
          } : undefined,
          url: article.url,
          source: article.source,
          author: article.author,
          published_at: article.published_at,
          scraped_at: article.scraped_at,
          category: article.category,
          importance_score: article.importance_score,
          related_tools: relatedToolIds,
          primary_tool: primaryToolId,
          sentiment: article.sentiment,
          key_topics: article.key_topics,
          is_featured: article.is_featured,
        }
      })
    } catch (error) {
      console.error(`❌ Failed to migrate news article: ${error}`)
    }
  }

  console.log(`✅ Migrated ${news.length} news articles`)
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

      // Update the tool with editorial content
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
    
    // Run migrations in dependency order
    await migrateCompanies(ctx)
    await migrateTools(ctx)
    await migrateToolCapabilities(ctx)
    await migrateMetrics(ctx)
    await migrateRankings(ctx)
    await migrateNews(ctx)
    await migrateEditorialContent(ctx)

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Companies: ${ctx.companyMap.size}`)
    console.log(`✅ Tools: ${ctx.toolMap.size}`)
    
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

  // Count records
  const [
    supabaseCompanies,
    supabaseTools, 
    supabaseMetrics,
    payloadCompanies,
    payloadTools,
    payloadMetrics
  ] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact' }),
    supabase.from('tools').select('id', { count: 'exact' }),
    supabase.from('metrics_history').select('id', { count: 'exact' }),
    payload.find({ collection: 'companies', limit: 0 }),
    payload.find({ collection: 'tools', limit: 0 }),
    payload.find({ collection: 'metrics', limit: 0 }),
  ])

  console.log('\n📊 Record counts:')
  console.log(`Companies: ${supabaseCompanies.count} → ${payloadCompanies.totalDocs}`)
  console.log(`Tools: ${supabaseTools.count} → ${payloadTools.totalDocs}`)
  console.log(`Metrics: ${supabaseMetrics.count} → ${payloadMetrics.totalDocs}`)

  // Validate relationships
  const toolsWithCompanies = await payload.find({
    collection: 'tools',
    where: {
      company: { exists: true }
    }
  })

  console.log(`\n🔗 Tools with company relationships: ${toolsWithCompanies.totalDocs}`)

  // Check for missing critical data
  const toolsWithoutSlugs = await payload.find({
    collection: 'tools',
    where: {
      slug: { exists: false }
    }
  })

  if (toolsWithoutSlugs.totalDocs > 0) {
    console.log(`⚠️ Found ${toolsWithoutSlugs.totalDocs} tools without slugs`)
  }

  console.log('\n✅ Migration validation completed')
}

validateMigration()
```

## API Integration

### 1. Custom Endpoints

```typescript
// api/ranking-algorithm.ts
import { Endpoint } from 'payload/config'
import payload from 'payload'

const calculateRankings: Endpoint = {
  path: '/calculate-rankings',
  method: 'post',
  handler: async (req, res) => {
    try {
      const { period } = req.body

      // Get all active tools with latest metrics
      const tools = await payload.find({
        collection: 'tools',
        where: {
          status: { equals: 'active' }
        },
        limit: 1000
      })

      // Get site settings for algorithm weights
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

        // Calculate score using algorithm
        const score = calculateToolScore(tool, metrics.docs, siteSettings.algorithm_weights)
        
        rankings.push({
          tool: tool.id,
          score,
          // ... other calculated fields
        })
      }

      // Sort by score and assign positions
      rankings.sort((a, b) => b.score - a.score)
      rankings.forEach((ranking, index) => {
        ranking.position = index + 1
      })

      // Save rankings
      for (const ranking of rankings) {
        await payload.create({
          collection: 'rankings',
          data: {
            period,
            ...ranking
          }
        })
      }

      res.json({ success: true, rankings: rankings.length })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
}

function calculateToolScore(tool, metrics, weights) {
  // Implement your ranking algorithm here
  // This should match your existing algorithm logic
  return 8.5 // Placeholder
}

export default calculateRankings
```

### 2. Automated Data Collection

```typescript
// api/collect-data.ts
import { Endpoint } from 'payload/config'

const collectData: Endpoint = {
  path: '/collect-data',
  method: 'post',
  handler: async (req, res) => {
    try {
      const { source } = req.body // 'github', 'news', 'social'

      switch (source) {
        case 'github':
          await collectGitHubMetrics()
          break
        case 'news':
          await collectNewsUpdates()
          break
        default:
          throw new Error('Invalid source')
      }

      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  }
}

async function collectGitHubMetrics() {
  const tools = await payload.find({
    collection: 'tools',
    where: {
      github_repo: { exists: true }
    }
  })

  for (const tool of tools.docs) {
    if (!tool.github_repo) continue

    try {
      // Fetch GitHub data
      const response = await fetch(`https://api.github.com/repos/${tool.github_repo}`)
      const githubData = await response.json()

      // Save metrics
      await payload.create({
        collection: 'metrics',
        data: {
          tool: tool.id,
          metric_key: 'github_stars',
          value_integer: githubData.stargazers_count,
          recorded_at: new Date(),
          source: 'github_api'
        }
      })

      await payload.create({
        collection: 'metrics',
        data: {
          tool: tool.id,
          metric_key: 'github_forks',
          value_integer: githubData.forks_count,
          recorded_at: new Date(),
          source: 'github_api'
        }
      })
    } catch (error) {
      console.error(`Failed to collect GitHub data for ${tool.name}:`, error)
    }
  }
}

export default collectData
```

## Testing Strategy

### 1. Migration Testing

```bash
# Create test script
cat > scripts/test-migration.sh << 'EOF'
#!/bin/bash

echo "🧪 Testing migration..."

# Backup current data
echo "📦 Creating backup..."
pg_dump $DATABASE_URL > backup_pre_migration.sql

# Run migration
echo "🚀 Running migration..."
npm run migrate:payload

# Run validation
echo "🔍 Validating data..."
npm run validate:migration

# Test API endpoints
echo "🌐 Testing APIs..."
curl -X POST http://localhost:3000/api/calculate-rankings \
  -H "Content-Type: application/json" \
  -d '{"period":"test-2025"}'

echo "✅ Migration test completed"
EOF

chmod +x scripts/test-migration.sh
```

### 2. Data Integrity Checks

```typescript
// scripts/integrity-check.ts
async function runIntegrityChecks() {
  console.log('🔍 Running data integrity checks...')

  // Check for orphaned records
  const orphanedMetrics = await payload.find({
    collection: 'metrics',
    where: {
      tool: { exists: false }
    }
  })

  if (orphanedMetrics.totalDocs > 0) {
    console.log(`⚠️ Found ${orphanedMetrics.totalDocs} orphaned metrics`)
  }

  // Check for duplicate slugs
  const allTools = await payload.find({
    collection: 'tools',
    limit: 1000
  })

  const slugs = new Set()
  const duplicates = []
  
  allTools.docs.forEach(tool => {
    if (slugs.has(tool.slug)) {
      duplicates.push(tool.slug)
    }
    slugs.add(tool.slug)
  })

  if (duplicates.length > 0) {
    console.log(`⚠️ Found duplicate slugs: ${duplicates.join(', ')}`)
  }

  // Validate required relationships
  const toolsWithoutCompanies = await payload.find({
    collection: 'tools',
    where: {
      company: { exists: false }
    }
  })

  if (toolsWithoutCompanies.totalDocs > 0) {
    console.log(`⚠️ Found ${toolsWithoutCompanies.totalDocs} tools without companies`)
  }

  console.log('✅ Integrity checks completed')
}
```

## Deployment Instructions

### 1. Production Setup

```bash
# 1. Set up production environment
export NODE_ENV=production
export PAYLOAD_SECRET="your-super-secure-secret"
export DATABASE_URI="your-production-db-url"

# 2. Install dependencies
npm ci

# 3. Build the application
npm run build

# 4. Run database migrations
npm run payload migrate

# 5. Run data migration
npm run migrate:data

# 6. Start the application
npm start
```

### 2. Vercel Deployment

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
    "DATABASE_URI": "@database-uri"
  }
}
```

## Post-Migration Tasks

### 1. Content Audit
- [ ] Verify all tools migrated correctly
- [ ] Check editorial content formatting
- [ ] Validate relationship integrity
- [ ] Test ranking calculations

### 2. API Integration
- [ ] Update data collection scripts
- [ ] Test automated ranking generation
- [ ] Verify webhook functionality
- [ ] Update frontend API calls

### 3. Editorial Workflow
- [ ] Train content team on new admin interface
- [ ] Set up user roles and permissions
- [ ] Test draft/publish workflow
- [ ] Configure editorial notifications

### 4. Performance Optimization
- [ ] Add database indexes
- [ ] Configure caching
- [ ] Optimize query performance
- [ ] Set up monitoring

This migration plan provides a complete path from your current Supabase setup to a fully functional Payload CMS implementation while preserving all data integrity and maintaining your existing workflows.