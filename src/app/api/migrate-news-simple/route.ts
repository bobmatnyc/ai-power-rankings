import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { loggers } from "@/lib/logger";
import config from "@payload-config";
import { getPayload } from "payload";

// Map Supabase categories to Payload categories
const categoryMap: Record<string, string> = {
  'funding': 'funding',
  'acquisition': 'acquisition',
  'product-update': 'product-launch',
  'product': 'product-launch',
  'industry': 'general',
  'general': 'general',
};

export async function POST(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get just 10 news items for testing
    const { data: newsItems, error: fetchError } = await supabase
      .from('news_updates')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(10);
    
    if (fetchError) {
      return NextResponse.json({ 
        error: "Failed to fetch news",
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!newsItems || newsItems.length === 0) {
      return NextResponse.json({ message: "No news items found" });
    }
    
    // Initialize Payload
    const payload = await getPayload({ config });
    
    const stats = {
      total: newsItems.length,
      migrated: 0,
      failed: 0,
      skipped: 0,
    };
    
    const results: any[] = [];
    
    for (const newsItem of newsItems) {
      try {
        // Check if already exists by slug
        const existing = await payload.find({
          collection: 'news',
          where: {
            slug: { equals: newsItem.slug || newsItem.id }
          },
          limit: 1,
        });
        
        if (existing.docs.length > 0) {
          stats.skipped++;
          results.push({ 
            id: newsItem.id, 
            status: 'skipped', 
            reason: 'already exists' 
          });
          continue;
        }
        
        // Prepare news data
        const headline = newsItem.title || newsItem.headline || 'Untitled';
        const summary = newsItem.summary || newsItem.description || '';
        
        // For now, skip related_tools mapping to simplify
        const newsData = {
          headline,
          slug: newsItem.slug || newsItem.id,
          summary: summary ? [
            {
              children: [{ text: summary }]
            }
          ] : undefined,
          published_at: newsItem.published_at || newsItem.created_at || new Date().toISOString(),
          source: newsItem.source || 'Unknown',
          source_url: newsItem.url || newsItem.source_url || null,
          author: newsItem.author || null,
          tags: newsItem.tags || [],
          category: categoryMap[newsItem.category] || 'general',
          impact_level: 'medium' as const,
          is_featured: newsItem.is_featured || false,
          image_url: newsItem.image_url || null,
          related_tools: [], // Skip for now
          supabase_news_id: newsItem.id,
        };
        
        const created = await payload.create({
          collection: 'news',
          data: newsData,
        });
        
        stats.migrated++;
        results.push({ 
          id: newsItem.id, 
          status: 'success', 
          payloadId: created.id,
          headline 
        });
        
      } catch (error: any) {
        stats.failed++;
        const errorMsg = error?.errors?.[0]?.message || error?.message || 'Unknown error';
        results.push({ 
          id: newsItem.id, 
          status: 'failed', 
          error: errorMsg 
        });
        loggers.api.error(`Failed to migrate news ${newsItem.id}`, { error: errorMsg });
      }
    }
    
    return NextResponse.json({ 
      message: "Migration test completed",
      stats,
      results
    });
    
  } catch (error) {
    loggers.api.error("Migration error", { error });
    return NextResponse.json({ 
      error: "Migration failed",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}