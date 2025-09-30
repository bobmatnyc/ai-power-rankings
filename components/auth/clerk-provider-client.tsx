"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type React from "react";
import { useEffect, useState } from "react";

interface ClerkProviderClientProps {
  children: React.ReactNode;
}

/**
 * Client-side ClerkProvider wrapper that prevents SSR issues.
 * This component ensures ClerkProvider only renders on the client side,
 * avoiding the useContext error during static generation.
 *
 * CRITICAL: All hooks must be called before any conditional logic
 * to comply with React's Rules of Hooks and prevent Error #310.
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  // CRITICAL: Call ALL hooks first, before ANY conditional returns
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Now calculate all conditions AFTER hooks are called
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  const isAllowedDomain =
    isClient &&
    typeof window !== "undefined" &&
    (window.location.hostname === "aipowerranking.com" ||
      window.location.hostname === "www.aipowerranking.com" ||
      window.location.hostname === "staging.aipowerranking.com");

  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  // Determine whether to render ClerkProvider
  const shouldRenderClerk = isClient && !isAuthDisabled && isAllowedDomain && hasClerkKey;

  // Log the decision (only on client side)
  useEffect(() => {
    if (isClient) {
      if (isAuthDisabled) {
        console.info("ClerkProvider: Disabled via NEXT_PUBLIC_DISABLE_AUTH");
      } else if (!isAllowedDomain) {
        console.info("ClerkProvider: Disabled for non-allowed domain");
      } else if (!hasClerkKey) {
        console.warn("ClerkProvider: No publishable key found");
      }
    }
  }, [isClient, isAuthDisabled, isAllowedDomain, hasClerkKey]);

  // SINGLE RETURN STATEMENT - ensures consistent hook execution
  if (shouldRenderClerk) {
    return (
      <ClerkProvider
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
        appearance={{
          variables: {
            colorPrimary: "#000000",
          },
        }}
      >
        {children}
      </ClerkProvider>
    );
  }

  // biome-ignore lint/complexity/noUselessFragments: Fragment needed for consistent return type
  return <>{children}</>;
}
