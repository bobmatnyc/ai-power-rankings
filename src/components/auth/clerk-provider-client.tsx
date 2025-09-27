"use client";

import type React from "react";

interface ClerkProviderClientProps {
  children: React.ReactNode;
}

/**
 * Wrapper that conditionally loads ClerkProvider based on environment.
 * When NEXT_PUBLIC_DISABLE_AUTH is true, this component simply passes through children
 * without loading any Clerk code at all.
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  // Check if auth is disabled - if so, don't load Clerk at all
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  // If auth is disabled, just render children without any Clerk involvement
  if (isAuthDisabled) {
    return <>{children}</>;
  }

  // If no Clerk key is provided, also skip Clerk
  if (!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    return <>{children}</>;
  }

  // Only when auth is enabled AND we have a key, load and use Clerk
  // This prevents any Clerk code from running when auth is disabled
  const { ClerkProvider } = require("@clerk/nextjs");

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
