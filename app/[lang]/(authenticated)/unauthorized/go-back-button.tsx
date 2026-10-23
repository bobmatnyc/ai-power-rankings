"use client";

import { ArrowLeft } from "lucide-react";

/**
 * "Go Back" button for the unauthorized page.
 *
 * Why: #226 — the page is a Server Component, and React cannot pass an
 * `onClick` function from a Server Component to a DOM element, so every
 * render of `/<locale>/unauthorized` threw and answered 500.
 * What: Client Component that steps back one entry in the browser history.
 * Test: `tests/unit/unauthorized-page-226.test.tsx`.
 */
export function GoBackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Go Back
    </button>
  );
}
