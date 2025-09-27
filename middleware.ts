import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Minimal middleware that just passes through all requests
export default function middleware(request: NextRequest) {
  // For now, just pass through all requests without any processing
  // Locale handling can be done client-side
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only match the root path for minimal processing
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
