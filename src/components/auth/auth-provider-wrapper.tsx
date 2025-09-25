"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

// Check authentication configuration at module level
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
const shouldUseClerk = !isAuthDisabled && hasClerkKey;

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // If we should use Clerk, always use it (including during SSR)
  if (shouldUseClerk) {
    // Extract locale from pathname if available, otherwise default to "en"
    const locale =
      typeof window !== "undefined" ? window.location.pathname.split("/")[1] || "en" : "en";

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

  // Otherwise, always use NoAuthProvider
  return <NoAuthProvider>{children}</NoAuthProvider>;
}
