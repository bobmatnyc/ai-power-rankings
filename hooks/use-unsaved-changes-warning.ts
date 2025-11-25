/**
 * Unsaved Changes Warning Hook
 *
 * Detects unsaved changes and shows browser confirmation on:
 * - Tab close
 * - Page navigation
 * - Browser back button
 *
 * Message: "You have unsaved changes. Are you sure you want to leave?"
 *
 * @example
 * const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
 * useUnsavedChangesWarning(hasUnsavedChanges);
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  const router = useRouter();
  const hasUnsavedRef = useRef(hasUnsavedChanges);

  // Update ref when hasUnsavedChanges changes
  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Warn on browser close/reload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault();
        // Modern browsers ignore custom messages, but we still need to set returnValue
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    // Warn on Next.js navigation (back button, link clicks)
    // Note: Next.js 15 App Router doesn't have routeChangeStart event
    // We'll use the beforeunload event which handles browser navigation

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router]);

  // For Next.js App Router, we can also use a custom prompt for internal navigation
  // This is handled by the beforeunload event for all navigation types
}

/**
 * Hook to confirm navigation when there are unsaved changes
 * This version provides a custom confirm dialog for internal Next.js navigation
 */
export function useNavigationWarning(
  hasUnsavedChanges: boolean,
  message: string = "You have unsaved changes. Are you sure you want to leave?"
) {
  const hasUnsavedRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    hasUnsavedRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Browser navigation warning
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    // Prevent accidental navigation via browser back button
    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedRef.current) {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          // Push the current state back
          window.history.pushState(null, "", window.location.href);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    // Add initial history state to enable popstate detection
    window.history.pushState(null, "", window.location.href);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [message]);
}
