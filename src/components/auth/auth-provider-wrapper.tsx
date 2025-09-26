"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

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
 * Wrapper that conditionally provides authentication context.
 * - If auth is disabled or Clerk keys are missing, wraps with NoAuthProvider
 * - If Clerk is available, wraps with ClerkProvider
 * - Handles [lang] dynamic routes for i18n
 */
export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // Start with default locale during SSR
  const [locale, setLocale] = useState("en");
  const [mounted, setMounted] = useState(false);

  // Always call the hook, but only use it when mounted
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Update locale after mounting on client
    if (mounted && pathname) {
      const lang = pathname.split("/")[1] || "en";
      const validLangs = ["en", "ja", "zh", "ko", "es", "fr", "de", "pt", "it", "ru"];
      const detectedLocale = validLangs.includes(lang) ? lang : "en";
      setLocale(detectedLocale);
    }
  }, [mounted, pathname]);

  // If ClerkProvider wasn't loaded (auth disabled or no keys), use NoAuthProvider
  if (!ClerkProvider) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

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
