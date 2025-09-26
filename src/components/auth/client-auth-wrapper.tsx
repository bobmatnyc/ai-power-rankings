"use client";

import React, { type ReactNode, useEffect, useState } from "react";
import { AuthErrorBoundary } from "./auth-error-boundary";
import { NoAuthProvider } from "./no-auth-provider";

// Enhanced React validation for Next.js 15 SSR safety
const validateReactForSSR = () => {
  if (typeof window === "undefined") {
    // During SSR, React hooks might not be fully available
    return typeof React !== "undefined" && React !== null;
  }
  // On client side, full React should be available
  return true;
};

interface ClientAuthWrapperProps {
  children: ReactNode;
}

/**
 * Simplified client auth wrapper that prevents SSR issues
 *
 * This component ensures that:
 * 1. During SSR, we always use NoAuthProvider (safe)
 * 2. On client hydration, we check if auth should be enabled
 * 3. Only after mount do we potentially switch to Clerk
 */
export function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  const safeChildren = children ?? null;

  // Early validation for React SSR safety
  if (!validateReactForSSR()) {
    console.warn("[ClientAuthWrapper] React validation failed - using NoAuth fallback");
    return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
  }

  return (
    <AuthErrorBoundary fallback={<NoAuthProvider>{safeChildren}</NoAuthProvider>}>
      <SafeClientAuthContent>{safeChildren}</SafeClientAuthContent>
    </AuthErrorBoundary>
  );
}

/**
 * Internal component that handles the actual auth logic
 * Wrapped by error boundary to prevent useContext errors from propagating
 */
function SafeClientAuthContent({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // biome-ignore lint/suspicious/noExplicitAny: ClerkProvider has complex props
  const [ClerkProvider, setClerkProvider] = useState<React.ComponentType<any> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const safeChildren = children ?? null;

  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  useEffect(() => {
    // Additional React validation during mount
    if (!validateReactForSSR()) {
      setLoadError("React validation failed during mount");
      setMounted(true);
      return;
    }

    setMounted(true);

    // Only attempt to load Clerk if auth is enabled and we have a key
    if (!isAuthDisabled && hasClerkKey && typeof window !== "undefined") {
      import("@clerk/nextjs")
        .then((clerk) => {
          if (clerk?.ClerkProvider) {
            setClerkProvider(() => clerk.ClerkProvider);
            console.info("[ClientAuthWrapper] Clerk loaded successfully");
          } else {
            setLoadError("Clerk module loaded but ClerkProvider not found");
          }
        })
        .catch((error) => {
          console.warn("[ClientAuthWrapper] Clerk load failed:", error);
          setLoadError(`Clerk import failed: ${error.message}`);
        });
    }
  }, [isAuthDisabled, hasClerkKey]);

  // During SSR or if auth is disabled, always use NoAuthProvider
  if (!mounted || isAuthDisabled || !hasClerkKey || loadError) {
    if (loadError) {
      console.warn("[ClientAuthWrapper] Using NoAuthProvider due to error:", loadError);
    }
    return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
  }

  // On client, if Clerk is loaded, use it
  if (ClerkProvider) {
    try {
      return (
        <ClerkProvider
          publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
          afterSignInUrl="/"
          afterSignUpUrl="/"
        >
          {safeChildren}
        </ClerkProvider>
      );
    } catch (error) {
      console.error("[ClientAuthWrapper] ClerkProvider error:", error);
      return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
    }
  }

  // Fallback to NoAuthProvider while Clerk loads or if it fails
  return <NoAuthProvider>{safeChildren}</NoAuthProvider>;
}
