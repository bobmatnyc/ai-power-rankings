import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { tool_id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('metrics_history')
      .select('*')
      .eq('tool_id', params.tool_id)
      .order('recorded_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by metric_key and get latest value
    const latestMetrics: Record<string, any> = {};
    const seen = new Set<string>();
    
    for (const metric of data || []) {
      if (!seen.has(metric.metric_key)) {
        seen.add(metric.metric_key);
        latestMetrics[metric.metric_key] = {
          value: metric.value_integer || metric.value_decimal || metric.value_boolean,
          recorded_at: metric.recorded_at,
          source: metric.source
        };
      }
    }

    return NextResponse.json(latestMetrics);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}