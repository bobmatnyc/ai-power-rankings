#!/usr/bin/env tsx
/**
 * Validation script to verify data migration from Supabase to Payload CMS
 * 
 * Usage: pnpm tsx scripts/payload-migration/validate-migration.ts
 */

// Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve('.env.local') })

// Now import everything else
import { getPayload, BasePayload } from 'payload'
import config from '../../payload.config'
import { getSupabaseClient } from './lib/database'
import { writeFileSync } from 'fs'

const supabase = getSupabaseClient()

type PayloadInstance = BasePayload

interface ValidationResult {
  entity: string
  supabaseCount: number
  payloadCount: number
  match: boolean
  missingInPayload: string[]
  orphanedInPayload: string[]
  relationshipErrors: string[]
}

interface ValidationReport {
  timestamp: string
  results: ValidationResult[]
  summary: {
    totalEntities: number
    validEntities: number
    errors: number
  }
}

async function initializePayload() {
  console.log('🚀 Initializing Payload...')
  const payload = await getPayload({ config })
  return payload
}

async function validateCompanies(payload: PayloadInstance): Promise<ValidationResult> {
  console.log('\n📦 Validating Companies...')
  
  const result: ValidationResult = {
    entity: 'companies',
    supabaseCount: 0,
    payloadCount: 0,
    match: false,
    missingInPayload: [],
    orphanedInPayload: [],
    relationshipErrors: [],
  }
  
  try {
    // Get Supabase companies
    const { data: supabaseCompanies, error } = await supabase
      .from('companies')
      .select('id, name, parent_company_id')
    
    if (error) throw error
    result.supabaseCount = supabaseCompanies?.length || 0
    
    // Get Payload companies
    const payloadCompanies = await payload.find({
      collection: 'companies',
      limit: 10000,
      depth: 0,
    })
    result.payloadCount = payloadCompanies.totalDocs
    
    // Create maps for comparison
    const supabaseMap = new Map(
      supabaseCompanies?.map(c => [c.id, c]) || []
    )
    const payloadMap = new Map(
      payloadCompanies.docs.map(c => [c.supabase_company_id, c])
    )
    
    // Check for missing companies in Payload
    for (const [supabaseId, company] of supabaseMap) {
      if (!payloadMap.has(supabaseId)) {
        result.missingInPayload.push(`${company.name} (${supabaseId})`)
      }
    }
    
    // Check for orphaned companies in Payload (no Supabase reference)
    for (const company of payloadCompanies.docs) {
      if (!company.supabase_company_id || !supabaseMap.has(company.supabase_company_id)) {
        result.orphanedInPayload.push(`${company.name} (${company.id})`)
      }
    }
    
    // Validate parent company relationships
    for (const company of payloadCompanies.docs) {
      if (company.parent_company && company.supabase_company_id) {
        const supabaseCompany = supabaseMap.get(company.supabase_company_id)
        if (supabaseCompany?.parent_company_id) {
          // Find the parent in Payload
          const parentInPayload = payloadCompanies.docs.find(
            c => c.supabase_company_id === supabaseCompany.parent_company_id
          )
          if (parentInPayload && parentInPayload.id !== company.parent_company) {
            result.relationshipErrors.push(
              `Parent mismatch for ${company.name}: Expected ${parentInPayload.id}, got ${company.parent_company}`
            )
          }
        }
      }
    }
    
    result.match = result.supabaseCount === result.payloadCount && 
                   result.missingInPayload.length === 0 && 
                   result.orphanedInPayload.length === 0 &&
                   result.relationshipErrors.length === 0
    
    console.log(`✅ Companies: ${result.supabaseCount} in Supabase, ${result.payloadCount} in Payload`)
  } catch (error) {
    console.error('❌ Error validating companies:', error)
  }
  
  return result
}

async function validateTools(payload: PayloadInstance): Promise<ValidationResult> {
  console.log('\n🛠️  Validating Tools...')
  
  const result: ValidationResult = {
    entity: 'tools',
    supabaseCount: 0,
    payloadCount: 0,
    match: false,
    missingInPayload: [],
    orphanedInPayload: [],
    relationshipErrors: [],
  }
  
  try {
    // Get Supabase tools
    const { data: supabaseTools, error } = await supabase
      .from('tools')
      .select('id, name, company_id')
    
    if (error) throw error
    result.supabaseCount = supabaseTools?.length || 0
    
    // Get Payload tools
    const payloadTools = await payload.find({
      collection: 'tools',
      limit: 10000,
      depth: 1, // Include company relationship
    })
    result.payloadCount = payloadTools.totalDocs
    
    // Get company mappings
    const payloadCompanies = await payload.find({
      collection: 'companies',
      limit: 10000,
      depth: 0,
    })
    const companyMap = new Map(
      payloadCompanies.docs.map(c => [c.supabase_company_id, c.id])
    )
    
    // Create maps for comparison
    const supabaseMap = new Map(
      supabaseTools?.map(t => [t.id, t]) || []
    )
    const payloadMap = new Map(
      payloadTools.docs.map(t => [t.supabase_tool_id, t])
    )
    
    // Check for missing tools in Payload
    for (const [supabaseId, tool] of supabaseMap) {
      if (!payloadMap.has(supabaseId)) {
        result.missingInPayload.push(`${tool.name} (${supabaseId})`)
      }
    }
    
    // Check for orphaned tools in Payload
    for (const tool of payloadTools.docs) {
      if (!tool.supabase_tool_id || !supabaseMap.has(tool.supabase_tool_id)) {
        result.orphanedInPayload.push(`${tool.name} (${tool.id})`)
      }
    }
    
    // Validate company relationships
    for (const tool of payloadTools.docs) {
      if (tool.supabase_tool_id) {
        const supabaseTool = supabaseMap.get(tool.supabase_tool_id)
        if (supabaseTool?.company_id) {
          const expectedCompanyId = companyMap.get(supabaseTool.company_id)
          const actualCompanyId = typeof tool.company === 'string' 
            ? tool.company 
            : tool.company?.id
          
          if (expectedCompanyId && expectedCompanyId !== actualCompanyId) {
            result.relationshipErrors.push(
              `Company mismatch for ${tool.name}: Expected ${expectedCompanyId}, got ${actualCompanyId}`
            )
          }
        }
      }
    }
    
    result.match = result.supabaseCount === result.payloadCount && 
                   result.missingInPayload.length === 0 && 
                   result.orphanedInPayload.length === 0 &&
                   result.relationshipErrors.length === 0
    
    console.log(`✅ Tools: ${result.supabaseCount} in Supabase, ${result.payloadCount} in Payload`)
  } catch (error) {
    console.error('❌ Error validating tools:', error)
  }
  
  return result
}

async function validateMetrics(payload: PayloadInstance, limit = 5000): Promise<ValidationResult> {
  console.log(`\n📊 Validating Metrics (recent ${limit})...`)
  
  const result: ValidationResult = {
    entity: 'metrics',
    supabaseCount: 0,
    payloadCount: 0,
    match: false,
    missingInPayload: [],
    orphanedInPayload: [],
    relationshipErrors: [],
  }
  
  try {
    // Get recent Supabase metrics
    const { data: supabaseMetrics, error } = await supabase
      .from('metrics_history')
      .select('id, metric_key, tool_id')
      .order('recorded_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    result.supabaseCount = supabaseMetrics?.length || 0
    
    // Get Payload metrics
    const payloadMetrics = await payload.find({
      collection: 'metrics',
      limit: limit,
      sort: '-recorded_at',
      depth: 0,
    })
    result.payloadCount = payloadMetrics.totalDocs
    
    // Since we're only checking recent metrics, we'll focus on general counts
    // and spot-check a few records
    
    // Create map of Supabase metrics
    const supabaseMap = new Map(
      supabaseMetrics?.map(m => [m.id, m]) || []
    )
    
    // Spot check some metrics
    const sampleSize = Math.min(100, payloadMetrics.docs.length)
    for (let i = 0; i < sampleSize; i++) {
      const payloadMetric = payloadMetrics.docs[i]
      if (payloadMetric.supabase_metric_id && !supabaseMap.has(payloadMetric.supabase_metric_id)) {
        result.orphanedInPayload.push(
          `${payloadMetric.metric_key} (${payloadMetric.supabase_metric_id})`
        )
      }
    }
    
    // For metrics, we're more lenient with the match since we're only migrating recent ones
    result.match = result.orphanedInPayload.length === 0 && result.relationshipErrors.length === 0
    
    console.log(`✅ Metrics: ${result.supabaseCount} recent in Supabase, ${result.payloadCount} in Payload`)
  } catch (error) {
    console.error('❌ Error validating metrics:', error)
  }
  
  return result
}

async function validateRankings(payload: PayloadInstance): Promise<ValidationResult> {
  console.log('\n🏆 Validating Rankings...')
  
  const result: ValidationResult = {
    entity: 'rankings',
    supabaseCount: 0,
    payloadCount: 0,
    match: false,
    missingInPayload: [],
    orphanedInPayload: [],
    relationshipErrors: [],
  }
  
  try {
    // Get Supabase rankings
    const { data: supabaseRankings, error } = await supabase
      .from('ai_tools_rankings')
      .select('id, period, tool_id, position')
    
    if (error) throw error
    result.supabaseCount = supabaseRankings?.length || 0
    
    // Get Payload rankings
    const payloadRankings = await payload.find({
      collection: 'rankings',
      limit: 10000,
      depth: 0,
    })
    result.payloadCount = payloadRankings.totalDocs
    
    // Get unique periods in both systems
    const supabasePeriods = new Set(supabaseRankings?.map(r => r.period) || [])
    const payloadPeriods = new Set(payloadRankings.docs.map(r => r.period))
    
    // Check for missing periods
    for (const period of supabasePeriods) {
      if (!payloadPeriods.has(period)) {
        result.missingInPayload.push(`Period: ${period}`)
      }
    }
    
    // Check for orphaned periods
    for (const period of payloadPeriods) {
      if (!supabasePeriods.has(period)) {
        result.orphanedInPayload.push(`Period: ${period}`)
      }
    }
    
    result.match = result.supabaseCount === result.payloadCount && 
                   result.missingInPayload.length === 0 && 
                   result.orphanedInPayload.length === 0
    
    console.log(`✅ Rankings: ${result.supabaseCount} in Supabase, ${result.payloadCount} in Payload`)
    console.log(`   Periods: ${supabasePeriods.size} in Supabase, ${payloadPeriods.size} in Payload`)
  } catch (error) {
    console.error('❌ Error validating rankings:', error)
  }
  
  return result
}

async function generateReport(results: ValidationResult[]): Promise<ValidationReport> {
  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalEntities: results.length,
      validEntities: results.filter(r => r.match).length,
      errors: results.filter(r => !r.match).length,
    },
  }
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'scripts/payload-migration/validation-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Validation report saved to: ${reportPath}`)
  
  return report
}

async function printValidationSummary(report: ValidationReport) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 VALIDATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`Timestamp: ${report.timestamp}`)
  console.log(`\nOverall Status: ${report.summary.errors === 0 ? '✅ PASSED' : '❌ FAILED'}`)
  console.log(`Valid Entities: ${report.summary.validEntities}/${report.summary.totalEntities}`)
  
  console.log('\nDetailed Results:')
  for (const result of report.results) {
    const status = result.match ? '✅' : '❌'
    console.log(`\n${status} ${result.entity.toUpperCase()}`)
    console.log(`   Supabase: ${result.supabaseCount} records`)
    console.log(`   Payload: ${result.payloadCount} records`)
    
    if (!result.match) {
      if (result.missingInPayload.length > 0) {
        console.log(`   Missing in Payload: ${result.missingInPayload.length}`)
        result.missingInPayload.slice(0, 5).forEach(item => {
          console.log(`     - ${item}`)
        })
        if (result.missingInPayload.length > 5) {
          console.log(`     ... and ${result.missingInPayload.length - 5} more`)
        }
      }
      
      if (result.orphanedInPayload.length > 0) {
        console.log(`   Orphaned in Payload: ${result.orphanedInPayload.length}`)
        result.orphanedInPayload.slice(0, 5).forEach(item => {
          console.log(`     - ${item}`)
        })
        if (result.orphanedInPayload.length > 5) {
          console.log(`     ... and ${result.orphanedInPayload.length - 5} more`)
        }
      }
      
      if (result.relationshipErrors.length > 0) {
        console.log(`   Relationship Errors: ${result.relationshipErrors.length}`)
        result.relationshipErrors.slice(0, 5).forEach(error => {
          console.log(`     - ${error}`)
        })
        if (result.relationshipErrors.length > 5) {
          console.log(`     ... and ${result.relationshipErrors.length - 5} more`)
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60))
}

async function main() {
  console.log('🔍 Starting Migration Validation')
  console.log('='.repeat(60))
  
  try {
    // Initialize Payload
    const payload = await initializePayload()
    
    // Run validations
    const results: ValidationResult[] = []
    results.push(await validateCompanies(payload))
    results.push(await validateTools(payload))
    results.push(await validateMetrics(payload, 5000))
    results.push(await validateRankings(payload))
    
    // Generate report
    const report = await generateReport(results)
    
    // Print summary
    await printValidationSummary(report)
    
    // Exit with appropriate code
    process.exit(report.summary.errors === 0 ? 0 : 1)
  } catch (error) {
    console.error('\n❌ Validation failed:', error)
    process.exit(1)
  }
}

// Run validation
main().catch(console.error)