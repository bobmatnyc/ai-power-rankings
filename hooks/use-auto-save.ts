/**
 * Auto-Save Hook
 *
 * Automatically saves data at intervals with visual feedback.
 * Falls back to localStorage if API save fails.
 *
 * @example
 * const { lastSaved, saving, error, manualSave } = useAutoSave({
 *   interval: 30000, // 30 seconds
 *   onSave: async (data) => {
 *     await fetch('/api/save', { method: 'POST', body: JSON.stringify(data) });
 *   },
 *   enabled: true
 * });
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AutoSaveOptions<T = unknown> {
  interval?: number;        // Default: 30000 (30 seconds)
  onSave: (data: T) => Promise<void>;
  enabled?: boolean;       // Default: true
  data?: T;                // Data to save
  storageKey?: string;     // localStorage key for fallback
  debounceDelay?: number;  // Debounce delay for changes (default: 1000ms)
}

export interface AutoSaveState {
  lastSaved: Date | null;
  saving: boolean;
  error: Error | null;
}

export function useAutoSave<T = unknown>({
  interval = 30000,
  onSave,
  enabled = true,
  data,
  storageKey,
  debounceDelay = 1000,
}: AutoSaveOptions<T>) {
  const [state, setState] = useState<AutoSaveState>({
    lastSaved: null,
    saving: false,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T | undefined>(data);
  const hasUnsavedChanges = useRef(false);

  // Manual save function
  const manualSave = useCallback(async () => {
    if (!data || state.saving) return;

    setState((prev) => ({ ...prev, saving: true, error: null }));

    try {
      await onSave(data);

      // Also save to localStorage as backup
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {
          console.warn("Failed to save to localStorage:", e);
        }
      }

      setState({
        lastSaved: new Date(),
        saving: false,
        error: null,
      });
      hasUnsavedChanges.current = false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to save");

      // Fallback to localStorage on API failure
      if (storageKey && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
          console.warn("API save failed, saved to localStorage as fallback");
        } catch (e) {
          console.error("Failed to save to localStorage:", e);
        }
      }

      setState({
        lastSaved: null,
        saving: false,
        error,
      });
    }
  }, [data, onSave, storageKey, state.saving]);

  // Detect data changes and mark as unsaved
  useEffect(() => {
    if (data && JSON.stringify(data) !== JSON.stringify(lastDataRef.current)) {
      hasUnsavedChanges.current = true;
      lastDataRef.current = data;
    }
  }, [data]);

  // Auto-save at intervals
  useEffect(() => {
    if (!enabled || !data) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval
    intervalRef.current = setInterval(() => {
      if (hasUnsavedChanges.current && !state.saving) {
        manualSave();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, data, interval, manualSave, state.saving]);

  // Debounced auto-save on data changes
  useEffect(() => {
    if (!enabled || !data || !hasUnsavedChanges.current) return;

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set up new debounce
    debounceRef.current = setTimeout(() => {
      if (hasUnsavedChanges.current && !state.saving) {
        manualSave();
      }
    }, debounceDelay);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [data, enabled, debounceDelay, manualSave, state.saving]);

  // Load from localStorage on mount (if available)
  useEffect(() => {
    if (storageKey && typeof window !== "undefined" && !data) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          console.log("Loaded draft from localStorage");
        }
      } catch (e) {
        console.warn("Failed to load from localStorage:", e);
      }
    }
  }, [storageKey, data]);

  return {
    ...state,
    manualSave,
    hasUnsavedChanges: hasUnsavedChanges.current,
  };
}

/**
 * Format time since last save
 */
export function formatTimeSince(date: Date | null): string {
  if (!date) return "Never saved";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} minute${minutes > 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  return `Saved ${hours} hour${hours > 1 ? "s" : ""} ago`;
}
