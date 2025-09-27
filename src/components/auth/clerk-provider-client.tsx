"use client";

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs";
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

  useEffect(() => {
    setIsClient(true);
  }, []);

  // During SSR and initial client render, just render children without ClerkProvider
  if (!isClient || !process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    return <>{children}</>;
  }

  // On client with a valid key, wrap with ClerkProvider
  return (
    <BaseClerkProvider
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      {children}
    </BaseClerkProvider>
  );
}
