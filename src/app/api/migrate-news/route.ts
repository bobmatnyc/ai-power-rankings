import { NextResponse } from "next/server";
import { payloadDirect, getPayloadClient } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
const supabaseAnonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!;

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
    console.log('🚀 Starting news migration...');
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get tool mapping
    const toolsResponse = await payloadDirect.getTools({ limit: 1000 });
    const tools = toolsResponse.docs;
    
    // Create multiple maps for tool lookups
    const toolIdMap = new Map<string, string>();
    const toolSlugMap = new Map<string, string>();
    const toolNameMap = new Map<string, string>();
    
    tools.forEach((tool: any) => {
      const toolId = String(tool.id);
      if (tool['supabase_tool_id']) {
        toolIdMap.set(String(tool['supabase_tool_id']), toolId);
      }
      toolSlugMap.set(String(tool['slug']), toolId);
      
      // Create name variations for matching
      toolNameMap.set(String(tool['name']).toLowerCase(), toolId);
      toolNameMap.set(String(tool['name']).toLowerCase().replace(/\s+/g, '-'), toolId);
      if (tool['display_name']) {
        toolNameMap.set(String(tool['display_name']).toLowerCase(), toolId);
      }
    });
    
    // Fetch news from Supabase
    const { data: newsItems, error: fetchError } = await supabase
      .from('news_updates')
      .select('*')
      .order('published_at', { ascending: false });
    
    if (fetchError) {
      throw new Error(`Failed to fetch news: ${fetchError.message}`);
    }
    
    if (!newsItems || newsItems.length === 0) {
      return NextResponse.json({ message: "No news items found" });
    }
    
    const stats = {
      total: newsItems.length,
      migrated: 0,
      failed: 0,
      skipped: 0,
    };
    
    const errors: any[] = [];
    const payload = await getPayloadClient();
    
    // Process in batches
    const batchSize = 5;
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      loggers.api.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newsItems.length / batchSize)}`);
      
      for (const newsItem of batch) {
        try {
          // Check if already exists
          const existing = await payload.find({
            collection: 'news',
            where: {
              or: [
                { slug: { equals: newsItem.slug || newsItem.id } },
                { supabase_news_id: { equals: newsItem.id } }
              ]
            },
            limit: 1,
          });
          
          if (existing.docs.length > 0) {
            stats.skipped++;
            continue;
          }
          
          // Map related tools
          const relatedTools: string[] = [];
          if (newsItem.related_tools && Array.isArray(newsItem.related_tools)) {
            for (const toolRef of newsItem.related_tools) {
              let payloadToolId = toolIdMap.get(toolRef) || 
                                 toolSlugMap.get(toolRef) || 
                                 toolNameMap.get(toolRef.toLowerCase());
              
              if (!payloadToolId) {
                // Try variations
                const variations = [
                  toolRef.replace(/-/g, ''),
                  toolRef.replace(/-/g, ' '),
                  toolRef.replace(/\s+/g, '-'),
                ];
                for (const variation of variations) {
                  payloadToolId = toolNameMap.get(variation.toLowerCase());
                  if (payloadToolId) {
                    break;
                  }
                }
              }
              
              if (payloadToolId) {
                relatedTools.push(payloadToolId);
              }
            }
          }
          
          // Prepare news data
          const headline = newsItem.title || newsItem.headline || 'Untitled';
          const summary = newsItem.summary || newsItem.description || '';
          
          await payload.create({
            collection: 'news',
            data: {
              headline,
              slug: newsItem.slug || newsItem.id,
              summary: summary ? [
                {
                  children: [{ text: summary }]
                }
              ] : undefined,
              published_at: newsItem.published_at || newsItem.created_at,
              source: newsItem.source || 'Unknown',
              source_url: newsItem.url || newsItem.source_url,
              author: newsItem.author,
              tags: newsItem.tags || [],
              category: categoryMap[newsItem.category] || 'general',
              sentiment_score: newsItem.sentiment_score,
              impact_level: newsItem.importance_score >= 8 ? 'high' : 
                           newsItem.importance_score >= 5 ? 'medium' : 'low',
              is_featured: newsItem.is_featured || false,
              image_url: newsItem.image_url,
              related_tools: relatedTools,
              external_links: newsItem.external_links || [],
              supabase_news_id: newsItem.id,
            },
          });
          
          stats.migrated++;
          loggers.api.info(`Migrated: ${headline}`);
        } catch (error: any) {
          stats.failed++;
          const errorMsg = error?.errors?.[0]?.message || error?.message || 'Unknown error';
          errors.push({ id: newsItem.id, headline: newsItem.title, error: errorMsg });
          loggers.api.error(`Failed to migrate news ${newsItem.id}`, { error: errorMsg });
        }
      }
    }
    
    loggers.api.info('Migration complete', stats);
    
    return NextResponse.json({ 
      message: "News migration completed",
      stats,
      errors: errors.slice(0, 10) // First 10 errors
    });
  } catch (error) {
    loggers.api.error("Error during news migration", { error });
    return NextResponse.json({ error: "Failed to migrate news" }, { status: 500 });
  }
}