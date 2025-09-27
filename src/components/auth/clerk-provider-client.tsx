"use client";

import type React from "react";
import { useEffect, useState } from "react";

interface ClerkProviderClientProps {
  children: React.ReactNode;
}

/**
 * Client-only wrapper for ClerkProvider to avoid SSR issues.
 * This component only renders ClerkProvider on the client side
 * to prevent useContext errors during static generation.
 */
export default function ClerkProviderClient({ children }: ClerkProviderClientProps) {
  const [isClient, setIsClient] = useState(false);
  const [ClerkProvider, setClerkProvider] = useState<React.ComponentType<any> | null>(null);

  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  useEffect(() => {
    setIsClient(true);

    // Only load Clerk if auth is enabled and we have a key
    if (!isAuthDisabled && hasClerkKey) {
      import("@clerk/nextjs")
        .then((clerk) => {
          setClerkProvider(() => clerk.ClerkProvider);
        })
        .catch((error) => {
          console.error("Failed to load Clerk:", error);
        });
    }
  }, [isAuthDisabled, hasClerkKey]);

  // If auth is disabled, or during SSR, just render children
  if (isAuthDisabled || !isClient || !hasClerkKey) {
    return <>{children}</>;
  }

  // If Clerk isn't loaded yet, render children without provider
  if (!ClerkProvider) {
    return <>{children}</>;
  }

  // On client with Clerk loaded and auth enabled, wrap with ClerkProvider
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
