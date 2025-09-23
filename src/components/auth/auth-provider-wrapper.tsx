"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // Check if authentication should be disabled
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const pathname = usePathname();

  // Extract locale from pathname (e.g., /en/..., /de/..., etc.)
  const locale = pathname?.split("/")[1] || "en";

  // Log the Clerk key being used
  console.log("Clerk publishable key:", process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]);

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
      signInUrl={`/${locale}/sign-in`}
      signUpUrl={`/${locale}/sign-up`}
      afterSignInUrl={`/${locale}`}
      afterSignUpUrl={`/${locale}`}
    >
      {children}
    </ClerkProvider>
  );
}
