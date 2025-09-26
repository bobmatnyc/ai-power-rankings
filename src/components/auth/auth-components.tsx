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

let ClerkSignedIn: ClerkComponent | null = null;
let ClerkSignedOut: ClerkComponent | null = null;
let ClerkSignInButton: ClerkComponent | null = null;
let ClerkSignUpButton: ClerkComponent | null = null;
let ClerkUseAuth: ClerkHook | null = null;
let ClerkUserButton: ClerkComponent | null = null;

// Load Clerk components once on client side
if (typeof window !== "undefined") {
  try {
    const clerkModule = require("@clerk/nextjs");
    ClerkSignedIn = clerkModule.SignedIn;
    ClerkSignedOut = clerkModule.SignedOut;
    ClerkSignInButton = clerkModule.SignInButton;
    ClerkSignUpButton = clerkModule.SignUpButton;
    ClerkUseAuth = clerkModule.useAuth;
    ClerkUserButton = clerkModule.UserButton;
  } catch (error) {
    console.warn("[AuthComponents] Clerk module not available:", error);
  }
}

// Check auth configuration
const getIsAuthDisabled = () => {
  return process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
};

// Export functions that determine which implementation to use at runtime
export const useAuth = () => {
  const isAuthDisabled = getIsAuthDisabled();
  if (isAuthDisabled || !ClerkUseAuth) {
    return MockUseAuth();
  }
  return ClerkUseAuth();
};

// Export wrapper components that choose implementation at runtime
export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const isAuthDisabled = getIsAuthDisabled();
  const Component = isAuthDisabled || !ClerkSignedIn ? MockSignedIn : ClerkSignedIn;
  return <Component>{children}</Component>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const isAuthDisabled = getIsAuthDisabled();
  const Component = isAuthDisabled || !ClerkSignedOut ? MockSignedOut : ClerkSignedOut;
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
  const Component = isAuthDisabled || !ClerkSignInButton ? MockSignInButton : ClerkSignInButton;
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
  const Component = isAuthDisabled || !ClerkSignUpButton ? MockSignInButton : ClerkSignUpButton;
  return <Component {...props}>{children}</Component>;
};

export const UserButton = (props: Record<string, unknown>) => {
  const isAuthDisabled = getIsAuthDisabled();
  const Component = isAuthDisabled || !ClerkUserButton ? MockUserButton : ClerkUserButton;
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
