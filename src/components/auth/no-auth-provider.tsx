"use client";

import { createContext, type ReactNode, useContext } from "react";

// Mock user object for development
const mockUser = {
  id: "dev-user",
  emailAddresses: [{ emailAddress: "dev@localhost" }],
  firstName: "Dev",
  lastName: "User",
  fullName: "Dev User",
  username: "devuser",
  primaryEmailAddress: {
    emailAddress: "dev@localhost",
  },
};

// Mock session object for development
const mockSession = {
  id: "dev-session",
  userId: "dev-user",
  user: mockUser,
  status: "active",
  lastActiveAt: new Date(),
  expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
};

// Create contexts that mimic Clerk's structure
const NoAuthContext = createContext({
  isLoaded: true,
  isSignedIn: true,
  user: mockUser,
  session: mockSession,
  signOut: async () => {
    console.log("Sign out called in development mode");
  },
});

interface NoAuthProviderProps {
  children: ReactNode;
}

export function NoAuthProvider({ children }: NoAuthProviderProps) {
  const value = {
    isLoaded: true,
    isSignedIn: true,
    user: mockUser,
    session: mockSession,
    signOut: async () => {
      console.log("Sign out called in development mode");
    },
  };

  return <NoAuthContext.Provider value={value}>{children}</NoAuthContext.Provider>;
}

// Export hooks that mimic Clerk's API
export function useAuth() {
  const context = useContext(NoAuthContext);
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    userId: context.user?.id,
    sessionId: context.session?.id,
    signOut: context.signOut,
    getToken: async () => "dev-token",
    has: () => true,
  };
}

export function useUser() {
  const context = useContext(NoAuthContext);
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    user: context.user,
  };
}

export function useClerk() {
  const context = useContext(NoAuthContext);
  return {
    loaded: context.isLoaded,
    session: context.session,
    user: context.user,
    signOut: context.signOut,
  };
}

export function useSession() {
  const context = useContext(NoAuthContext);
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    session: context.session,
  };
}
