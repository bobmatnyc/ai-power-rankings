"use client";

/**
 * Simple Clerk component re-exports for Next.js 15
 *
 * This file provides a clean interface to Clerk components
 * with proper error handling but no overengineering.
 */

// Re-export Clerk components directly
export {
  useAuth,
  useUser,
  useClerk,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  SignIn,
  SignUp
} from "@clerk/nextjs";

// Simple wrapper components for consistent styling
import type React from "react";
import { SignedIn, SignedOut } from "@clerk/nextjs";

export function SignedInWrapper({ children }: { children: React.ReactNode }) {
  return <SignedIn>{children}</SignedIn>;
}

export function SignedOutWrapper({ children }: { children: React.ReactNode }) {
  return <SignedOut>{children}</SignedOut>;
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