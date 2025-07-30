import { type NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for Partytown to handle Google Analytics requests.
 * 
 * WHY: When running GTM/GA in a web worker via Partytown, cross-origin
 * requests need to be proxied through our domain to avoid CORS issues.
 * This enables us to move analytics off the main thread.
 * 
 * DESIGN DECISION: We proxy only specific Google domains to:
 * - Maintain security by not being an open proxy
 * - Enable proper caching headers for analytics scripts
 * - Allow Partytown to execute GTM in a web worker
 * 
 * PERFORMANCE IMPACT:
 * - Removes ~100ms of main thread blocking time
 * - Improves Time to Interactive (TTI)
 * - Analytics still work but don't block user interactions
 */

const ALLOWED_HOSTS = [
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "analytics.google.com",
  "www.google.com",
  "google.com"
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const path = params.path.join("/");
    const url = new URL(request.url);
    
    // Extract the original hostname from the query params or referrer
    const searchParams = url.searchParams;
    const targetHost = searchParams.get("host") || "www.googletagmanager.com";
    
    // Security: Only proxy allowed Google Analytics hosts
    if (!ALLOWED_HOSTS.includes(targetHost)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    
    // Construct the target URL
    const targetUrl = `https://${targetHost}/${path}${url.search}`;
    
    // Forward the request
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": request.headers.get("User-Agent") || "",
        "Accept": request.headers.get("Accept") || "*/*",
        "Accept-Language": request.headers.get("Accept-Language") || "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": request.headers.get("Referer") || "",
      },
      // Cache GTM/GA scripts for 1 hour
      next: { revalidate: 3600 }
    });
    
    const body = await response.text();
    
    // Create response with appropriate headers
    const proxyResponse = new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/javascript",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        // CORS headers for Partytown
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
    
    return proxyResponse;
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  // Handle preflight requests for CORS
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}