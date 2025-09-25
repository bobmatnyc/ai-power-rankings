"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

// Check authentication configuration at module level with safe fallbacks
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
const shouldUseClerk = !isAuthDisabled && hasClerkKey;

// Log configuration for debugging (only in development)
if (typeof window !== "undefined" && process.env["NODE_ENV"] === "development") {
  console.log("[AuthProvider] Configuration:", {
    isAuthDisabled,
    hasClerkKey,
    shouldUseClerk,
  });
}

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // During SSG/SSR or before hydration, always use NoAuthProvider to avoid router issues
  if (!isMounted || typeof window === "undefined") {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // After hydration, if we should use Clerk, use it
  if (shouldUseClerk) {
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
