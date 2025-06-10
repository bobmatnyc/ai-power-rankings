import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('Token endpoint called');
    
    // Parse the request body
    const contentType = request.headers.get('content-type');
    let body: any = {};
    
    if (contentType?.includes('application/json')) {
      body = await request.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      body = Object.fromEntries(new URLSearchParams(text));
    }
    
    console.log('Token request body:', body);
    
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_MODE === 'true';
    
    if (isDevelopment) {
      const host = request.headers.get('host');
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const baseUrl = `${protocol}://${host}`;
      
      // In dev mode, return a dummy token with MCP info
      return NextResponse.json({
        access_token: 'dev-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'mcp:read mcp:write',
        mcp: {
          version: '0.1.0',
          endpoint: `${baseUrl}/api/mcp/rpc`,
          transport: 'http',
          config_url: `${baseUrl}/api/mcp/config`
        }
      });
    }
    
    return NextResponse.json({ 
      error: 'unauthorized_client',
      error_description: 'OAuth not configured in production'
    }, { status: 401 });
  } catch (error) {
    console.error('Token endpoint error:', error);
    return NextResponse.json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}