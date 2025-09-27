"use client";

import type React from "react";

interface ClerkProviderClientProps {
  children: React.ReactNode;
}

/**
 * Client-only wrapper for ClerkProvider to avoid SSR issues.
 * This component only renders ClerkProvider on the client side
 * to prevent useContext errors during static generation.
 *
 * When auth is disabled via NEXT_PUBLIC_DISABLE_AUTH, this component
 * simply renders children without loading Clerk at all.
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  // Check if auth is disabled at build time
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  // If auth is disabled or no key, don't load Clerk at all
  if (isAuthDisabled || !hasClerkKey) {
    return <>{children}</>;
  }

  // Dynamically import and use Clerk only when auth is enabled
  // This import is cached by Next.js and won't cause issues
  // We use require here to avoid async import issues
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
