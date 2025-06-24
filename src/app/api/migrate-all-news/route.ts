import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { loggers } from "@/lib/logger";
import config from "@payload-config";
import { getPayload } from "payload";

// Map Supabase categories to Payload categories
const categoryMap: Record<string, string> = {
  'funding': 'funding',
  'acquisition': 'acquisition',
  'product-update': 'product',
  'product': 'product',
  'industry': 'industry',
  'general': 'industry',
};

export async function POST(): Promise<NextResponse> {
  try {
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get ALL news items
    const { data: newsItems, error: fetchError } = await supabase
      .from('news_updates')
      .select('*')
      .order('published_at', { ascending: false });
    
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
    
    // Get tool mapping
    const toolsResponse = await payload.find({
      collection: 'tools',
      limit: 1000,
    });
    
    const toolMap = new Map<string, string>();
    toolsResponse.docs.forEach(tool => {
      const toolId = String(tool.id);
      if (tool['supabase_tool_id']) {
        toolMap.set(String(tool['supabase_tool_id']), toolId);
      }
      toolMap.set(String(tool['slug']), toolId);
      toolMap.set(String(tool['name']).toLowerCase(), toolId);
      
      // Add common variations
      const variations = [
        String(tool['name']).toLowerCase().replace(/\s+/g, '-'),
        String(tool['name']).toLowerCase().replace(/-/g, ''),
      ];
      variations.forEach(v => toolMap.set(v, toolId));
    });
    
    loggers.api.info(`Starting migration of ${newsItems.length} news items`);
    
    const stats = {
      total: newsItems.length,
      migrated: 0,
      failed: 0,
      skipped: 0,
    };
    
    const errors: any[] = [];
    const batchSize = 10;
    
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(newsItems.length / batchSize);
      
      loggers.api.info(`Processing batch ${batchNum}/${totalBatches}`);
      
      for (const newsItem of batch) {
        try {
          // Check if already exists by URL
          const existing = await payload.find({
            collection: 'news',
            where: {
              url: { equals: newsItem.url || newsItem.source_url }
            },
            limit: 1,
          });
          
          if (existing.docs.length > 0) {
            stats.skipped++;
            continue;
          }
          
          // Map related tools
          const relatedTools: string[] = [];
          let primaryTool: string | undefined;
          
          if (newsItem.related_tools && Array.isArray(newsItem.related_tools)) {
            for (const toolRef of newsItem.related_tools) {
              const ref = typeof toolRef === 'string' ? toolRef : toolRef.tool_id;
              if (!ref) {
                continue;
              }
              
              const payloadToolId = toolMap.get(ref) || 
                                   toolMap.get(ref.toLowerCase()) ||
                                   toolMap.get(ref.replace(/-/g, ''));
              
              if (payloadToolId) {
                relatedTools.push(payloadToolId);
                if (!primaryTool) {
                  primaryTool = payloadToolId;
                }
              }
            }
          }
          
          // Prepare news data
          const newsData = {
            title: newsItem.title || newsItem.headline || 'Untitled',
            summary: newsItem.summary || newsItem.description || '',
            content: newsItem.content ? [
              {
                children: [{ text: newsItem.content }]
              }
            ] : undefined,
            url: newsItem.url || newsItem.source_url || `https://example.com/news/${newsItem.id}`,
            source: newsItem.source || 'Unknown',
            author: newsItem.author || null,
            published_at: newsItem.published_at || newsItem.created_at || new Date().toISOString(),
            category: categoryMap[newsItem.category] || 'industry',
            importance_score: newsItem.importance_score || 5,
            related_tools: relatedTools,
            primary_tool: primaryTool,
            sentiment: newsItem.sentiment_score || 0,
            key_topics: newsItem.tags || [],
            is_featured: newsItem.is_featured || false,
          };
          
          await payload.create({
            collection: 'news',
            data: newsData,
          });
          
          stats.migrated++;
          
        } catch (error: any) {
          stats.failed++;
          const errorMsg = error?.errors?.[0]?.message || error?.message || 'Unknown error';
          errors.push({ 
            id: newsItem.id, 
            title: newsItem.title,
            error: errorMsg 
          });
        }
      }
    }
    
    loggers.api.info('Migration completed', stats);
    
    return NextResponse.json({ 
      message: "Migration completed",
      stats,
      errors: errors.slice(0, 10) // First 10 errors
    });
    
  } catch (error) {
    loggers.api.error("Migration error", { error });
    return NextResponse.json({ 
      error: "Migration failed",
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}