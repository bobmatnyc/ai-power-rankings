import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get headers
    const headers = Object.fromEntries(request.headers.entries());
    
    // Try to get body in different ways
    let bodyText = "";
    let bodyJson = null;
    let error = null;
    
    try {
      // Clone request to preserve it
      const clonedRequest = request.clone();
      bodyText = await clonedRequest.text();
    } catch (e) {
      error = `text() failed: ${e}`;
    }
    
    try {
      bodyJson = await request.json();
    } catch (e) {
      error = `json() failed: ${e}`;
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        method: request.method,
        url: request.url,
        headers,
        bodyText,
        bodyJson,
        error,
        hasBody: !!request.body,
        bodyReadable: request.body ? (request.body as any).readable : undefined,
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 });
  }
}