#!/usr/bin/env node

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const app = express();
app.use(express.json());

// Generate a secure API key if not provided
const API_KEY = process.env.MCP_API_KEY || crypto.randomBytes(32).toString('hex');
if (!process.env.MCP_API_KEY) {
  console.log(`\n⚠️  No MCP_API_KEY found in environment!`);
  console.log(`Generated temporary API key: ${API_KEY}`);
  console.log(`Add this to your .env.local file: MCP_API_KEY=${API_KEY}\n`);
}

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 write requests per windowMs
  message: 'Too many write requests from this IP, please try again later.'
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Enable CORS for Claude.ai
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Authentication middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.substring(7);
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Reimplement the key MCP server methods as HTTP endpoints

// Health check
app.get('/', (_req, res) => {
  res.json({ 
    status: 'AI Power Rankings Web Gateway',
    version: '1.0.0',
    authentication: 'Bearer token required for write operations',
    endpoints: {
      public: {
        'GET /rankings': 'Get current rankings',
        'GET /tools/:id': 'Get tool details',
        'GET /metrics/:tool_id': 'Get tool metrics',
        'POST /search': 'Search tools',
        'GET /categories': 'Get tool categories'
      },
      protected: {
        'POST /metrics': 'Add a metric (requires auth)',
        'PUT /tools/:id': 'Update tool info (requires auth)',
        'POST /tools': 'Add new tool (requires auth)'
      }
    },
    usage: 'Include header: Authorization: Bearer YOUR_API_KEY'
  });
});

// Get current rankings
app.get('/rankings', async (req, res) => {
  try {
    const { category, limit = 15 } = req.query;
    
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
      .order('position', { ascending: true });

    if (category) {
      query = query.eq('tools.category', category);
    }
    
    query = query.limit(Number(limit));

    const { data, error } = await query;
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

    res.json({ period: currentPeriod?.period, rankings });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get tool details
app.get('/tools/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        companies!inner(*)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get tool metrics
app.get('/metrics/:tool_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('metrics_history')
      .select('*')
      .eq('tool_id', req.params.tool_id)
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

    res.json(latestMetrics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Search tools
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get categories
app.get('/categories', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('category')
      .eq('status', 'active');

    if (error) throw error;

    const categoryCounts = data?.reduce((acc, tool) => {
      acc[tool.category] = (acc[tool.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json(categoryCounts);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Add metric (protected)
app.post('/metrics', writeLimiter, requireAuth, async (req, res) => {
  try {
    const { tool_id, metric_key, value, source, source_url, notes } = req.body;
    
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

    if (error) throw error;
    
    console.log(`[AUDIT] ${new Date().toISOString()} - ADD_METRIC:`, {
      tool_id,
      metric_key,
      value,
      source
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update tool info (protected)
app.put('/tools/:id', writeLimiter, requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    
    console.log(`[AUDIT] ${new Date().toISOString()} - UPDATE_TOOL:`, {
      tool_id: req.params.id,
      updates: req.body
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Add new tool (protected)
app.post('/tools', writeLimiter, requireAuth, async (req, res) => {
  try {
    const { id, name, company_name, category, description, website_url, pricing_model } = req.body;
    
    // First ensure company exists
    let companyId;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', company_name)
      .single();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      const slug = company_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: company_name,
          slug: slug,
          website_url: website_url || `https://${slug}.com`,
          company_size: 'startup',
          company_type: 'private',
          description: `${company_name} - AI coding tools company`
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
        id,
        name,
        slug: id,
        company_id: companyId,
        category,
        subcategory: category,
        description,
        tagline: description.substring(0, 100) + '...',
        website_url: website_url || `https://${id}.com`,
        founded_date: new Date().toISOString().split('T')[0],
        first_tracked_date: new Date().toISOString().split('T')[0],
        pricing_model: pricing_model || 'freemium',
        license_type: 'proprietary',
        status: 'active',
        logo_url: `https://${id}.com/favicon.ico`
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log(`[AUDIT] ${new Date().toISOString()} - ADD_TOOL:`, {
      tool_id: id,
      name,
      company: company_name,
      category
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`AI Power Rankings Web Gateway running on port ${PORT}`);
  console.log(`\n🔐 Authentication: Bearer ${API_KEY}`);
  console.log(`\nTo expose to Claude.ai:`);
  console.log(`1. Run: ngrok http 3002 --domain=1mbot.ngrok.app`);
  console.log(`2. Access via: https://1mbot.ngrok.app`);
  console.log(`\nPublic endpoints (no auth required):`);
  console.log(`- GET  https://1mbot.ngrok.app/`);
  console.log(`- GET  https://1mbot.ngrok.app/rankings`);
  console.log(`- GET  https://1mbot.ngrok.app/tools/:id`);
  console.log(`- GET  https://1mbot.ngrok.app/metrics/:tool_id`);
  console.log(`- POST https://1mbot.ngrok.app/search`);
  console.log(`- GET  https://1mbot.ngrok.app/categories`);
  console.log(`\nProtected endpoints (requires Authorization header):`);
  console.log(`- POST https://1mbot.ngrok.app/metrics`);
  console.log(`- PUT  https://1mbot.ngrok.app/tools/:id`);
  console.log(`- POST https://1mbot.ngrok.app/tools`);
  console.log(`\nExample: Authorization: Bearer ${API_KEY}`);
});