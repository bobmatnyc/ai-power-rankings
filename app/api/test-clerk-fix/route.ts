import { NextResponse } from "next/server";

export async function GET() {
  // Check if window.Clerk is available (this won't be in server-side)
  const testResults = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    clerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    message: "Test endpoint for Clerk fix verification",
    instructions: [
      "1. Open browser console",
      "2. Navigate to the app",
      "3. Check for ClerkRuntimeError",
      "4. If no error appears, the fix is working",
      "5. Try signing in and out to test both states"
    ],
    expectedBehavior: {
      signedOut: "SignInButton should be visible and clickable",
      signedIn: "SignInButton should be hidden, no modal errors"
    }
  };

  return NextResponse.json(testResults);
}