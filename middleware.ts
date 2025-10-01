import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(.*)/sign-in(.*)",
  "/(.*)/sign-up(.*)",
  "/api/public(.*)",
  "/api/health(.*)",
  "/(.*)/news(.*)",
  "/(.*)/rankings(.*)",
  "/(.*)/tools(.*)",
  "/(.*)/about(.*)",
  "/(.*)/methodology(.*)",
  "/(.*)/trending(.*)",
  "/(.*)/privacy(.*)",
  "/(.*)/terms(.*)",
  "/(.*)/contact(.*)",
]);

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/(.*)/admin(.*)",
  "/(.*)/dashboard(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware((auth, req: NextRequest) => {
  const { userId } = auth();

  // Check if the route is protected and user is not authenticated
  if (isProtectedRoute(req) && !userId) {
    // Get the locale from the URL
    const pathname = req.nextUrl.pathname;
    const locale = pathname.split("/")[1] || "en";

    // Build the sign-in URL
    const signInUrl = new URL(`/${locale}/sign-in`, req.url);
    signInUrl.searchParams.set("redirect_url", pathname);

    return NextResponse.redirect(signInUrl);
  }

  // For all other routes, continue normally
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};