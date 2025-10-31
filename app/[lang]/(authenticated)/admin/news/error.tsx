"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console in development
    console.error("Admin News Page Error:", error);
  }, [error]);

  return (
    <div className="container mx-auto p-6">
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-semibold mb-2">Error Loading News Articles</div>
          <p className="mb-2">
            {error.message || "An unexpected error occurred while loading the news articles."}
          </p>
          {error.digest && <p className="text-xs opacity-70 mb-2">Error ID: {error.digest}</p>}
          <div className="mt-4 flex gap-2">
            <Button onClick={reset} variant="outline" size="sm">
              Try Again
            </Button>
            <Button
              onClick={() => {
                window.location.href = "/en/admin";
              }}
              variant="outline"
              size="sm"
            >
              Back to Admin
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
