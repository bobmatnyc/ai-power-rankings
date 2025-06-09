import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] || ''
const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || ''
const supabase = createClient(supabaseUrl, supabaseKey)

type Params = {
  params: Promise<{
    slug: string
  }>
}

export async function GET(
  _request: Request,
  { params }: Params
): Promise<NextResponse> {
  try {
    const { slug } = await params

    // Get tool details
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .select('*')
      .eq('id', slug)
      .single()

    if (toolError || !tool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      )
    }

    // Get latest metrics
    const { data: metrics } = await supabase
      .from('metrics_history')
      .select('*')
      .eq('tool_id', slug)
      .order('recorded_at', { ascending: false })

    // Process metrics to get latest values
    const latestMetrics: Record<string, unknown> = {}
    const seenMetrics = new Set<string>()

    if (metrics) {
      for (const metric of metrics) {
        if (!seenMetrics.has(metric.metric_key)) {
          seenMetrics.add(metric.metric_key)
          latestMetrics[metric.metric_key] = 
            metric.value_integer || 
            metric.value_decimal || 
            metric.value_boolean || 
            metric.value_json
        }
      }
    }

    // Get ranking data if available
    // For now, we'll calculate a simplified ranking based on available metrics
    let ranking = null
    if (latestMetrics['agentic_capability'] || latestMetrics['swe_bench_score']) {
      ranking = {
        rank: 0, // This would be calculated from the full rankings
        scores: {
          overall: 0,
          agentic_capability: (latestMetrics['agentic_capability'] as number) || 5,
          innovation: (latestMetrics['innovation_score'] as number) || 5,
          technical_performance: 5,
          developer_adoption: 5,
          market_traction: 5,
          business_sentiment: (latestMetrics['business_sentiment'] as number) || 0.5,
          development_velocity: 5,
          platform_resilience: 5
        }
      }
    }

    return NextResponse.json({
      tool,
      ranking,
      metrics: {
        users: latestMetrics['estimated_users'] as number,
        monthly_arr: latestMetrics['monthly_arr'] as number,
        swe_bench_score: latestMetrics['swe_bench_score'] as number,
        github_stars: latestMetrics['github_stars'] as number,
        valuation: latestMetrics['valuation'] as number,
        funding: latestMetrics['funding'] as number,
        employees: latestMetrics['employee_count'] as number
      }
    })
  } catch (error) {
    console.error('Error in tool detail API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}