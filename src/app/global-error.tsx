"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f9fafb",
          padding: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "0.5rem",
            padding: "2rem",
            maxWidth: "28rem",
            width: "100%",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)"
          }}>
            <h1 style={{
              fontSize: "1.5rem",
              fontWeight: "bold",
              marginBottom: "1rem",
              textAlign: "center",
              color: "#111827"
            }}>
              Something went wrong!
            </h1>
            <p style={{
              marginBottom: "1rem",
              textAlign: "center",
              color: "#6b7280"
            }}>
              An unexpected error occurred. We apologize for the inconvenience.
            </p>
            {error.digest && (
              <p style={{
                fontSize: "0.875rem",
                color: "#9ca3af",
                textAlign: "center",
                marginBottom: "1rem"
              }}>
                Error ID: {error.digest}
              </p>
            )}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              marginTop: "1.5rem"
            }}>
              <button
                onClick={reset}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  borderRadius: "0.375rem",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem"
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
                  fontSize: "1rem"
                }}
              >
                Return Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}