import { NextRequest, NextResponse } from 'next/server';

// Catch-all route to see what Claude.ai is trying to access
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  console.log('Claude.ai tried to access:', path);
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  return NextResponse.json({
    error: 'Not found',
    path: path,
    message: 'This endpoint is not yet implemented'
  }, { status: 404 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  console.log('Claude.ai POST to:', path);
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const body = await request.json();
    console.log('Body:', body);
  } catch {
    console.log('No JSON body');
  }
  
  return NextResponse.json({
    error: 'Not found',
    path: path,
    message: 'This endpoint is not yet implemented'
  }, { status: 404 });
}