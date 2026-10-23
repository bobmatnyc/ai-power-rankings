"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div
      className="bg-ds-surface-paper-muted"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        className="bg-ds-surface-paper"
        style={{
          borderRadius: "0.5rem",
          padding: "2rem",
          maxWidth: "28rem",
          width: "100%",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            textAlign: "center",
            color: "#111827",
          }}
        >
          Oops! Something went wrong
        </h1>
        <p
          className="text-ds-text-paper-subtle"
          style={{
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          We encountered an error while processing your request.
        </p>
        {error.message && (
          <p
            className="bg-ds-surface-paper-sunken text-ds-text-paper-subtle"
            style={{
              fontSize: "0.875rem",
              padding: "0.5rem",
              borderRadius: "0.25rem",
              marginBottom: "1rem",
            }}
          >
            {error.message}
          </p>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={reset}
            className="bg-ds-accent-cat-blue text-ds-text-on-fill"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Try Again
          </button>
          {/* #190: hover/active variants hold the colour against globals.css a:hover and a:active. */}
          <a
            href="/"
            className="border-ds-border-paper bg-ds-surface-paper text-ds-accent-cat-blue hover:text-ds-accent-cat-blue active:text-ds-accent-cat-blue"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              borderWidth: "1px",
              borderStyle: "solid",
              textDecoration: "none",
              textAlign: "center",
              fontSize: "1rem",
            }}
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
