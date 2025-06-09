#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

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
const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'AI Power Rankings MCP Server Running' });
});

// Get current rankings
app.post('/rankings', async (req, res) => {
  try {
    const { category, limit = 15 } = req.body;
    
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
        )
      `)
      .eq('period', currentPeriod?.period || '2025-06')
      .order('position', { ascending: true })
      .limit(limit);

    if (category) {
      query = query.eq('tools.category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ rankings: data });
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

// Search tools
app.post('/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

    if (error) throw error;
    res.json({ results: data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

const PORT = process.env.MCP_PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI Power Rankings MCP Server running on port ${PORT}`);
});