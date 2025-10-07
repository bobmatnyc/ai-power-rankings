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
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        padding: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
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
          style={{
            marginBottom: "1rem",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          We encountered an error while processing your request.
        </p>
        {error.message && (
          <p
            style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              backgroundColor: "#f3f4f6",
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
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#3b82f6",
              color: "white",
              borderRadius: "0.375rem",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "white",
              color: "#3b82f6",
              borderRadius: "0.375rem",
              border: "1px solid #e5e7eb",
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
