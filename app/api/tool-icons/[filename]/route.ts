import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * API Route to serve tool logo images
 *
 * This route serves static PNG logos from /public/tool-icons/
 * Bypasses the app/[lang] route conflict issue by serving through API
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Security: Only allow PNG files with safe filenames
    if (!filename.endsWith('.png') || filename.includes('..') || filename.includes('/')) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    // Read the file from public/tool-icons/
    const filePath = path.join(process.cwd(), 'public', 'tool-icons', filename);
    const imageBuffer = await readFile(filePath);

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving tool icon:', error);
    return new NextResponse('Image not found', { status: 404 });
  }
}
