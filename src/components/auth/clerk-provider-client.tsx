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

  // If no Clerk key is available, render without ClerkProvider
  if (!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    console.warn("ClerkProvider: No publishable key found");
    return <>{children}</>;
  }

  // Only render ClerkProvider on the client side with a valid key
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
