import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;
  
  return NextResponse.json({
    mcp_version: '0.1.0',
    transport: 'http',
    endpoint: `${baseUrl}/api/mcp/rpc`,
    auth: {
      type: 'none'
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true
    }
  });
}