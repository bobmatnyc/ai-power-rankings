import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Simple pass-through middleware for API routes
function apiMiddleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add CORS headers for API routes
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: response.headers });
  }

  return response;
}

// Clerk middleware for page routes
const pageMiddleware = clerkMiddleware((auth, req) => {
  const pathname = req.nextUrl.pathname;

  // Handle protected routes
  if (pathname.includes("/admin") || pathname.includes("/dashboard")) {
    const { userId } = auth();
    if (!userId && process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  return NextResponse.next();
});

// Main middleware that routes to the appropriate handler
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Use different middleware based on the path
  if (pathname.startsWith("/api")) {
    // For API routes, use simple pass-through middleware
    return apiMiddleware(request);
  } else {
    // For page routes, use Clerk middleware
    return pageMiddleware(request);
  }
}

export const config = {
  matcher: [
    // Include everything except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};