import express from 'express';
import next from 'next';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

// Load environment variables
config({ path: '.env.local' });

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_KEY = process.env.MCP_API_KEY || crypto.randomBytes(32).toString('hex');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many write requests from this IP'
});

app.prepare().then(() => {
  const server = express();
  server.use(express.json());

  // Apply rate limiting to API routes
  server.use('/api/mcp', apiLimiter);

  // Auth middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  // API endpoints under /api/mcp
  server.get('/api/mcp', (_req, res) => {
    res.json({ 
      status: 'AI Power Rankings API',
      version: '1.0.0',
      endpoints: {
        public: {
          'GET /api/mcp/rankings': 'Get current rankings',
          'GET /api/mcp/tools/:id': 'Get tool details',
          'POST /api/mcp/search': 'Search tools'
        },
        protected: {
          'POST /api/mcp/metrics': 'Add metric (auth required)',
          'PUT /api/mcp/tools/:id': 'Update tool (auth required)'
        }
      }
    });
  });

  // Rankings endpoint
  server.get('/api/mcp/rankings', async (req, res) => {
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
          )
        `)
        .eq('period', currentPeriod?.period || '2025-06')
        .order('position', { ascending: true })
        .limit(Number(limit));

      if (category) {
        query = query.eq('tools.category', category);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json({ 
        period: currentPeriod?.period,
        rankings: data 
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Tool details endpoint
  server.get('/api/mcp/tools/:id', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('tools')
        .select('*, companies!inner(*)')
        .eq('id', req.params.id)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Search endpoint
  server.post('/api/mcp/search', async (req, res) => {
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

  // Add metric (protected)
  server.post('/api/mcp/metrics', writeLimiter, requireAuth, async (req, res) => {
    try {
      const { tool_id, metric_key, value, source } = req.body;
      
      let value_integer = null;
      let value_decimal = null;
      
      if (typeof value === 'number') {
        if (metric_key.includes('arr') || metric_key.includes('funding')) {
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
          recorded_at: new Date().toISOString(),
          source
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

  // Handle all other routes with Next.js
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
    console.log(`> API available at http://localhost:${PORT}/api/mcp`);
    if (!process.env.MCP_API_KEY) {
      console.log(`> Generated API key: ${API_KEY}`);
      console.log(`> Add to .env.local: MCP_API_KEY=${API_KEY}`);
    }
  });
});