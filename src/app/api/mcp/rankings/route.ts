import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '15');

    const { data: currentPeriod } = await supabase
      .from('ranking_periods')
      .select('period')
      .eq('is_current', true)
      .single();

    let query = supabase
      .from('ranking_cache')
      .select(`
        position,
        score,
        tool_id,
        tools!inner(
          id,
          name,
          category,
          status,
          description,
          companies!inner(name)
        ),
        market_traction_score,
        technical_capability_score,
        developer_adoption_score,
        agentic_capability_score,
        innovation_score,
        development_velocity_score,
        platform_resilience_score,
        business_sentiment_score
      `)
      .eq('period', currentPeriod?.period || '2025-06')
      .order('position', { ascending: true })
      .limit(limit);

    if (category) {
      query = query.eq('tools.category', category);
    }

    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rankings = data?.map((item: any) => ({
      rank: item.position,
      tool: {
        id: item.tools.id,
        name: item.tools.name,
        company: item.tools.companies.name,
        category: item.tools.category,
        status: item.tools.status,
        description: item.tools.description
      },
      scores: {
        overall: item.score,
        market_traction: item.market_traction_score,
        technical_capability: item.technical_capability_score,
        developer_adoption: item.developer_adoption_score,
        agentic_capability: item.agentic_capability_score,
        innovation: item.innovation_score,
        development_velocity: item.development_velocity_score,
        platform_resilience: item.platform_resilience_score,
        business_sentiment: item.business_sentiment_score
      }
    }));

    return NextResponse.json({ 
      period: currentPeriod?.period,
      rankings 
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}