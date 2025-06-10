import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

// Simple MCP endpoint with no authentication
export async function GET() {
  return NextResponse.json({
    name: 'AI Power Rankings',
    version: '1.0.0',
    description: 'Simple MCP endpoint for AI Power Rankings'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple echo response for testing
    return NextResponse.json({
      message: 'Request received',
      received: body
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Invalid request'
    }, { status: 400 });
  }
}