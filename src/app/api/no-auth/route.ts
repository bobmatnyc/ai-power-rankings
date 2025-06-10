import { NextResponse } from 'next/server';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

// Ultra-simple endpoint that explicitly requires no authentication
export async function GET() {
  return NextResponse.json({
    name: "AI Power Rankings",
    version: "1.0.0",
    auth: false,
    endpoints: [
      "/api/mcp/rankings",
      "/api/mcp/tools/:id",
      "/api/mcp/search"
    ]
  });
}

export async function POST() {
  return NextResponse.json({
    message: "No authentication required"
  });
}