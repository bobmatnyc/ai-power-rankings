"use client";

import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

// Only check configuration on the client side to prevent SSR issues
const getAuthConfig = () => {
  if (typeof window === "undefined") {
    // During SSR, return safe defaults
    return {
      isAuthDisabled: false,
      hasClerkKey: false,
      shouldUseClerk: false,
    };
  }

  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const shouldUseClerk = !isAuthDisabled && hasClerkKey;

  // Log configuration for debugging (only in development)
  if (process.env["NODE_ENV"] === "development") {
    console.log("[AuthProvider] Configuration:", {
      isAuthDisabled,
      hasClerkKey,
      shouldUseClerk,
    });
  }

  return { isAuthDisabled, hasClerkKey, shouldUseClerk };
};

// Lazy load ClerkProvider to prevent SSR initialization
const ClerkProviderLazy = lazy(async () => {
  const { ClerkProvider } = await import("@clerk/nextjs");
  return { default: ClerkProvider };
});

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [authConfig, setAuthConfig] = useState(() => getAuthConfig());

  useEffect(() => {
    setIsMounted(true);
    // Re-check config after mount to ensure we have the latest
    setAuthConfig(getAuthConfig());
  }, []);

  // During SSG/SSR or before hydration, always use NoAuthProvider to avoid router issues
  if (!isMounted || typeof window === "undefined") {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // After hydration, if we should use Clerk, use it
  if (authConfig.shouldUseClerk) {
    try {
      // Extract locale from pathname if available, otherwise default to "en"
      const locale = window.location.pathname.split("/")[1] || "en";

      return (
        <Suspense fallback={<NoAuthProvider>{children}</NoAuthProvider>}>
          <ClerkProviderLazy
            publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
            signInUrl={`/${locale}/sign-in`}
            signUpUrl={`/${locale}/sign-up`}
            afterSignInUrl={`/${locale}`}
            afterSignUpUrl={`/${locale}`}
          >
            {children}
          </ClerkProviderLazy>
        </Suspense>
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
