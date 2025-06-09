#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
config({ path: path.join(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Simple audit logging for write operations
function logWriteOperation(operation: string, details: any) {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} - ${operation}:`, JSON.stringify(details, null, 2));
}

// Helper function to format currency
function formatCurrency(cents: number): string {
  const millions = cents / 100000000;
  if (millions >= 1000) {
    return `$${(millions / 1000).toFixed(1)}B`;
  }
  return `$${millions.toFixed(1)}M`;
}

class AIRankingsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'ai-power-rankings',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'rankings://current',
          name: 'Current AI Tool Rankings',
          description: 'Real-time rankings of AI coding tools with scores and metrics',
          mimeType: 'application/json'
        },
        {
          uri: 'tools://directory',
          name: 'AI Tools Directory',
          description: 'Complete directory of all AI coding tools in the database',
          mimeType: 'application/json'
        },
        {
          uri: 'metrics://definitions',
          name: 'Metric Definitions',
          description: 'Definitions and descriptions of all ranking metrics',
          mimeType: 'application/json'
        },
        {
          uri: 'categories://list',
          name: 'Tool Categories',
          description: 'List of all tool categories with descriptions',
          mimeType: 'application/json'
        }
      ]
    }));

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      try {
        switch (uri) {
          case 'rankings://current':
            return await this.getCurrentRankingsResource();
          case 'tools://directory':
            return await this.getToolsDirectoryResource();
          case 'metrics://definitions':
            return await this.getMetricsDefinitionsResource();
          case 'categories://list':
            return await this.getCategoriesResource();
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }]
        };
      }
    });

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: 'analyze-rankings',
          description: 'Analyze current AI tool rankings and trends',
          arguments: [
            {
              name: 'category',
              description: 'Optional category filter (e.g., code-editor, autonomous-agent)',
              required: false
            }
          ]
        },
        {
          name: 'compare-tools',
          description: 'Compare multiple AI coding tools',
          arguments: [
            {
              name: 'tools',
              description: 'Comma-separated list of tool IDs to compare',
              required: true
            }
          ]
        },
        {
          name: 'track-metrics',
          description: 'Track and update metrics for an AI tool',
          arguments: [
            {
              name: 'tool_id',
              description: 'Tool ID (e.g., cursor, github-copilot)',
              required: true
            }
          ]
        },
        {
          name: 'add-new-tool',
          description: 'Add a new AI coding tool to the database',
          arguments: [
            {
              name: 'name',
              description: 'Tool name',
              required: true
            },
            {
              name: 'company',
              description: 'Company name',
              required: true
            },
            {
              name: 'category',
              description: 'Tool category',
              required: true
            }
          ]
        }
      ]
    }));

    // Handle prompt requests
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'analyze-rankings':
          return {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: args?.category 
                  ? `Analyze the current rankings for ${args.category} AI coding tools. Show me the top performers, key metrics, and any notable trends.`
                  : 'Analyze the current AI coding tool rankings. Show me the top 10 tools, their key metrics, and identify any notable trends or insights.'
              }
            }]
          };
        
        case 'compare-tools':
          const toolIds = args?.tools?.split(',').map((t: string) => t.trim()) || [];
          return {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Compare these AI coding tools: ${toolIds.join(', ')}. Include their rankings, key metrics (ARR, GitHub stars, SWE-bench scores), strengths, and weaknesses.`
              }
            }]
          };
        
        case 'track-metrics':
          return {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Show me the current metrics for ${args?.tool_id || 'the selected tool'} and help me update any outdated metrics. Check for recent announcements or data that should be added.`
              }
            }]
          };
        
        case 'add-new-tool':
          return {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Add a new AI coding tool to the database:\n- Name: ${args?.name || 'New Tool'}\n- Company: ${args?.company || 'Company'}\n- Category: ${args?.category || 'category'}\n\nGather the necessary information and add it to the database with initial metrics if available.`
              }
            }]
          };
        
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_current_rankings',
          description: 'Get current AI tool rankings with optional filters',
          inputSchema: {
            type: 'object',
            properties: {
              category: { 
                type: 'string',
                description: 'Filter by category (e.g., code-editor, autonomous-agent)'
              },
              limit: { 
                type: 'number',
                description: 'Number of results to return (default: 15)'
              }
            }
          }
        },
        {
          name: 'get_tool_details',
          description: 'Get detailed information about a specific AI coding tool',
          inputSchema: {
            type: 'object',
            properties: {
              tool_id: { 
                type: 'string',
                description: 'Tool ID (e.g., cursor, github-copilot)'
              }
            },
            required: ['tool_id']
          }
        },
        {
          name: 'get_tool_metrics',
          description: 'Get current metrics for a specific tool',
          inputSchema: {
            type: 'object',
            properties: {
              tool_id: { 
                type: 'string',
                description: 'Tool ID'
              }
            },
            required: ['tool_id']
          }
        },
        {
          name: 'search_tools',
          description: 'Search for tools by name or description',
          inputSchema: {
            type: 'object',
            properties: {
              query: { 
                type: 'string',
                description: 'Search query'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_tool_categories',
          description: 'Get all available tool categories with counts',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        // Write access tools
        {
          name: 'add_metric',
          description: 'Add a new metric value for a tool',
          inputSchema: {
            type: 'object',
            properties: {
              tool_id: {
                type: 'string',
                description: 'Tool ID (e.g., cursor, github-copilot)'
              },
              metric_key: {
                type: 'string',
                description: 'Metric key (e.g., monthly_arr, swe_bench_score, github_stars)'
              },
              value: {
                type: ['number', 'boolean', 'object'],
                description: 'Metric value'
              },
              source: {
                type: 'string',
                description: 'Source of the metric (e.g., Company Blog, GitHub API)'
              },
              source_url: {
                type: 'string',
                description: 'URL of the source (optional)'
              },
              notes: {
                type: 'string',
                description: 'Additional notes (optional)'
              }
            },
            required: ['tool_id', 'metric_key', 'value', 'source']
          }
        },
        {
          name: 'update_tool_info',
          description: 'Update tool information (description, status, etc)',
          inputSchema: {
            type: 'object',
            properties: {
              tool_id: {
                type: 'string',
                description: 'Tool ID'
              },
              updates: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  tagline: { type: 'string' },
                  status: { 
                    type: 'string',
                    enum: ['active', 'beta', 'deprecated', 'discontinued', 'acquired']
                  },
                  website_url: { type: 'string' },
                  github_repo: { type: 'string' }
                }
              }
            },
            required: ['tool_id', 'updates']
          }
        },
        {
          name: 'add_tool',
          description: 'Add a new AI coding tool to the database',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique tool ID (lowercase, hyphens for spaces)'
              },
              name: {
                type: 'string',
                description: 'Tool display name'
              },
              company_name: {
                type: 'string',
                description: 'Company name'
              },
              category: {
                type: 'string',
                enum: ['code-editor', 'autonomous-agent', 'ide-assistant', 'app-builder', 'terminal-assistant', 'testing-tool', 'code-review', 'specialized-tool'],
                description: 'Tool category'
              },
              description: {
                type: 'string',
                description: 'Tool description'
              },
              website_url: {
                type: 'string',
                description: 'Tool website URL'
              },
              pricing_model: {
                type: 'string',
                enum: ['free', 'freemium', 'paid', 'enterprise'],
                description: 'Pricing model'
              }
            },
            required: ['id', 'name', 'company_name', 'category', 'description']
          }
        },
        {
          name: 'bulk_add_metrics',
          description: 'Add multiple metrics at once',
          inputSchema: {
            type: 'object',
            properties: {
              metrics: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    tool_id: { type: 'string' },
                    metric_key: { type: 'string' },
                    value: { type: ['number', 'boolean', 'object'] },
                    source: { type: 'string' },
                    source_url: { type: 'string' },
                    notes: { type: 'string' }
                  },
                  required: ['tool_id', 'metric_key', 'value', 'source']
                }
              }
            },
            required: ['metrics']
          }
        },
        {
          name: 'delete_metric',
          description: 'Delete a specific metric entry',
          inputSchema: {
            type: 'object',
            properties: {
              metric_id: {
                type: 'number',
                description: 'Metric ID to delete'
              }
            },
            required: ['metric_id']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_current_rankings':
            return await this.getCurrentRankings(args);
          case 'get_tool_details':
            return await this.getToolDetails(args);
          case 'get_tool_metrics':
            return await this.getToolMetrics(args);
          case 'search_tools':
            return await this.searchTools(args);
          case 'get_tool_categories':
            return await this.getToolCategories();
          // Write access tools
          case 'add_metric':
            return await this.addMetric(args);
          case 'update_tool_info':
            return await this.updateToolInfo(args);
          case 'add_tool':
            return await this.addTool(args);
          case 'bulk_add_metrics':
            return await this.bulkAddMetrics(args);
          case 'delete_metric':
            return await this.deleteMetric(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    });
  }

  private async getCurrentRankings(args: any) {
    // Get current ranking period
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
          description
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
      .order('position', { ascending: true });

    if (args.category) {
      query = query.eq('tools.category', args.category);
    }
    
    if (args.limit) {
      query = query.limit(args.limit);
    } else {
      query = query.limit(15);
    }

    const { data, error } = await query;

    if (error) throw error;

    const formattedData = data?.map((item: any) => ({
      rank: item.position,
      tool: {
        id: item.tools.id,
        name: item.tools.name,
        category: item.tools.category,
        status: item.tools.status
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

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(formattedData, null, 2)
      }]
    };
  }

  private async getToolDetails(args: any) {
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        companies!inner(
          name,
          website_url,
          headquarters,
          founded_year,
          company_size
        )
      `)
      .eq('id', args.tool_id)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Tool not found');

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async getToolMetrics(args: any) {
    // Get latest metrics for a tool
    const { data, error } = await supabase
      .from('metrics_history')
      .select('*')
      .eq('tool_id', args.tool_id)
      .order('recorded_at', { ascending: false });

    if (error) throw error;

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

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(latestMetrics, null, 2)
      }]
    };
  }

  private async searchTools(args: any) {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .or(`name.ilike.%${args.query}%,description.ilike.%${args.query}%`);

    if (error) throw error;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }]
    };
  }

  private async getToolCategories() {
    const { data, error } = await supabase
      .from('tools')
      .select('category')
      .eq('status', 'active');

    if (error) throw error;

    const categoryCounts = data?.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(categoryCounts, null, 2)
      }]
    };
  }

  private async addMetric(args: any) {
    // Determine which value field to use based on the metric type
    let value_integer = null;
    let value_decimal = null; 
    let value_boolean = null;
    let value_json = null;

    const metricKey = args.metric_key;
    const value = args.value;

    if (typeof value === 'boolean') {
      value_boolean = value;
    } else if (typeof value === 'object') {
      value_json = value;
    } else if (typeof value === 'number') {
      // Determine if it's a currency/count (integer) or percentage/score (decimal)
      if (metricKey.includes('arr') || metricKey.includes('funding') || 
          metricKey.includes('valuation') || metricKey.includes('users') || 
          metricKey.includes('stars') || metricKey.includes('employees')) {
        value_integer = Math.round(value);
      } else {
        value_decimal = value;
      }
    }

    const { data, error } = await supabase
      .from('metrics_history')
      .insert({
        tool_id: args.tool_id,
        metric_key: args.metric_key,
        value_integer,
        value_decimal,
        value_boolean,
        value_json,
        recorded_at: new Date().toISOString(),
        source: args.source,
        source_url: args.source_url || '',
        notes: args.notes || ''
      })
      .select()
      .single();

    if (error) throw error;

    logWriteOperation('ADD_METRIC', {
      tool_id: args.tool_id,
      metric_key: args.metric_key,
      value: value,
      source: args.source
    });

    return {
      content: [{
        type: 'text',
        text: `Successfully added metric: ${args.metric_key} = ${value} for ${args.tool_id}`
      }]
    };
  }

  private async updateToolInfo(args: any) {
    const { data, error } = await supabase
      .from('tools')
      .update(args.updates)
      .eq('id', args.tool_id)
      .select()
      .single();

    if (error) throw error;

    logWriteOperation('UPDATE_TOOL', {
      tool_id: args.tool_id,
      updates: args.updates
    });

    return {
      content: [{
        type: 'text',
        text: `Successfully updated tool: ${args.tool_id}\nUpdated fields: ${Object.keys(args.updates).join(', ')}`
      }]
    };
  }

  private async addTool(args: any) {
    // First, ensure the company exists
    let companyId;
    
    // Check if company exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', args.company_name)
      .single();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      // Create the company
      const slug = args.company_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: args.company_name,
          slug: slug,
          website_url: args.website_url || `https://${slug}.com`,
          company_size: 'startup',
          company_type: 'private',
          description: `${args.company_name} - AI coding tools company`
        })
        .select('id')
        .single();

      if (companyError) throw companyError;
      companyId = newCompany.id;
    }

    // Add the tool
    const { data, error } = await supabase
      .from('tools')
      .insert({
        id: args.id,
        name: args.name,
        slug: args.id,
        company_id: companyId,
        category: args.category,
        subcategory: args.category,
        description: args.description,
        tagline: args.description.substring(0, 100) + '...',
        website_url: args.website_url || `https://${args.id}.com`,
        github_repo: args.github_repo || null,
        founded_date: new Date().toISOString().split('T')[0],
        first_tracked_date: new Date().toISOString().split('T')[0],
        pricing_model: args.pricing_model || 'freemium',
        license_type: 'proprietary',
        status: 'active',
        logo_url: `https://${args.id}.com/favicon.ico`
      })
      .select()
      .single();

    if (error) throw error;

    logWriteOperation('ADD_TOOL', {
      tool_id: args.id,
      name: args.name,
      company: args.company_name,
      category: args.category
    });

    return {
      content: [{
        type: 'text',
        text: `Successfully added new tool: ${args.name} (${args.id})\nCompany: ${args.company_name}\nCategory: ${args.category}`
      }]
    };
  }

  private async bulkAddMetrics(args: any) {
    const metricsToInsert = args.metrics.map((metric: any) => {
      let value_integer = null;
      let value_decimal = null;
      let value_boolean = null;
      let value_json = null;

      if (typeof metric.value === 'boolean') {
        value_boolean = metric.value;
      } else if (typeof metric.value === 'object') {
        value_json = metric.value;
      } else if (typeof metric.value === 'number') {
        if (metric.metric_key.includes('arr') || metric.metric_key.includes('funding') || 
            metric.metric_key.includes('valuation') || metric.metric_key.includes('users') || 
            metric.metric_key.includes('stars')) {
          value_integer = Math.round(metric.value);
        } else {
          value_decimal = metric.value;
        }
      }

      return {
        tool_id: metric.tool_id,
        metric_key: metric.metric_key,
        value_integer,
        value_decimal,
        value_boolean,
        value_json,
        recorded_at: new Date().toISOString(),
        source: metric.source,
        source_url: metric.source_url || '',
        notes: metric.notes || ''
      };
    });

    const { data, error } = await supabase
      .from('metrics_history')
      .insert(metricsToInsert)
      .select();

    if (error) throw error;

    logWriteOperation('BULK_ADD_METRICS', {
      count: data.length,
      metrics: data.map((m: any) => ({
        tool_id: m.tool_id,
        metric_key: m.metric_key,
        source: m.source
      }))
    });

    return {
      content: [{
        type: 'text',
        text: `Successfully added ${data.length} metrics:\n${data.map((m: any) => `- ${m.tool_id}: ${m.metric_key}`).join('\n')}`
      }]
    };
  }

  private async deleteMetric(args: any) {
    const { data, error } = await supabase
      .from('metrics_history')
      .delete()
      .eq('id', args.metric_id)
      .select()
      .single();

    if (error) throw error;

    logWriteOperation('DELETE_METRIC', {
      metric_id: args.metric_id,
      tool_id: data.tool_id,
      metric_key: data.metric_key
    });

    return {
      content: [{
        type: 'text',
        text: `Successfully deleted metric: ${data.metric_key} for ${data.tool_id}`
      }]
    };
  }

  // Resource handler methods
  private async getCurrentRankingsResource() {
    const { data: currentPeriod } = await supabase
      .from('ranking_periods')
      .select('period')
      .eq('is_current', true)
      .single();

    const { data, error } = await supabase
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
      .limit(25);

    if (error) throw error;

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

    return {
      contents: [{
        uri: 'rankings://current',
        mimeType: 'application/json',
        text: JSON.stringify({
          period: currentPeriod?.period || '2025-06',
          updated_at: new Date().toISOString(),
          rankings
        }, null, 2)
      }]
    };
  }

  private async getToolsDirectoryResource() {
    const { data, error } = await supabase
      .from('tools')
      .select(`
        id,
        name,
        slug,
        category,
        subcategory,
        description,
        tagline,
        status,
        pricing_model,
        license_type,
        website_url,
        github_repo,
        companies!inner(name, website_url)
      `)
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    const categorized = data?.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push({
        id: tool.id,
        name: tool.name,
        company: (tool.companies as any).name,
        description: tool.description || tool.tagline,
        pricing: tool.pricing_model,
        license: tool.license_type,
        website: tool.website_url,
        github: tool.github_repo
      });
      return acc;
    }, {} as Record<string, any[]>);

    return {
      contents: [{
        uri: 'tools://directory',
        mimeType: 'application/json',
        text: JSON.stringify({
          total_tools: data?.length || 0,
          categories: categorized
        }, null, 2)
      }]
    };
  }

  private async getMetricsDefinitionsResource() {
    const definitions = {
      market_traction: {
        name: "Market Traction",
        description: "Measures market success through revenue (ARR), funding, and business metrics",
        weight: 0.25,
        components: [
          { key: "monthly_arr", description: "Monthly recurring revenue in cents" },
          { key: "total_funding", description: "Total funding raised in cents" },
          { key: "valuation", description: "Company valuation in cents" }
        ]
      },
      technical_capability: {
        name: "Technical Capability",
        description: "Evaluates technical performance and capabilities",
        weight: 0.20,
        components: [
          { key: "swe_bench_score", description: "SWE-bench benchmark score (0-100)" },
          { key: "human_eval_score", description: "HumanEval benchmark score (0-100)" },
          { key: "mbpp_score", description: "MBPP benchmark score (0-100)" }
        ]
      },
      developer_adoption: {
        name: "Developer Adoption",
        description: "Tracks developer usage and community engagement",
        weight: 0.20,
        components: [
          { key: "github_stars", description: "GitHub repository stars" },
          { key: "weekly_downloads", description: "Weekly download count" },
          { key: "active_users", description: "Number of active users" }
        ]
      },
      agentic_capability: {
        name: "Agentic Capability",
        description: "Measures autonomous coding and AI capabilities",
        weight: 0.15,
        components: [
          { key: "has_web_browsing", description: "Can browse the web" },
          { key: "has_code_execution", description: "Can execute code" },
          { key: "multi_file_editing", description: "Can edit multiple files" },
          { key: "autonomous_coding", description: "Level of autonomous coding (0-10)" }
        ]
      },
      innovation: {
        name: "Innovation",
        description: "Evaluates unique features and innovation",
        weight: 0.10,
        components: [
          { key: "unique_features", description: "Count of unique/innovative features" },
          { key: "research_papers", description: "Published research papers" },
          { key: "patent_count", description: "Number of patents" }
        ]
      },
      development_velocity: {
        name: "Development Velocity",
        description: "Tracks update frequency and development speed",
        weight: 0.05,
        components: [
          { key: "update_frequency", description: "Updates per month" },
          { key: "commit_frequency", description: "Commits per week" },
          { key: "release_frequency", description: "Releases per month" }
        ]
      },
      platform_resilience: {
        name: "Platform Resilience",
        description: "Assesses platform stability and reliability",
        weight: 0.03,
        components: [
          { key: "uptime_percentage", description: "Service uptime %" },
          { key: "response_time", description: "Average response time (ms)" },
          { key: "error_rate", description: "Error rate %" }
        ]
      },
      business_sentiment: {
        name: "Business Sentiment",
        description: "Analyzes market perception and user satisfaction",
        weight: 0.02,
        components: [
          { key: "user_satisfaction", description: "User satisfaction score (0-10)" },
          { key: "nps_score", description: "Net Promoter Score (-100 to 100)" },
          { key: "media_sentiment", description: "Media sentiment score (-1 to 1)" }
        ]
      }
    };

    return {
      contents: [{
        uri: 'metrics://definitions',
        mimeType: 'application/json',
        text: JSON.stringify(definitions, null, 2)
      }]
    };
  }

  private async getCategoriesResource() {
    const categories = {
      "code-editor": {
        name: "AI-Powered Code Editors",
        description: "Full-featured code editors with integrated AI assistance",
        examples: ["Cursor", "Windsurf", "Zed"]
      },
      "autonomous-agent": {
        name: "Autonomous Coding Agents",
        description: "AI agents that can independently write and modify code",
        examples: ["Devin", "Cosine Genie", "OpenHands"]
      },
      "ide-assistant": {
        name: "IDE AI Assistants",
        description: "AI assistants that integrate into existing IDEs",
        examples: ["GitHub Copilot", "Amazon Q Developer", "Supermaven"]
      },
      "app-builder": {
        name: "AI App Builders",
        description: "Tools for building applications with AI assistance",
        examples: ["v0", "bolt.new", "Replit Agent"]
      },
      "terminal-assistant": {
        name: "Terminal AI Assistants",
        description: "AI assistants for command-line interfaces",
        examples: ["Warp AI", "Continue", "Aider"]
      },
      "testing-tool": {
        name: "AI Testing Tools",
        description: "AI-powered testing and quality assurance tools",
        examples: ["Codium AI", "Testim", "Mabl"]
      },
      "code-review": {
        name: "AI Code Review Tools",
        description: "Tools for automated code review and analysis",
        examples: ["CodeRabbit", "DeepSource", "Codacy"]
      },
      "specialized-tool": {
        name: "Specialized AI Tools",
        description: "AI tools for specific programming tasks or domains",
        examples: ["Tabnine", "Kite", "IntelliCode"]
      }
    };

    const { data, error } = await supabase
      .from('tools')
      .select('category')
      .eq('status', 'active');

    if (error) throw error;

    const counts = data?.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const enrichedCategories = Object.entries(categories).map(([key, info]) => ({
      id: key,
      ...info,
      tool_count: counts?.[key] || 0
    }));

    return {
      contents: [{
        uri: 'categories://list',
        mimeType: 'application/json',
        text: JSON.stringify({
          categories: enrichedCategories,
          total_categories: enrichedCategories.length
        }, null, 2)
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Power Rankings MCP server running with read/write access');
  }
}

// Start the server
const server = new AIRankingsServer();
server.run().catch(console.error);