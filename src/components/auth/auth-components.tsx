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

// Simple client-side detection
const isClientSide = typeof window !== "undefined";

// Environment helpers
const getIsAuthDisabled = () => process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
const getHasClerkKey = () => !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

// Simple Clerk component storage
let clerkComponents: {
  SignedIn?: React.ComponentType<{ children?: React.ReactNode }>;
  SignedOut?: React.ComponentType<{ children?: React.ReactNode }>;
  SignInButton?: React.ComponentType<{ children?: React.ReactNode }>;
  SignUpButton?: React.ComponentType<{ children?: React.ReactNode }>;
  // biome-ignore lint/suspicious/noExplicitAny: Clerk SignIn has complex props
  SignIn?: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: Clerk SignUp has complex props
  SignUp?: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: Clerk UserButton has complex props
  UserButton?: React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: Clerk useAuth returns complex auth object
  useAuth?: () => any;
  // biome-ignore lint/suspicious/noExplicitAny: Clerk useUser returns complex user object
  useUser?: () => any;
  // biome-ignore lint/suspicious/noExplicitAny: Clerk useClerk returns complex clerk object
  useClerk?: () => any;
  loaded: boolean;
} = { loaded: false };

// Load Clerk components only once, only on client
if (isClientSide && !getIsAuthDisabled() && getHasClerkKey() && !clerkComponents.loaded) {
  try {
    import("@clerk/nextjs")
      .then((clerk) => {
        clerkComponents = {
          SignedIn: clerk.SignedIn,
          SignedOut: clerk.SignedOut,
          SignInButton: clerk.SignInButton,
          SignUpButton: clerk.SignUpButton,
          SignIn: clerk.SignIn,
          SignUp: clerk.SignUp,
          UserButton: clerk.UserButton,
          useAuth: clerk.useAuth,
          useUser: clerk.useUser,
          useClerk: clerk.useClerk,
          loaded: true,
        };
        console.info("[AuthComponents] Clerk loaded successfully");
      })
      .catch(() => {
        clerkComponents.loaded = true; // Mark as loaded to prevent retries
      });
  } catch {
    clerkComponents.loaded = true;
  }
}

/**
 * Safe useAuth hook that checks for ClerkProvider context before calling Clerk hooks
 */
export const useAuth = () => {
  // Always call the mock hook first for consistent hook behavior
  const mockAuth = MockUseAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted, auth disabled, or no Clerk key, use mock
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return mockAuth;
  }

  // If Clerk is loaded and available, try to check if we're in provider context
  if (clerkComponents.useAuth && clerkComponents.loaded) {
    try {
      // First, try to detect if we're inside ClerkProvider using useClerk
      if (clerkComponents.useClerk) {
        // biome-ignore lint/correctness/useHookAtTopLevel: Not a React hook, it's a dynamically loaded function
        const clerkInstance = clerkComponents.useClerk();
        // If useClerk works and returns an object with 'loaded' property, we're in context
        if (clerkInstance && typeof clerkInstance === "object" && "loaded" in clerkInstance) {
          // Now it's safe to call useAuth
          // biome-ignore lint/correctness/useHookAtTopLevel: Not a React hook, it's a dynamically loaded function
          const clerkAuthResult = clerkComponents.useAuth();
          return clerkAuthResult;
        }
      }
    } catch (error) {
      // If any Clerk hook fails, it means we're not properly in ClerkProvider context
      console.warn("[useAuth] Not in ClerkProvider context, using mock:", error);
      return mockAuth;
    }
  }

  // Fallback to mock
  return mockAuth;
};

/**
 * Safe useUser hook that checks for ClerkProvider context before calling Clerk hooks
 */
export const useUser = () => {
  // Always call the mock hooks first for consistent hook behavior
  const mockUser = { user: null, isLoaded: true, isSignedIn: false };
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If not mounted, auth disabled, or no Clerk key, use mock
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return mockUser;
  }

  // If Clerk is loaded and available, try to check if we're in provider context
  if (clerkComponents.useUser && clerkComponents.loaded) {
    try {
      // First, try to detect if we're inside ClerkProvider using useClerk
      if (clerkComponents.useClerk) {
        // biome-ignore lint/correctness/useHookAtTopLevel: Not a React hook, it's a dynamically loaded function
        const clerkInstance = clerkComponents.useClerk();
        // If useClerk works and returns an object with 'loaded' property, we're in context
        if (clerkInstance && typeof clerkInstance === "object" && "loaded" in clerkInstance) {
          // Now it's safe to call useUser
          // biome-ignore lint/correctness/useHookAtTopLevel: Not a React hook, it's a dynamically loaded function
          const clerkUserResult = clerkComponents.useUser();
          return clerkUserResult;
        }
      }
    } catch (error) {
      // If any Clerk hook fails, it means we're not properly in ClerkProvider context
      console.warn("[useUser] Not in ClerkProvider context, using mock:", error);
      return mockUser;
    }
  }

  // Fallback to mock
  return mockUser;
};

/**
 * Simplified component wrappers that avoid async loading during render
 */
export const SignedIn = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use mock during SSR or if auth is disabled
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return <MockSignedIn>{children}</MockSignedIn>;
  }

  // Use Clerk component if available
  if (clerkComponents.SignedIn && clerkComponents.loaded) {
    const ClerkSignedIn = clerkComponents.SignedIn;
    return <ClerkSignedIn>{children}</ClerkSignedIn>;
  }

  // Fallback to mock
  return <MockSignedIn>{children}</MockSignedIn>;
};

export const SignedOut = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use mock during SSR or if auth is disabled
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return <MockSignedOut>{children}</MockSignedOut>;
  }

  // Use Clerk component if available
  if (clerkComponents.SignedOut && clerkComponents.loaded) {
    const ClerkSignedOut = clerkComponents.SignedOut;
    return <ClerkSignedOut>{children}</ClerkSignedOut>;
  }

  // Fallback to mock
  return <MockSignedOut>{children}</MockSignedOut>;
};

export const SignInButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use mock during SSR or if auth is disabled
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return <MockSignInButton {...props}>{children}</MockSignInButton>;
  }

  // Use Clerk component if available
  if (clerkComponents.SignInButton && clerkComponents.loaded) {
    const ClerkSignInButton = clerkComponents.SignInButton;
    return <ClerkSignInButton {...props}>{children}</ClerkSignInButton>;
  }

  // Fallback to mock
  return <MockSignInButton {...props}>{children}</MockSignInButton>;
};

export const SignUpButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use mock during SSR or if auth is disabled
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return <MockSignInButton {...props}>{children}</MockSignInButton>;
  }

  // Use Clerk component if available
  if (clerkComponents.SignUpButton && clerkComponents.loaded) {
    const ClerkSignUpButton = clerkComponents.SignUpButton;
    return <ClerkSignUpButton {...props}>{children}</ClerkSignUpButton>;
  }

  // Fallback to mock
  return <MockSignInButton {...props}>{children}</MockSignInButton>;
};

export const UserButton = (props: Record<string, unknown>) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use mock during SSR or if auth is disabled
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return <MockUserButton {...props} />;
  }

  // Use Clerk component if available
  if (clerkComponents.UserButton && clerkComponents.loaded) {
    const ClerkUserButton = clerkComponents.UserButton;
    return <ClerkUserButton {...props} />;
  }

  // Fallback to mock
  return <MockUserButton {...props} />;
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

// Additional exports for compatibility
export const useClerk = () => {
  // Default return value for when Clerk is not available
  const defaultClerk = {
    loaded: false,
    session: null,
    user: null,
    signOut: () => Promise.resolve(),
    openSignIn: () => {},
    openSignUp: () => {},
  };

  // Early return if no Clerk components
  if (!clerkComponents || !clerkComponents.useClerk) {
    return defaultClerk;
  }

  try {
    // Call the hook unconditionally when it exists
    // biome-ignore lint/correctness/useHookAtTopLevel: Safe wrapper for optional Clerk hook
    const clerkResult = clerkComponents.useClerk();
    return clerkResult;
  } catch (error) {
    console.warn("[useClerk] Failed to call hook:", error);
    return defaultClerk;
  }
};

export const SignIn = (props: Record<string, unknown>) => {
  if (!clerkComponents || !clerkComponents.SignIn) {
    return <div>Sign in unavailable</div>;
  }
  const SignInComponent = clerkComponents.SignIn;
  return <SignInComponent {...props} />;
};

export const SignUp = (props: Record<string, unknown>) => {
  if (!clerkComponents || !clerkComponents.SignUp) {
    return <div>Sign up unavailable</div>;
  }
  const SignUpComponent = clerkComponents.SignUp;
  return <SignUpComponent {...props} />;
};
