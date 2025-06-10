import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime (not Edge)
export const runtime = 'nodejs';

// Redirect to the actual registration endpoint
export async function POST(request: NextRequest) {
  // Forward the request to the actual registration endpoint
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
  const body = await request.text();
  
  const response = await fetch(`${baseUrl}/api/mcp/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: body
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}