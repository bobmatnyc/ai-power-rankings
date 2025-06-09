import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || ''
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importV0McpMetrics() {
  try {
    console.log('🔄 Importing v0 MCP metrics...')
    
    // Read the JSON file
    const filePath = path.join(process.cwd(), 'data', 'incoming', 'v0_mcp_metrics.json')
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContent)
    
    // Prepare multiple metric records
    const timestamp = `${data.metrics_date}T12:00:00Z`
    const sourceUrl = 'https://vercel.com/blog/ai-sdk-4-2'
    
    const metricsToInsert = [
      // Update innovation score based on research findings
      {
        tool_id: 'v0-vercel',
        metric_key: 'innovation_score',
        value_decimal: data.overall_mcp_assessment.v0_specific_score, // 2.5
        recorded_at: timestamp,
        source: 'research',
        source_url: sourceUrl,
        notes: 'MCP research: While Vercel has solid MCP infrastructure, v0 itself has not announced breakthrough MCP innovations',
        value_json: {
          mcp_assessment: data.overall_mcp_assessment,
          previous_score: 8.0,
          adjustment_reason: 'No v0-specific MCP breakthroughs found, only platform-level support',
          search_limitations: data.search_limitations
        }
      },
      // Store additional MCP data in timeline_event
      {
        tool_id: 'v0-vercel',
        metric_key: 'timeline_event',
        value_json: {
          event_type: 'mcp_assessment',
          date: data.metrics_date,
          title: 'MCP Innovation Assessment',
          description: 'Comprehensive research on v0 MCP capabilities',
          details: {
            vercel_platform_score: data.overall_mcp_assessment.vercel_platform_score,
            v0_specific_score: data.overall_mcp_assessment.v0_specific_score,
            competitive_position: data.overall_mcp_assessment.competitive_position,
            is_leader: false,
            status: 'platform_support_only',
            most_recent_development: '2025-03-26',
            developments: data.mcp_related_developments,
            search_limitations: data.search_limitations
          }
        },
        recorded_at: timestamp,
        source: 'research',
        source_url: sourceUrl,
        notes: 'MCP research findings: v0 has platform support but no tool-specific innovations'
      }
    ]
    
    // Insert all metrics
    const { data: insertedData, error } = await supabase
      .from('metrics_history')
      .insert(metricsToInsert)
      .select()
    
    if (error) {
      console.error('❌ Error inserting metrics:', error)
      throw error
    }
    
    console.log('✅ Successfully imported v0 MCP metrics')
    console.log('📊 Key findings:')
    console.log(`   - Vercel platform MCP score: ${data.overall_mcp_assessment.vercel_platform_score}/10`)
    console.log(`   - v0 specific MCP score: ${data.overall_mcp_assessment.v0_specific_score}/10`)
    console.log(`   - Innovation assessment: ${data.overall_mcp_assessment.innovation_factor}`)
    console.log(`   - Recommendation: ${data.search_limitations.recommendation}`)
    
    console.log('📊 Inserted metrics:')
    console.log(`   - Records created: ${insertedData?.length || 0}`)
    console.log('📉 Updated v0 innovation score from 8.0 to 2.5 based on research')
    
  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  }
}

// Execute
importV0McpMetrics()