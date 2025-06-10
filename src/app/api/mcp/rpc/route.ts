import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function handlePromptGet(params: any, id: any) {
  const { name, arguments: args } = params;
  
  try {
    switch (name) {
      case 'analyze_rankings':
        const focusArea = args?.focus_area || 'overall performance and trends';
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            description: `Analyze the current AI tool rankings focusing on ${focusArea}`,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please analyze the current AI coding tool rankings, focusing specifically on ${focusArea}. Use the get_rankings tool to fetch the latest data, then provide insights about:
1. Top performers and why they're leading
2. Notable changes or trends
3. Key factors driving the rankings
4. Specific insights related to ${focusArea}`
                }
              }
            ]
          }
        });
        
      case 'compare_tools':
        if (!args?.tools) {
          throw new Error('tools parameter is required');
        }
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            description: `Compare AI coding tools: ${args.tools}`,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please compare the following AI coding tools: ${args.tools}. Use the get_rankings and get_tool_details tools to gather data, then provide:
1. Current rankings and scores for each tool
2. Strengths and weaknesses of each
3. Key differentiators
4. Recommendations for different use cases`
                }
              }
            ]
          }
        });
        
      case 'category_analysis':
        if (!args?.category) {
          throw new Error('category parameter is required');
        }
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            description: `Analyze ${args.category} category`,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `Please analyze the ${args.category} category in AI coding tools. Use get_rankings with category filter to get relevant data, then provide:
1. Overview of the category landscape
2. Top performers and their characteristics
3. Emerging trends in this category
4. Gaps and opportunities in the market`
                }
              }
            ]
          }
        });
        
      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: 'Unknown prompt',
            data: { prompt: name }
          }
        });
    }
  } catch (error) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

async function handleToolCall(params: any, id: any) {
  const { name, arguments: args } = params;
  
  try {
    switch (name) {
      case 'get_rankings':
        const { data: currentPeriod } = await supabase
          .from('ranking_periods')
          .select('period')
          .eq('is_current', true)
          .single();

        let query = supabase
          .from('rankings')
          .select(`
            rank,
            overall_score,
            tool_id,
            tools!inner(
              id,
              name,
              category,
              status,
              description,
              companies!inner(name)
            )
          `)
          .eq('period', currentPeriod?.period || '2025-06')
          .order('rank', { ascending: true })
          .limit(args?.limit || 15);

        if (args?.category) {
          query = query.eq('tools.category', args.category);
        }

        const { data, error } = await query;
        
        if (error) throw error;

        const rankings = data?.map((item: any) => ({
          rank: item.rank,
          tool: {
            id: item.tools.id,
            name: item.tools.name,
            company: item.tools.companies.name,
            category: item.tools.category,
            description: item.tools.description
          },
          score: item.overall_score
        }));

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ period: currentPeriod?.period, rankings }, null, 2)
              }
            ]
          }
        });

      case 'get_tool_details':
        if (!args?.tool_id) {
          throw new Error('tool_id is required');
        }

        const { data: tool, error: toolError } = await supabase
          .from('tools')
          .select(`
            *,
            companies!inner(*)
          `)
          .eq('id', args.tool_id)
          .single();

        if (toolError) throw toolError;

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tool, null, 2)
              }
            ]
          }
        });

      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: 'Unknown tool',
            data: { tool: name }
          }
        });
    }
  } catch (error) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

// MCP JSON-RPC endpoint
export async function POST(request: NextRequest) {
  try {
    // Log headers to debug
    const authHeader = request.headers.get('authorization');
    console.log('[MCP RPC] Auth header:', authHeader);
    console.log('[MCP RPC] Request URL:', request.url);
    
    const body = await request.json();
    console.log('[MCP RPC] Request body:', JSON.stringify(body, null, 2));
    
    const { method, params, id } = body;
    
    // Handle protocol initialization
    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '0.1.0',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: 'AI Power Rankings MCP Server',
            version: '1.0.0'
          }
        }
      });
    }
    
    // Handle different MCP methods
    switch (method) {
      case 'tools/list':
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'get_rankings',
                description: 'Get current AI tool rankings',
                inputSchema: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', description: 'Filter by category' },
                    limit: { type: 'number', description: 'Number of results', default: 15 }
                  }
                }
              },
              {
                name: 'get_tool_details',
                description: 'Get details about a specific tool',
                inputSchema: {
                  type: 'object',
                  properties: {
                    tool_id: { type: 'string', description: 'Tool ID', required: true }
                  }
                }
              }
            ]
          }
        });
        
      case 'resources/list':
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: 'rankings://current',
                name: 'Current AI Tool Rankings',
                description: 'Real-time rankings of AI coding tools',
                mimeType: 'application/json'
              }
            ]
          }
        });
        
      case 'prompts/list':
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            prompts: [
              {
                name: 'analyze_rankings',
                description: 'Analyze and explain the current AI tool rankings',
                arguments: [
                  {
                    name: 'focus_area',
                    description: 'Specific aspect to focus on (e.g., "market trends", "technical capabilities", "new entrants")',
                    required: false
                  }
                ]
              },
              {
                name: 'compare_tools',
                description: 'Compare two or more AI coding tools',
                arguments: [
                  {
                    name: 'tools',
                    description: 'Comma-separated list of tool names to compare',
                    required: true
                  }
                ]
              },
              {
                name: 'category_analysis',
                description: 'Analyze tools within a specific category',
                arguments: [
                  {
                    name: 'category',
                    description: 'Category to analyze (e.g., "code-assistant", "ai-editor", "code-review")',
                    required: true
                  }
                ]
              }
            ]
          }
        });
        
      case 'tools/call':
        return handleToolCall(params, id);
        
      case 'prompts/get':
        return handlePromptGet(params, id);
        
      case 'ping':
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            status: 'pong',
            timestamp: new Date().toISOString()
          }
        });
        
      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: { method }
          }
        });
    }
  } catch (error) {
    console.error('MCP RPC error:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
        data: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}