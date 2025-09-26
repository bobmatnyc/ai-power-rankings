"use client";

import React, { type ReactNode } from "react";

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface AuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Next.js 15 Error Boundary for Authentication Components
 *
 * Catches useContext and other React errors in auth components
 * Provides graceful fallback when Clerk components fail
 */
export class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    // Check if this is specifically a useContext error from Next.js 15 SSR
    const isContextError =
      error.message?.includes("useContext") ||
      error.message?.includes("Cannot read properties of null") ||
      error.stack?.includes("useContext") ||
      error.stack?.includes("chunks/845.js") || // Next.js 15 specific chunk error
      error.stack?.includes(".next/server/chunks/");

    if (isContextError) {
      console.error("[AuthErrorBoundary] Caught Next.js 15 useContext SSR error:", error.message);
      return { hasError: true, error };
    }

    // For non-context errors, still catch them but log differently
    console.warn("[AuthErrorBoundary] Caught non-context error:", error.message);
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error("[AuthErrorBoundary] Auth component error:", error);
    console.error("[AuthErrorBoundary] Error info:", errorInfo);

    // Check if it's a useContext error
    if (error.message.includes("useContext") || error.message.includes("createContext")) {
      console.error(
        "[AuthErrorBoundary] React Context error detected - likely server/client boundary issue"
      );
    }

    // In development, provide more detailed logging
    if (process.env["NODE_ENV"] === "development") {
      console.error("[AuthErrorBoundary] Component stack:", errorInfo.componentStack);
    }
  }

  override render() {
    if (this.state.hasError) {
      // Render fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback - render children without auth context
      console.info("[AuthErrorBoundary] Rendering fallback due to auth error");
      return <div suppressHydrationWarning>{this.props.children}</div>;
    }

    return this.props.children;
  }
}

/**
 * Hook version for functional components that need error handling
 */
export function useAuthErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    console.error("[AuthErrorHandler] Caught auth error:", error);
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}
