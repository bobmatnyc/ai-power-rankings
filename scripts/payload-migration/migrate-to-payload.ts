#!/usr/bin/env tsx
/**
 * Main migration script to migrate data from Supabase to Payload CMS
 * 
 * Usage: pnpm tsx scripts/payload-migration/migrate-to-payload.ts
 */

import { getPayload, BasePayload } from 'payload'
import config from '../../payload.config'
import { supabase } from '../../src/lib/database'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve('.env.local') })

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
        const payloadCompany = await payload.create({
          collection: 'companies',
          data: {
            name: company.name,
            slug: company.slug || company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            supabase_company_id: company.id,
            website_url: company.website_url,
            headquarters: company.headquarters,
            founded_year: company.founded_year,
            company_size: company.company_size,
            company_type: company.company_type,
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
    // Fetch all tools from Supabase with their info
    const { data: tools, error } = await supabase
      .from('tools')
      .select(`
        *,
        companies!inner(id, name)
      `)
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
        // Get the Payload company ID
        const payloadCompanyId = context.companyIdMap.get(tool.company_id)
        if (!payloadCompanyId) {
          throw new Error(`Company not found in Payload for tool ${tool.name}`)
        }

        // Parse the info JSON column
        const info = tool.info || {}

        const payloadTool = await payload.create({
          collection: 'tools',
          data: {
            name: tool.name,
            slug: tool.slug || tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            supabase_tool_id: tool.id,
            display_name: tool.display_name || tool.name,
            company: payloadCompanyId,
            category: info.category || 'code-editor',
            subcategory: info.subcategory,
            description: info.description ? [
              {
                children: [{ text: info.description }],
              },
            ] : undefined,
            tagline: info.tagline,
            website_url: info.website_url,
            github_repo: info.github_repo,
            documentation_url: info.documentation_url,
            founded_date: info.founded_date,
            first_tracked_date: tool.created_at,
            pricing_model: info.pricing_model || 'freemium',
            license_type: info.license_type || 'proprietary',
            status: tool.status || 'active',
            logo_url: info.logo_url,
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
              recorded_at: metric.recorded_at,
              collected_at: metric.collected_at || metric.created_at,
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
    // Fetch all rankings from Supabase
    const { data: rankings, error } = await supabase
      .from('ai_tools_rankings')
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
              previous_position: ranking.previous_position,
              movement: ranking.movement,
              movement_positions: ranking.movement_positions,
              algorithm_version: ranking.algorithm_version || 'v4.0',
              data_completeness: ranking.data_completeness,
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