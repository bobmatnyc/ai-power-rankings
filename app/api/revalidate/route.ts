/**
 * On-demand Cache Revalidation Endpoint
 * GET /api/revalidate?secret=xxx&path=/
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const path = request.nextUrl.searchParams.get('path') || '/';
  const tag = request.nextUrl.searchParams.get('tag');

  // Verify secret
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  try {
    const results: string[] = [];

    if (tag) {
      revalidateTag(tag);
      results.push(`tag:${tag}`);
    }

    if (path === 'all') {
      // Revalidate all common paths
      const paths = ['/', '/en', '/news', '/whats-new', '/tools', '/rankings'];
      for (const p of paths) {
        revalidatePath(p, 'layout');
        results.push(p);
      }
    } else {
      revalidatePath(path, 'layout');
      results.push(path);
    }

    return NextResponse.json({
      success: true,
      revalidated: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Revalidation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
