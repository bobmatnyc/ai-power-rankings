import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Main middleware that bypasses API routes COMPLETELY
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CRITICAL: Bypass ALL API routes completely
  // API routes handle their own authentication in Node.js runtime
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // For non-API routes, use Clerk middleware
  // We need to call clerkMiddleware and pass it a function
  const clerkHandler = clerkMiddleware(() => {
    return NextResponse.next();
  });

  return clerkHandler(request);
}

export const config = {
  matcher: [
    // Include ALL paths except static files
    "/((?!_next/static|_next/image|assets|data|partytown|favicon.ico|crown.*|robots.txt|sitemap.xml).*)",
  ],
};