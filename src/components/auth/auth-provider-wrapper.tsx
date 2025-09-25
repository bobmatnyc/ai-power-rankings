"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // Handle hydration to avoid SSR/client mismatch
  const [mounted, setMounted] = useState(false);
  const [shouldUseClerk, setShouldUseClerk] = useState(false);
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    setMounted(true);

    // Extract locale from current URL
    if (typeof window !== "undefined") {
      const pathSegments = window.location.pathname.split("/");
      const extractedLocale = pathSegments[1] || "en";
      setLocale(extractedLocale);
    }

    // Only use Clerk after mount and if not explicitly disabled
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    // Use Clerk only if:
    // 1. Auth is not disabled
    // 2. We have a publishable key
    // 3. We're in a browser environment (not during static generation)
    setShouldUseClerk(!isAuthDisabled && hasClerkKey && typeof window !== "undefined");
  }, []);

  // During SSR, static generation, or when conditions aren't met, use NoAuthProvider
  if (!mounted || !shouldUseClerk) {
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // After hydration and when all conditions are met, use ClerkProvider
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
