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

// CRITICAL: Check if ClerkProvider is available
// This checks the global flag set by ClerkProviderClient
const isClerkProviderAvailable = () => {
  if (!isClientSide) return false;
  return !!(window as any).__clerkProviderAvailable;
};

// CRITICAL: Check if we should even attempt to load Clerk
const shouldLoadClerk = () => {
  // Never load Clerk if auth is explicitly disabled
  if (getIsAuthDisabled()) {
    console.info("[AuthComponents] Clerk disabled via NEXT_PUBLIC_DISABLE_AUTH");
    return false;
  }

  // Never load without a key
  if (!getHasClerkKey()) {
    console.info("[AuthComponents] Clerk disabled - no publishable key");
    return false;
  }

  // Only load on client side
  if (!isClientSide) {
    return false;
  }

  // CRITICAL: Only load if ClerkProvider is available
  // This prevents the "SignInButton outside ClerkProvider" error
  if (!isClerkProviderAvailable()) {
    console.info("[AuthComponents] Clerk disabled - ClerkProvider not available");
    return false;
  }

  return true;
};

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

// Load Clerk components only if we should
if (shouldLoadClerk() && !clerkComponents.loaded) {
  try {
    import("@clerk/nextjs")
      .then((clerk) => {
        // Double-check we should still load after async import
        if (!shouldLoadClerk()) {
          clerkComponents.loaded = true;
          return;
        }

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
      .catch((error) => {
        console.warn("[AuthComponents] Failed to load Clerk:", error);
        clerkComponents.loaded = true; // Mark as loaded to prevent retries
      });
  } catch (error) {
    console.warn("[AuthComponents] Failed to initiate Clerk import:", error);
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
  const [authState, setAuthState] = useState(mockAuth);

  useEffect(() => {
    setMounted(true);

    // Try to get auth state from window.Clerk
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;
      const updateAuthState = () => {
        setAuthState({
          isLoaded: true,
          isSignedIn: !!clerk.user,
          userId: clerk.user?.id || null,
          sessionId: clerk.session?.id || null,
          has: () => false,
          getToken: async () => null,
          signOut: async () => {
            if (clerk.signOut) {
              await clerk.signOut();
            }
          },
        });
      };

      // Initial update
      updateAuthState();

      // Listen for auth changes
      clerk.addListener?.(updateAuthState);

      return () => {
        clerk.removeListener?.(updateAuthState);
      };
    }
  }, []);

  // For auth disabled environments or SSR, always return mock
  if (getIsAuthDisabled() || !getHasClerkKey()) {
    return mockAuth;
  }

  // During SSR/initial render, return mock
  if (!mounted) {
    return mockAuth;
  }

  // Return the actual auth state from Clerk
  return authState;
};

/**
 * Safe useUser hook that checks for ClerkProvider context before calling Clerk hooks
 */
export const useUser = () => {
  // Always call the mock hooks first for consistent hook behavior
  const mockUser = { user: null, isLoaded: true, isSignedIn: false };
  const [mounted, setMounted] = useState(false);
  const [userState, setUserState] = useState(mockUser);

  useEffect(() => {
    setMounted(true);

    // Try to get user state from window.Clerk
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;
      const updateUserState = () => {
        setUserState({
          user: clerk.user || null,
          isLoaded: true,
          isSignedIn: !!clerk.user,
        });
      };

      // Initial update
      updateUserState();

      // Listen for auth changes
      clerk.addListener?.(updateUserState);

      return () => {
        clerk.removeListener?.(updateUserState);
      };
    }
  }, []);

  // For auth disabled environments or SSR, always return mock
  if (getIsAuthDisabled() || !getHasClerkKey()) {
    return mockUser;
  }

  // During SSR/initial render, return mock
  if (!mounted) {
    return mockUser;
  }

  // Return the actual user state from Clerk
  return userState;
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

  // CRITICAL: Use mock if ClerkProvider is not available
  if (!isClerkProviderAvailable()) {
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

  // CRITICAL: Use mock if ClerkProvider is not available
  if (!isClerkProviderAvailable()) {
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
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [ClerkSignInButton, setClerkSignInButton] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    setMounted(true);

    // Check if user is signed in using Clerk from window
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;
      // Check if user is already signed in
      if (clerk.user) {
        setIsSignedIn(true);
      }
      // Also listen for auth changes
      const updateListener = () => {
        setIsSignedIn(!!clerk.user);
      };
      clerk.addListener?.(updateListener);

      // Load Clerk SignInButton component dynamically
      import("@clerk/nextjs")
        .then((clerkModule) => {
          if (clerkModule.SignInButton) {
            setClerkSignInButton(() => clerkModule.SignInButton);
            console.info("[SignInButton] Clerk SignInButton component loaded");
          }
        })
        .catch((error) => {
          console.warn("[SignInButton] Failed to load Clerk SignInButton:", error);
        });

      return () => {
        clerk.removeListener?.(updateListener);
      };
    }
  }, []);

  // CRITICAL: Always use mock if auth is disabled
  // This prevents any attempt to use Clerk components
  if (getIsAuthDisabled()) {
    return <MockSignInButton {...props}>{children}</MockSignInButton>;
  }

  // CRITICAL: Use mock if ClerkProvider is not available
  // This prevents the "SignInButton outside ClerkProvider" error
  if (!isClerkProviderAvailable()) {
    return <MockSignInButton {...props}>{children}</MockSignInButton>;
  }

  // Use mock during SSR or if no key
  if (!mounted || !getHasClerkKey()) {
    return <MockSignInButton {...props}>{children}</MockSignInButton>;
  }

  // Only show SignInButton if user is NOT signed in
  // Hide the button if user is already signed in to prevent ClerkRuntimeError
  if (isSignedIn) {
    console.info("[SignInButton] User is already signed in, hiding SignIn button");
    return null;
  }

  // For modal mode, add an extra check to prevent opening modal if signed in
  const enhancedProps = { ...props };
  if (props.mode === 'modal') {
    // Intercept the onClick to check auth state before allowing modal
    const originalOnClick = (enhancedProps as any).onClick;
    (enhancedProps as any).onClick = (e: React.MouseEvent) => {
      // Double-check if user is signed in before allowing modal
      if (typeof window !== "undefined" && (window as any).Clerk?.user) {
        console.warn("[SignInButton] Preventing modal open - user is already signed in");
        e.preventDefault();
        e.stopPropagation();

        // If there's a forceRedirectUrl, redirect there instead
        const redirectUrl = (props as any).forceRedirectUrl || (props as any).redirectUrl;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
        return;
      }
      // If not signed in, proceed with original click handler
      if (originalOnClick) {
        originalOnClick(e);
      }
    };
  }

  // Use Clerk component if loaded via useEffect
  if (ClerkSignInButton) {
    // Final safety check before rendering Clerk component
    // This prevents the modal error even if the wrapper fails
    if (typeof window !== "undefined" && (window as any).Clerk?.user) {
      console.warn("[SignInButton] Preventing Clerk SignInButton render - user is already signed in");
      return null;
    }

    return <ClerkSignInButton {...enhancedProps}>{children}</ClerkSignInButton>;
  }

  // While loading Clerk component, show a loading state instead of mock
  // This prevents the "authentication disabled" message from showing
  if (mounted && isClerkProviderAvailable() && !isSignedIn) {
    // Clerk is available but component hasn't loaded yet - show loading
    return <>{children}</>;
  }

  // Fallback to mock
  return <MockSignInButton {...enhancedProps}>{children}</MockSignInButton>;
};

export const SignUpButton = ({
  children,
  ...props
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const [mounted, setMounted] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if user is signed in using Clerk from window
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;
      // Check if user is already signed in
      if (clerk.user) {
        setIsSignedIn(true);
      }
      // Also listen for auth changes
      const updateListener = () => {
        setIsSignedIn(!!clerk.user);
      };
      clerk.addListener?.(updateListener);

      return () => {
        clerk.removeListener?.(updateListener);
      };
    }
  }, []);

  // Use mock during SSR or if auth is disabled
  if (!mounted || getIsAuthDisabled() || !getHasClerkKey()) {
    return <MockSignInButton {...props}>{children}</MockSignInButton>;
  }

  // IMPORTANT: Don't render SignUpButton if user is already signed in
  // This prevents the ClerkRuntimeError about SignUp modal not rendering when user is signed in
  if (isSignedIn) {
    console.info("[SignUpButton] User is already signed in, not rendering SignUp button");
    return null;
  }

  // For modal mode, add an extra check to prevent opening modal if signed in
  const enhancedProps = { ...props };
  if (props.mode === 'modal') {
    // Intercept the onClick to check auth state before allowing modal
    const originalOnClick = (enhancedProps as any).onClick;
    (enhancedProps as any).onClick = (e: React.MouseEvent) => {
      // Double-check if user is signed in before allowing modal
      if (typeof window !== "undefined" && (window as any).Clerk?.user) {
        console.warn("[SignUpButton] Preventing modal open - user is already signed in");
        e.preventDefault();
        e.stopPropagation();

        // If there's a forceRedirectUrl, redirect there instead
        const redirectUrl = (props as any).forceRedirectUrl || (props as any).redirectUrl;
        if (redirectUrl) {
          window.location.href = redirectUrl;
        }
        return;
      }
      // If not signed in, proceed with original click handler
      if (originalOnClick) {
        originalOnClick(e);
      }
    };
  }

  // Use Clerk component if available
  if (clerkComponents.SignUpButton && clerkComponents.loaded) {
    // Final safety check before rendering Clerk component
    // This prevents the modal error even if the wrapper fails
    if (typeof window !== "undefined" && (window as any).Clerk?.user) {
      console.warn("[SignUpButton] Preventing Clerk SignUpButton render - user is already signed in");
      return null;
    }

    const ClerkSignUpButton = clerkComponents.SignUpButton;
    return <ClerkSignUpButton {...enhancedProps}>{children}</ClerkSignUpButton>;
  }

  // Fallback to mock
  return <MockSignInButton {...enhancedProps}>{children}</MockSignInButton>;
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

  // CRITICAL: Use mock if ClerkProvider is not available
  if (!isClerkProviderAvailable()) {
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
  const [clerkUser, setClerkUser] = useState<any>(null);
  // Always call hooks at the top level - never conditionally
  const authData = useAuth();

  useEffect(() => {
    setMounted(true);

    // Also check Clerk directly to avoid race conditions
    if (typeof window !== "undefined" && (window as any).Clerk) {
      const clerk = (window as any).Clerk;
      setClerkUser(clerk.user);

      // Listen for auth state changes
      const updateListener = () => {
        setClerkUser(clerk.user);
      };
      clerk.addListener?.(updateListener);

      return () => {
        clerk.removeListener?.(updateListener);
      };
    }
  }, []);

  // During SSR, show content
  if (!mounted) {
    return <>{children}</>;
  }

  // Once mounted, check both auth sources to be extra safe
  // If Clerk user exists directly, hide the sign-out content immediately
  if (clerkUser) {
    return null;
  }

  // If auth data is loaded and user is signed in, hide
  if (authData.isLoaded && authData.isSignedIn) {
    return null;
  }

  // If auth is still loading but we don't have a Clerk user, show cautiously
  // This prevents the modal error during the brief loading period
  if (!authData.isLoaded) {
    // Double-check Clerk directly one more time
    if (typeof window !== "undefined" && (window as any).Clerk?.user) {
      return null;
    }
    // Only show if we're really sure there's no user
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
  const [clerk, setClerk] = useState<any>(null);

  useEffect(() => {
    // Get Clerk instance from window
    if (typeof window !== "undefined" && (window as any).Clerk) {
      setClerk((window as any).Clerk);
    }
  }, []);

  // Default return value for when Clerk is not available
  if (!clerk) {
    return {
      loaded: false,
      session: null,
      user: null,
      signOut: () => Promise.resolve(),
      openSignIn: () => {},
      openSignUp: () => {},
    };
  }

  // Return actual Clerk instance with proper methods
  return {
    loaded: true,
    session: clerk.session,
    user: clerk.user,
    signOut: () => clerk.signOut?.() || Promise.resolve(),
    openSignIn: (options?: any) => clerk.openSignIn?.(options),
    openSignUp: (options?: any) => clerk.openSignUp?.(options),
  };
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
