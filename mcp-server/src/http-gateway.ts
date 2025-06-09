#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (_req, res) => {
  res.json({ 
    status: 'AI Power Rankings MCP HTTP Gateway',
    mcp_server: 'stdio-based',
    endpoints: ['/mcp']
  });
});

// MCP request handler
app.post('/mcp', async (req, res) => {
  try {
    const { method, params } = req.body;
    
    // Spawn the MCP server
    const mcpServer = spawn('node', [path.join(__dirname, 'index.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let response = '';
    let error = '';

    mcpServer.stdout.on('data', (data) => {
      response += data.toString();
    });

    mcpServer.stderr.on('data', (data) => {
      error += data.toString();
    });

    mcpServer.on('close', (code) => {
      if (code !== 0) {
        res.status(500).json({ error: error || 'MCP server error' });
      } else {
        try {
          const jsonResponse = JSON.parse(response);
          res.json(jsonResponse);
        } catch (e) {
          res.json({ response });
        }
      }
    });

    // Send the request to the MCP server
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };
    
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
    mcpServer.stdin.end();

  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MCP HTTP Gateway running on port ${PORT}`);
  console.log(`Access via: https://1mbot.ngrok.app (when ngrok is running)`);
});