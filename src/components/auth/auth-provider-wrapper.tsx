"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // Check if authentication should be disabled - using optional chaining for safety
  const isAuthDisabled =
    typeof window !== "undefined" && process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  // In development mode with NEXT_PUBLIC_DISABLE_AUTH=true, use NoAuthProvider
  if (isAuthDisabled) {
    console.log("🔓 Authentication disabled for development");
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // In production or when auth is enabled, use ClerkProvider
  // The publishable key will be automatically loaded from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  return (
    <ClerkProvider
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
