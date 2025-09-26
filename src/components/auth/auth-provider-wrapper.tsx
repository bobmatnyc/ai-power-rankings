"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Conditionally import ClerkProvider based on environment
let ClerkProvider: React.ComponentType<{
  children: ReactNode;
  publishableKey?: string;
  signInUrl?: string;
  signUpUrl?: string;
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
}> | null = null;

// Only load Clerk if auth is enabled and we're on the client
if (typeof window !== "undefined") {
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  if (!isAuthDisabled && hasClerkKey) {
    try {
      const clerkModule = require("@clerk/nextjs");
      ClerkProvider = clerkModule.ClerkProvider;
    } catch (error) {
      console.warn("[AuthProviderWrapper] Failed to load Clerk:", error);
    }
  }
}

interface AuthProviderWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper that conditionally provides Clerk authentication.
 * - If auth is disabled or Clerk keys are missing, passes through children
 * - If Clerk is available, wraps with ClerkProvider
 * - Handles [lang] dynamic routes for i18n
 */
export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  const pathname = usePathname();

  // If ClerkProvider wasn't loaded (auth disabled or no keys), just pass through
  if (!ClerkProvider) {
    return <>{children}</>;
  }

  // Extract locale from pathname for i18n support
  const lang = pathname ? pathname.split("/")[1] || "en" : "en";
  const validLangs = ["en", "ja", "zh", "ko", "es", "fr", "de", "pt", "it", "ru"];
  const locale = validLangs.includes(lang) ? lang : "en";

  // Wrap with ClerkProvider using the proper locale
  return (
    <ClerkProvider
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      signInUrl={`/${locale}/sign-in`}
      signUpUrl={`/${locale}/sign-up`}
      afterSignInUrl={`/${locale}`}
      afterSignUpUrl={`/${locale}`}
    >
      {children}
    </ClerkProvider>
  );
}
