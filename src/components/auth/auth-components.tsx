"use client";

import type React from "react";
import { useEffect, useState } from "react";
// Import mock components that are always safe
import {
  SignedIn as MockSignedIn,
  SignedOut as MockSignedOut,
  SignInButton as MockSignInButton,
  useAuth as MockUseAuth,
  UserButton as MockUserButton,
} from "./no-auth-provider";
import { UserButtonWithAdmin } from "./user-button-with-admin";

// Initialize Clerk components at module level to preserve context
type ClerkComponent = React.ComponentType<{ children?: React.ReactNode; [key: string]: unknown }>;
type ClerkHook = () => Record<string, unknown>;

// Store clerk components in a ref to prevent re-loading
const clerkComponentsCache: {
  SignedIn: ClerkComponent | null;
  SignedOut: ClerkComponent | null;
  SignInButton: ClerkComponent | null;
  SignUpButton: ClerkComponent | null;
  useAuth: ClerkHook | null;
  UserButton: ClerkComponent | null;
  loaded: boolean;
  error: Error | null;
} = {
  SignedIn: null,
  SignedOut: null,
  SignInButton: null,
  SignUpButton: null,
  useAuth: null,
  UserButton: null,
  loaded: false,
  error: null,
};

// Load Clerk components dynamically with better error handling
function loadClerkComponents() {
  if (clerkComponentsCache.loaded) {
    return clerkComponentsCache;
  }

  if (typeof window !== "undefined") {
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    if (!isAuthDisabled && hasClerkKey) {
      try {
        const clerkModule = require("@clerk/nextjs");
        clerkComponentsCache.SignedIn = clerkModule.SignedIn;
        clerkComponentsCache.SignedOut = clerkModule.SignedOut;
        clerkComponentsCache.SignInButton = clerkModule.SignInButton;
        clerkComponentsCache.SignUpButton = clerkModule.SignUpButton;
        clerkComponentsCache.useAuth = clerkModule.useAuth;
        clerkComponentsCache.UserButton = clerkModule.UserButton;
        clerkComponentsCache.loaded = true;
      } catch (error) {
        console.warn("[AuthComponents] Clerk module not available:", error);
        clerkComponentsCache.error = error as Error;
        clerkComponentsCache.loaded = true; // Mark as loaded even on error to prevent retries
      }
    } else {
      clerkComponentsCache.loaded = true; // Mark as loaded when auth is disabled
    }
  }

  return clerkComponentsCache;
}

// Check auth configuration
const getIsAuthDisabled = () => {
  return process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
};

// Create a safe wrapper for useAuth that checks context availability
// This ensures we always have a valid auth implementation
export const useAuth = () => {
  const isAuthDisabled = getIsAuthDisabled();
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const components = loadClerkComponents();

  // Always try to call the hook if it exists (to maintain hook order)
  let clerkAuth = null;
  if (components.useAuth && !components.error) {
    try {
      // This maintains hook call order - always called if available
      clerkAuth = components.useAuth();
    } catch {
      // If it fails, we'll use mock
      clerkAuth = null;
    }
  }

  // During SSR, always use mock to avoid context issues
  if (typeof window === "undefined") {
    return MockUseAuth();
  }

  // If auth is disabled, no Clerk key, or Clerk failed, use mock
  if (isAuthDisabled || !hasClerkKey || !clerkAuth) {
    return MockUseAuth();
  }

  // Use the Clerk auth result
  return clerkAuth;
};

// Export wrapper components that choose implementation at runtime
export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const isAuthDisabled = getIsAuthDisabled();
  const components = loadClerkComponents();
  const Component = isAuthDisabled || !components.SignedIn ? MockSignedIn : components.SignedIn;
  return <Component>{children}</Component>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const isAuthDisabled = getIsAuthDisabled();
  const components = loadClerkComponents();
  const Component = isAuthDisabled || !components.SignedOut ? MockSignedOut : components.SignedOut;
  return <Component>{children}</Component>;
};

export const SignInButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const isAuthDisabled = getIsAuthDisabled();
  const components = loadClerkComponents();
  const Component =
    isAuthDisabled || !components.SignInButton ? MockSignInButton : components.SignInButton;
  return <Component {...props}>{children}</Component>;
};

export const SignUpButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const isAuthDisabled = getIsAuthDisabled();
  const components = loadClerkComponents();
  const Component =
    isAuthDisabled || !components.SignUpButton ? MockSignInButton : components.SignUpButton;
  return <Component {...props}>{children}</Component>;
};

export const UserButton = (props: Record<string, unknown>) => {
  const isAuthDisabled = getIsAuthDisabled();
  const components = loadClerkComponents();
  const Component =
    isAuthDisabled || !components.UserButton ? MockUserButton : components.UserButton;
  return <Component {...props} />;
};

// Wrapper component that handles SSR/hydration issues
export function SignInButtonWrapper({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  return <SignInButton {...props}>{children}</SignInButton>;
}

// Wrapper for SignedOut that ensures content is visible during SSR
export function SignedOutWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, always show the content
  // This ensures the Sign In button is visible on page load
  if (!mounted || !authData.isLoaded) {
    return <>{children}</>;
  }

  // After mount and auth is loaded, only show if signed out
  if (authData.isSignedIn === false) {
    return <>{children}</>;
  }

  return null;
}

// Wrapper for SignedIn that handles SSR properly
export function SignedInWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show signed-in content
  if (!mounted || !authData.isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (authData.isSignedIn === true) {
    return <>{children}</>;
  }

  return null;
}

// Wrapper for UserButton that handles SSR properly
export function UserButtonWrapper(props: Record<string, unknown>) {
  const [mounted, setMounted] = useState(false);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();
  const isAuthDisabled = getIsAuthDisabled();

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial render, don't show the user button
  if (!mounted || !authData.isLoaded) {
    return null;
  }

  // After mount and auth is loaded, only show if signed in
  if (authData.isSignedIn === true) {
    // Use UserButtonWithAdmin for Clerk auth, MockUserButton for disabled auth
    const ButtonComponent = isAuthDisabled ? MockUserButton : UserButtonWithAdmin;
    return <ButtonComponent {...props} />;
  }

  return null;
}
