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
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // During SSR and before client hydration, render children without ClerkProvider
  if (!isClient) {
    return <>{children}</>;
  }

  // CRITICAL: Check if auth is disabled first - this takes precedence over everything
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  // If auth is explicitly disabled, NEVER render ClerkProvider
  if (isAuthDisabled) {
    console.info("ClerkProvider: Disabled via NEXT_PUBLIC_DISABLE_AUTH");
    return <>{children}</>;
  }

  // Check if we're on the production domain
  const isProductionDomain =
    typeof window !== "undefined" &&
    (window.location.hostname === "aipowerranking.com" ||
      window.location.hostname === "www.aipowerranking.com");

  // If no Clerk key is available or we're not on production domain, render without ClerkProvider
  if (!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] || !isProductionDomain) {
    if (!isProductionDomain) {
      console.info("ClerkProvider: Disabled for non-production domain");
    } else {
      console.warn("ClerkProvider: No publishable key found");
    }
    return <>{children}</>;
  }

  // Only render ClerkProvider on the client side with a valid key on production domain
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
