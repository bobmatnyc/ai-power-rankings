"use client";

import { ErrorBoundary, ErrorFallback } from "./error-boundary";
import { DiagnosticsClientFixed } from "./diagnostics-client-fixed";
import { ClerkStatusFixed } from "./clerk-status-fixed";

export function DiagnosticsWrapper() {
  return (
    <>
      <ErrorBoundary fallback={ErrorFallback}>
        <ClerkStatusFixed />
      </ErrorBoundary>

      <ErrorBoundary fallback={ErrorFallback}>
        <DiagnosticsClientFixed />
      </ErrorBoundary>
    </>
  );
}
