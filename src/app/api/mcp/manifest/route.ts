import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;
  
  return NextResponse.json({
    name: "AI Power Rankings",
    description: "Access real-time rankings and metrics for AI coding tools",
    version: "1.0.0",
    protocol_version: "0.1.0",
    capabilities: {
      tools: true,
      resources: true,
      prompts: true
    },
    endpoint: `${baseUrl}/api/mcp/rpc`,
    auth: {
      type: "none"
    },
    instructions: "This MCP server provides access to AI Power Rankings data. Use the tools to query rankings, get tool details, and analyze metrics."
  });
}