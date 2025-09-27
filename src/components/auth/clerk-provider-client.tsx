"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type React from "react";

interface ClerkProviderClientProps {
  children: React.ReactNode;
}

/**
 * Client-side ClerkProvider wrapper.
 * This component is only imported when auth is enabled.
 * When auth is disabled, clerk-provider-nossr is used instead.
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  // This component is only loaded when auth is enabled
  // If we don't have a key, just pass through children
  if (!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    console.warn("ClerkProvider loaded but no publishable key found");
    return <>{children}</>;
  }

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
