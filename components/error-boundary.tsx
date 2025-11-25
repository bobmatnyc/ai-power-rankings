"use client";

import { AlertCircle } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger-client";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Only log if there's an actual error (not empty objects)
    if (error && error.message) {
      // Enhanced error logging for debugging
      console.error("[ErrorBoundary] Caught error:", error);
      console.error("[ErrorBoundary] Error message:", error.message);
      console.error("[ErrorBoundary] Error stack:", error.stack);
      console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
      console.error("[ErrorBoundary] Environment:", {
        NODE_ENV: process.env["NODE_ENV"],
        VERCEL_ENV: process.env["VERCEL_ENV"],
        URL: typeof window !== "undefined" ? window.location.href : "SSR",
      });

      logger.error("Error boundary caught error", { error, errorInfo });
    }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Show detailed error in development or staging
      const showDetails =
        process.env["NODE_ENV"] === "development" ||
        process.env["VERCEL_ENV"] === "preview" ||
        process.env["VERCEL_ENV"] === "development";

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-6 text-center max-w-md">
            We&apos;re experiencing technical difficulties. Please try refreshing the page.
          </p>

          {showDetails && this.state.error && (
            <details className="mt-4 p-4 bg-gray-100 rounded max-w-2xl w-full">
              <summary className="cursor-pointer font-semibold">Error Details</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <strong>Message:</strong>
                  <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                    {this.state.error.message}
                  </pre>
                </div>
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                    {this.state.error.stack}
                  </pre>
                </div>
              </div>
            </details>
          )}

          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  return (error: Error) => {
    logger.error("Error handler called", { error });
    // You can add custom error handling logic here
    // e.g., send to error tracking service
  };
}
