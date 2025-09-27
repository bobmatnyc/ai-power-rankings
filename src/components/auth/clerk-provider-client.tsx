"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type React from "react";
import { useEffect, useState } from "react";

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
  // Always call hooks at the top level - this is required by React
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if auth is disabled - these are constants so won't cause re-renders
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  // Determine whether to use Clerk based on all conditions
  const shouldUseClerk = !isAuthDisabled && hasClerkKey && mounted;

  // Always render something - either with or without ClerkProvider
  if (!shouldUseClerk) {
    return <>{children}</>;
  }

  // Only wrap with ClerkProvider when all conditions are met
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
