import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get('domain');
  const size = searchParams.get('size') || '32';

  if (!domain) {
    return new NextResponse('Domain parameter is required', { status: 400 });
  }

  try {
    // Clean the domain (remove protocol, path, etc.)
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    
    // Try Google's favicon service first
    const googleUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=${size}`;
    
    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Power-Rankings/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch favicon');
    }

    const buffer = await response.arrayBuffer();

    // Return the image with proper caching
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/x-icon',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200', // 24 hours cache, 12 hours stale
      },
    });
  } catch (error) {
    console.error('Error fetching favicon:', error);
    
    // Return a 1x1 transparent PNG as fallback
    const transparentPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    return new NextResponse(transparentPixel, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // 1 hour cache for failures
      },
    });
  }
}