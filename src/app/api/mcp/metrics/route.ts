import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_KEY = process.env.MCP_API_KEY!;

// Auth check
function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  return authHeader.substring(7) === API_KEY;
}

export async function POST(request: NextRequest) {
  // Check authentication
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tool_id, metric_key, value, source, source_url, notes } = await request.json();
    
    // Validate required fields
    if (!tool_id || !metric_key || value === undefined || !source) {
      return NextResponse.json(
        { error: 'Missing required fields: tool_id, metric_key, value, source' },
        { status: 400 }
      );
    }

    let value_integer = null;
    let value_decimal = null;
    let value_boolean = null;

    if (typeof value === 'boolean') {
      value_boolean = value;
    } else if (typeof value === 'number') {
      if (metric_key.includes('arr') || metric_key.includes('funding') || 
          metric_key.includes('valuation') || metric_key.includes('users') || 
          metric_key.includes('stars')) {
        value_integer = Math.round(value);
      } else {
        value_decimal = value;
      }
    }

    const { data, error } = await supabase
      .from('metrics_history')
      .insert({
        tool_id,
        metric_key,
        value_integer,
        value_decimal,
        value_boolean,
        recorded_at: new Date().toISOString(),
        source,
        source_url: source_url || '',
        notes: notes || ''
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Audit log
    console.log(`[AUDIT] ${new Date().toISOString()} - ADD_METRIC:`, {
      tool_id,
      metric_key,
      value,
      source
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}