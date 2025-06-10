import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_MODE === 'true';
  
  return NextResponse.json({
    status: 'AI Power Rankings MCP API',
    version: '1.0.0',
    authentication: isDevelopment ? 'none (development mode)' : 'OAuth 2.0',
    oauth_discovery: isDevelopment ? null : `${baseUrl}/.well-known/oauth-authorization-server`,
    endpoints: {
      public: {
        'GET /api/mcp/rankings': 'Get current rankings',
        'GET /api/mcp/tools/[id]': 'Get tool details',
        'GET /api/mcp/metrics/[tool_id]': 'Get tool metrics',
        'POST /api/mcp/search': 'Search tools',
        'GET /api/mcp/categories': 'Get tool categories'
      },
      protected: {
        'POST /api/mcp/metrics': 'Add metric (auth required)',
        'PUT /api/mcp/tools/[id]': 'Update tool (auth required)',
        'POST /api/mcp/tools': 'Add new tool (auth required)'
      }
    },
    usage: isDevelopment 
      ? 'No authentication required in development mode'
      : 'OAuth 2.0 authentication required for protected endpoints'
  });
}