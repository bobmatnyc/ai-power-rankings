"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

// Import Clerk at module level to maintain context chain
// This is safe because the file is marked as "use client"
let ClerkProvider: React.ComponentType<{
  children: ReactNode;
  publishableKey?: string;
  signInUrl?: string;
  signUpUrl?: string;
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
}> | null = null;
if (typeof window !== "undefined") {
  try {
    const clerkModule = require("@clerk/nextjs");
    ClerkProvider = clerkModule.ClerkProvider;
  } catch (error) {
    console.warn("[AuthProvider] Clerk module not available:", error);
  }
}

interface AuthProviderWrapperProps {
  children: ReactNode;
}

// Check configuration - safe to call anywhere
const getAuthConfig = () => {
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const shouldUseClerk = !isAuthDisabled && hasClerkKey && !!ClerkProvider;

  return { isAuthDisabled, hasClerkKey, shouldUseClerk };
};

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);
  const authConfig = getAuthConfig();

  useEffect(() => {
    setIsMounted(true);

    // Log configuration for debugging (only in development)
    if (process.env["NODE_ENV"] === "development") {
      const config = getAuthConfig();
      console.log("[AuthProvider] Configuration:", {
        ...config,
        clerkLoaded: !!ClerkProvider,
      });
    }
  }, []);

  // During SSR or before mount, use NoAuthProvider to avoid SSR issues
  if (!isMounted) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // After mount, if we should use Clerk and it's available, use it
  if (authConfig.shouldUseClerk && ClerkProvider) {
    try {
      // Extract locale from pathname if available, otherwise default to "en"
      const locale = window.location.pathname.split("/")[1] || "en";

      return (
        <ClerkProvider
          publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
          signInUrl={`/${locale}/sign-in`}
          signUpUrl={`/${locale}/sign-up`}
          afterSignInUrl={`/${locale}`}
          afterSignUpUrl={`/${locale}`}
        >
          {children}
        </ClerkProvider>
      );
    } catch (error) {
      console.error("[AuthProvider] Error initializing Clerk:", error);
      // Fall back to NoAuthProvider if Clerk fails to initialize
      return <NoAuthProvider>{children}</NoAuthProvider>;
    }
  }

  // Otherwise, use NoAuthProvider
  return <NoAuthProvider>{children}</NoAuthProvider>;
}
