"use client";

import dynamic from "next/dynamic";

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Conditionally import components based on auth mode
const AuthComponents = isAuthDisabled
  ? // When auth is disabled, use mock components
    {
      SignedIn: dynamic(() =>
        import("./no-auth-provider").then((mod) => ({ default: mod.SignedIn }))
      ),
      SignedOut: dynamic(() =>
        import("./no-auth-provider").then((mod) => ({ default: mod.SignedOut }))
      ),
      SignInButton: dynamic(() =>
        import("./no-auth-provider").then((mod) => ({ default: mod.SignInButton }))
      ),
      UserButton: dynamic(() =>
        import("./no-auth-provider").then((mod) => ({ default: mod.UserButton }))
      ),
    }
  : // When auth is enabled, use Clerk components
    {
      SignedIn: dynamic(() => import("@clerk/nextjs").then((mod) => ({ default: mod.SignedIn }))),
      SignedOut: dynamic(() => import("@clerk/nextjs").then((mod) => ({ default: mod.SignedOut }))),
      SignInButton: dynamic(() =>
        import("@clerk/nextjs").then((mod) => ({ default: mod.SignInButton }))
      ),
      UserButton: dynamic(() =>
        import("@clerk/nextjs").then((mod) => ({ default: mod.UserButton }))
      ),
    };

export const { SignedIn, SignedOut, SignInButton, UserButton } = AuthComponents;
