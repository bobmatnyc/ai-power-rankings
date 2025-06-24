import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ 
        error: "Missing Supabase credentials",
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test connection by fetching a small sample
    const { data, error, count } = await supabase
      .from('news_updates')
      .select('*', { count: 'exact', head: false })
      .limit(3)
      .order('published_at', { ascending: false });
    
    if (error) {
      loggers.api.error("Supabase query error", { error });
      return NextResponse.json({ 
        error: "Supabase query failed",
        details: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      count,
      sample: data?.map(item => ({
        id: item.id,
        title: item.title || item.headline,
        category: item.category,
        related_tools: item.related_tools
      }))
    });
  } catch (error) {
    loggers.api.error("Test Supabase news error", { error });
    return NextResponse.json({ 
      error: "Internal error",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}