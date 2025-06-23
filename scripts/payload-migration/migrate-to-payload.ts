#!/usr/bin/env tsx
/**
 * Main migration script to migrate data from Supabase to Payload CMS
 * 
 * Usage: pnpm tsx scripts/payload-migration/migrate-to-payload.ts
 */

// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve('.env.local') })

// Verify critical env vars are loaded
if (!process.env.PAYLOAD_SECRET) {
  console.error('PAYLOAD_SECRET not found in environment')
  process.exit(1)
}
if (!process.env.SUPABASE_DATABASE_URL) {
  console.error('SUPABASE_DATABASE_URL not found in environment')
  process.exit(1)
}

console.log('Environment variables loaded:')
console.log('- PAYLOAD_SECRET:', process.env.PAYLOAD_SECRET ? 'Set' : 'Missing')
console.log('- SUPABASE_DATABASE_URL:', process.env.SUPABASE_DATABASE_URL ? 'Set' : 'Missing')
console.log('- Database URL prefix:', process.env.SUPABASE_DATABASE_URL?.substring(0, 50) + '...')

// Now import everything else
import { getPayload, BasePayload } from 'payload'
import { getSupabaseClient } from './lib/database'

const supabase = getSupabaseClient()

type PayloadInstance = BasePayload

interface MigrationContext {
  companyIdMap: Map<string, string> // Supabase ID -> Payload ID
  toolIdMap: Map<string, string> // Supabase ID -> Payload ID
  errors: Array<{ entity: string; id: string; error: string }>
  stats: {
    companies: { total: number; migrated: number; failed: number }
    tools: { total: number; migrated: number; failed: number }
    metrics: { total: number; migrated: number; failed: number }
    rankings: { total: number; migrated: number; failed: number }
  }
}

async function initializePayload() {
  console.log('🚀 Initializing Payload...')
  // Import config after env vars are loaded
  const config = (await import('./payload-config')).default
  const payload = await getPayload({ config })
  return payload
}

async function migrateCompanies(payload: PayloadInstance, context: MigrationContext) {
  console.log('\n📦 Migrating Companies...')
  
  try {
    // Fetch all companies from Supabase
    const { data: companies, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!companies) {
      console.log('No companies found to migrate')
      return
    }

    context.stats.companies.total = companies.length
    console.log(`Found ${companies.length} companies to migrate`)

    // First pass: Create all companies without parent relationships
    for (const company of companies) {
      try {
        // Check if company already exists in Payload
        const existingCompany = await payload.find({
          collection: 'companies',
          where: {
            supabase_company_id: {
              equals: company.id,
            },
          },
          limit: 1,
        })

        if (existingCompany.docs.length > 0) {
          console.log(`⏭️  Company already exists: ${company.name}`)
          context.companyIdMap.set(company.id, existingCompany.docs[0].id)
          context.stats.companies.migrated++
          continue
        }

        // Generate a unique slug
        let slug = company.slug || company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        let slugSuffix = 1
        let isUnique = false
        
        while (!isUnique) {
          const existingSlug = await payload.find({
            collection: 'companies',
            where: {
              slug: {
                equals: slug,
              },
            },
            limit: 1,
          })
          
          if (existingSlug.docs.length === 0) {
            isUnique = true
          } else {
            slug = `${company.slug || company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slugSuffix}`
            slugSuffix++
          }
        }

        const payloadCompany = await payload.create({
          collection: 'companies',
          data: {
            name: company.name,
            slug: slug,
            supabase_company_id: company.id,
            website_url: company.website_url,
            headquarters: company.headquarters,
            founded_year: company.founded_year,
            company_size: company.company_size,
            company_type: company.company_type || 'startup', // Default to startup if null
            logo_url: company.logo_url,
            description: company.description ? [
              {
                children: [{ text: company.description }],
              },
            ] : undefined,
          },
        })

        context.companyIdMap.set(company.id, payloadCompany.id)
        context.stats.companies.migrated++
        console.log(`✅ Migrated company: ${company.name}`)
      } catch (error) {
        context.stats.companies.failed++
        context.errors.push({
          entity: 'company',
          id: company.id,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error(`❌ Failed to migrate company ${company.name}:`, error)
      }
    }

    // Second pass: Update parent company relationships
    console.log('\n🔗 Updating parent company relationships...')
    for (const company of companies) {
      if (company.parent_company_id && context.companyIdMap.has(company.parent_company_id)) {
        try {
          const payloadId = context.companyIdMap.get(company.id)
          const parentPayloadId = context.companyIdMap.get(company.parent_company_id)
          
          if (payloadId && parentPayloadId) {
            await payload.update({
              collection: 'companies',
              id: payloadId,
              data: {
                parent_company: parentPayloadId,
              },
            })
            console.log(`✅ Updated parent relationship for ${company.name}`)
          }
        } catch (error) {
          console.error(`❌ Failed to update parent relationship for ${company.name}:`, error)
        }
      }
    }
  } catch (error) {
    console.error('❌ Error migrating companies:', error)
    throw error
  }
}

async function migrateTools(payload: PayloadInstance, context: MigrationContext) {
  console.log('\n🛠️  Migrating Tools...')
  
  try {
    // Fetch all tools from Supabase
    const { data: tools, error } = await supabase
      .from('tools')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!tools) {
      console.log('No tools found to migrate')
      return
    }

    context.stats.tools.total = tools.length
    console.log(`Found ${tools.length} tools to migrate`)

    for (const tool of tools) {
      try {
        // Check if tool already exists in Payload
        const existingTool = await payload.find({
          collection: 'tools',
          where: {
            supabase_tool_id: {
              equals: tool.id,
            },
          },
          limit: 1,
        })

        if (existingTool.docs.length > 0) {
          console.log(`⏭️  Tool already exists: ${tool.name}`)
          context.toolIdMap.set(tool.id, existingTool.docs[0].id)
          context.stats.tools.migrated++
          continue
        }

        // Get the Payload company ID
        let payloadCompanyId = context.companyIdMap.get(tool.company_id)
        if (!payloadCompanyId) {
          console.warn(`⚠️  Company not found in Payload for tool ${tool.name} (company_id: ${tool.company_id}). Creating placeholder company.`)
          
          // Create a placeholder company if it doesn't exist
          // This ensures tools can be migrated even if companies are missing
          const placeholderCompany = await payload.create({
            collection: 'companies',
            data: {
              name: `Unknown Company (${tool.company_id})`,
              slug: `unknown-${tool.company_id}`,
              supabase_company_id: tool.company_id,
              company_type: 'private',
              company_size: 'startup',
            },
          })
          
          context.companyIdMap.set(tool.company_id, placeholderCompany.id)
          context.stats.companies.migrated++
          payloadCompanyId = placeholderCompany.id
        }

        // Parse the info JSON column if it exists, otherwise use direct fields
        const info = tool.info || {}
        
        // Generate a unique slug
        let slug = tool.slug || tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        let slugSuffix = 1
        let isUnique = false
        
        while (!isUnique) {
          const existingSlug = await payload.find({
            collection: 'tools',
            where: {
              slug: {
                equals: slug,
              },
            },
            limit: 1,
          })
          
          if (existingSlug.docs.length === 0) {
            isUnique = true
          } else {
            slug = `${tool.slug || tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slugSuffix}`
            slugSuffix++
          }
        }

        const payloadTool = await payload.create({
          collection: 'tools',
          data: {
            name: tool.name,
            slug: slug,
            supabase_tool_id: tool.id,
            display_name: tool.display_name || tool.name,
            company: payloadCompanyId,
            category: (() => {
              const cat = tool.category || info.category || 'code-editor'
              // Map invalid categories to valid ones
              if (cat === 'code-generation') return 'ide-assistant'
              return cat
            })(),
            subcategory: tool.subcategory || info.subcategory,
            description: (tool.description || info.description) ? [
              {
                children: [{ text: tool.description || info.description }],
              },
            ] : undefined,
            tagline: tool.tagline || info.tagline,
            website_url: tool.website_url || info.website_url,
            github_repo: (() => {
              const repo = tool.github_repo || info.github_repo
              if (!repo) return undefined
              // Convert full URLs to owner/repo format
              const match = repo.match(/github\.com\/([^\/]+\/[^\/]+)/)
              if (match) return match[1]
              // If already in correct format, return as is
              if (/^[\w\-\.]+\/[\w\-\.]+$/.test(repo)) return repo
              return undefined
            })(),
            documentation_url: info.documentation_url,
            founded_date: tool.founded_date || info.founded_date,
            first_tracked_date: tool.first_tracked_date || tool.created_at,
            pricing_model: tool.pricing_model || info.pricing_model || 'freemium',
            license_type: tool.license_type || info.license_type || 'proprietary',
            status: tool.status || 'active',
            logo_url: tool.logo_url || info.logo_url,
            screenshot_url: info.screenshot_url,
            is_featured: tool.is_featured || false,
            current_ranking: tool.current_ranking,
            the_real_story: info.the_real_story ? [
              {
                children: [{ text: info.the_real_story }],
              },
            ] : undefined,
            competitive_analysis: info.competitive_analysis ? [
              {
                children: [{ text: info.competitive_analysis }],
              },
            ] : undefined,
            key_developments: info.key_developments,
            notable_events: info.notable_events,
          },
        })

        context.toolIdMap.set(tool.id, payloadTool.id)
        context.stats.tools.migrated++
        console.log(`✅ Migrated tool: ${tool.name}`)
      } catch (error) {
        context.stats.tools.failed++
        context.errors.push({
          entity: 'tool',
          id: tool.id,
          error: error instanceof Error ? error.message : String(error),
        })
        console.error(`❌ Failed to migrate tool ${tool.name}:`, error)
      }
    }
  } catch (error) {
    console.error('❌ Error migrating tools:', error)
    throw error
  }
}

async function migrateRecentMetrics(payload: PayloadInstance, context: MigrationContext, limit = 5000) {
  console.log(`\n📊 Migrating Recent Metrics (limit: ${limit})...`)
  
  try {
    // Fetch recent metrics from Supabase
    const { data: metrics, error } = await supabase
      .from('metrics_history')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    if (!metrics) {
      console.log('No metrics found to migrate')
      return
    }

    context.stats.metrics.total = metrics.length
    console.log(`Found ${metrics.length} metrics to migrate`)

    // Group metrics by tool for batch processing
    const metricsByTool = new Map<string, typeof metrics>()
    for (const metric of metrics) {
      if (!metricsByTool.has(metric.tool_id)) {
        metricsByTool.set(metric.tool_id, [])
      }
      metricsByTool.get(metric.tool_id)?.push(metric)
    }

    for (const [toolId, toolMetrics] of metricsByTool) {
      const payloadToolId = context.toolIdMap.get(toolId)
      if (!payloadToolId) {
        console.warn(`⚠️  Tool not found in Payload for metrics: ${toolId}`)
        continue
      }

      console.log(`📈 Migrating ${toolMetrics.length} metrics for tool ${toolId}`)
      
      for (const metric of toolMetrics) {
        try {
          await payload.create({
            collection: 'metrics',
            data: {
              tool: payloadToolId,
              metric_key: metric.metric_key,
              supabase_metric_id: metric.id,
              value_integer: metric.value_integer,
              value_decimal: metric.value_decimal,
              value_text: metric.value_text,
              value_boolean: metric.value_boolean,
              value_json: metric.value_json,
              recorded_at: metric.recorded_at || new Date().toISOString(),
              collected_at: metric.collected_at || metric.created_at || new Date().toISOString(),
              source: metric.source,
              source_url: metric.source_url,
              confidence_score: metric.confidence_score || 1.0,
              notes: metric.notes,
              is_estimate: metric.is_estimate || false,
            },
          })
          context.stats.metrics.migrated++
        } catch (error) {
          context.stats.metrics.failed++
          context.errors.push({
            entity: 'metric',
            id: metric.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
    
    console.log(`✅ Migrated ${context.stats.metrics.migrated} metrics`)
  } catch (error) {
    console.error('❌ Error migrating metrics:', error)
    throw error
  }
}

async function migrateRankings(payload: PayloadInstance, context: MigrationContext) {
  console.log('\n🏆 Migrating Rankings...')
  
  try {
    // Fetch all rankings from Supabase - using ranking_cache table
    const { data: rankings, error } = await supabase
      .from('ranking_cache')
      .select('*')
      .order('period', { ascending: false })

    if (error) throw error
    if (!rankings) {
      console.log('No rankings found to migrate')
      return
    }

    context.stats.rankings.total = rankings.length
    console.log(`Found ${rankings.length} rankings to migrate`)

    // Group rankings by period for easier tracking
    const rankingsByPeriod = new Map<string, typeof rankings>()
    for (const ranking of rankings) {
      if (!rankingsByPeriod.has(ranking.period)) {
        rankingsByPeriod.set(ranking.period, [])
      }
      rankingsByPeriod.get(ranking.period)?.push(ranking)
    }

    for (const [period, periodRankings] of rankingsByPeriod) {
      console.log(`📅 Migrating rankings for period: ${period}`)
      
      for (const ranking of periodRankings) {
        try {
          const payloadToolId = context.toolIdMap.get(ranking.tool_id)
          if (!payloadToolId) {
            console.warn(`⚠️  Tool not found in Payload for ranking: ${ranking.tool_id}`)
            continue
          }

          // Check if ranking already exists
          const existingRanking = await payload.find({
            collection: 'rankings',
            where: {
              and: [
                {
                  period: {
                    equals: ranking.period,
                  },
                },
                {
                  tool: {
                    equals: payloadToolId,
                  },
                },
              ],
            },
            limit: 1,
          })

          if (existingRanking.docs.length > 0) {
            console.log(`⏭️  Ranking already exists for tool in period ${ranking.period}`)
            context.stats.rankings.migrated++
            continue
          }

          await payload.create({
            collection: 'rankings',
            data: {
              period: ranking.period,
              tool: payloadToolId,
              position: ranking.position,
              score: ranking.score,
              market_traction_score: ranking.market_traction_score,
              technical_capability_score: ranking.technical_capability_score,
              developer_adoption_score: ranking.developer_adoption_score,
              development_velocity_score: ranking.development_velocity_score,
              platform_resilience_score: ranking.platform_resilience_score,
              community_sentiment_score: ranking.community_sentiment_score,
              previous_position: ranking.previous_position || null,
              movement: ranking.movement || null,
              movement_positions: ranking.movement_positions || null,
              algorithm_version: ranking.algorithm_version || 'v4.0',
              data_completeness: ranking.data_completeness || null,
            },
          })
          context.stats.rankings.migrated++
        } catch (error) {
          context.stats.rankings.failed++
          context.errors.push({
            entity: 'ranking',
            id: ranking.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
    
    console.log(`✅ Migrated ${context.stats.rankings.migrated} rankings`)
  } catch (error) {
    console.error('❌ Error migrating rankings:', error)
    throw error
  }
}

async function printMigrationSummary(context: MigrationContext) {
  console.log('\n' + '='.repeat(50))
  console.log('📊 MIGRATION SUMMARY')
  console.log('='.repeat(50))
  
  console.log('\n✅ Successfully Migrated:')
  console.log(`   Companies: ${context.stats.companies.migrated}/${context.stats.companies.total}`)
  console.log(`   Tools: ${context.stats.tools.migrated}/${context.stats.tools.total}`)
  console.log(`   Metrics: ${context.stats.metrics.migrated}/${context.stats.metrics.total}`)
  console.log(`   Rankings: ${context.stats.rankings.migrated}/${context.stats.rankings.total}`)
  
  const totalFailed = context.stats.companies.failed + 
                     context.stats.tools.failed + 
                     context.stats.metrics.failed + 
                     context.stats.rankings.failed
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed Migrations:')
    console.log(`   Companies: ${context.stats.companies.failed}`)
    console.log(`   Tools: ${context.stats.tools.failed}`)
    console.log(`   Metrics: ${context.stats.metrics.failed}`)
    console.log(`   Rankings: ${context.stats.rankings.failed}`)
    
    if (context.errors.length > 0) {
      console.log('\n🔍 Error Details (first 10):')
      context.errors.slice(0, 10).forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.entity} (${err.id}): ${err.error}`)
      })
    }
  }
  
  console.log('\n' + '='.repeat(50))
}

async function main() {
  console.log('🚀 Starting Supabase to Payload CMS Migration')
  console.log('='.repeat(50))
  
  const context: MigrationContext = {
    companyIdMap: new Map(),
    toolIdMap: new Map(),
    errors: [],
    stats: {
      companies: { total: 0, migrated: 0, failed: 0 },
      tools: { total: 0, migrated: 0, failed: 0 },
      metrics: { total: 0, migrated: 0, failed: 0 },
      rankings: { total: 0, migrated: 0, failed: 0 },
    },
  }
  
  try {
    // Initialize Payload
    const payload = await initializePayload()
    
    // Run migrations in order
    await migrateCompanies(payload, context)
    await migrateTools(payload, context)
    await migrateRecentMetrics(payload, context, 5000) // Start with 5000 recent metrics
    await migrateRankings(payload, context)
    
    // Print summary
    await printMigrationSummary(context)
    
    console.log('\n✅ Migration completed!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    await printMigrationSummary(context)
    process.exit(1)
  }
}

// Run migration
main().catch(console.error)