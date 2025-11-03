"use client";

/**
 * Safe Clerk component re-exports for Next.js 15
 *
 * This file provides a clean interface to Clerk components
 * by re-exporting from our safe wrapper components that handle
 * missing context gracefully.
 */

// Re-export safe wrapped hooks and components from auth-components
export {
  SignedIn,
  SignedOut,
  SignIn,
  SignInButton,
  SignUp,
  SignUpButton,
  UserButton,
  useAuth,
  useClerk,
  useUser,
} from "./auth-components";

// Simple wrapper components for consistent styling
import type React from "react";
import { SignedIn as SafeSignedIn, SignedOut as SafeSignedOut } from "./auth-components";

export function SignedInWrapper({ children }: { children: React.ReactNode }) {
  // Import SignedIn from our safe wrapper
  return <SafeSignedIn>{children}</SafeSignedIn>;
}

export function SignedOutWrapper({ children }: { children: React.ReactNode }) {
  // Import SignedOut from our safe wrapper
  return <SafeSignedOut>{children}</SafeSignedOut>;
}

// Development mode helper (only used when auth is disabled)
export function AuthDevHelper() {
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

  if (!isAuthDisabled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 rounded p-2 text-xs text-yellow-800 z-50">
      Auth disabled in development
    </div>
  );
}
