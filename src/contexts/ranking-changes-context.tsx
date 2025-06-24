"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface RankingChanges {
  totalChanges: number;
  movedUp: number;
  movedDown: number;
  newEntries: number;
  lastUpdated: Date | null;
}

interface RankingChangesContextType {
  changes: RankingChanges | null;
  setChanges: (changes: RankingChanges | null) => void;
  clearChanges: () => void;
}

const RankingChangesContext = createContext<RankingChangesContextType | undefined>(undefined);

export function RankingChangesProvider({ children }: { children: React.ReactNode }) {
  const [changes, setChanges] = useState<RankingChanges | null>(() => {
    // Load from localStorage on mount
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rankingChanges");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if changes are less than 24 hours old
        const lastUpdated = new Date(parsed.lastUpdated);
        const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate < 24) {
          return parsed;
        }
      }
    }
    return null;
  });

  // Save to localStorage whenever changes update
  useEffect(() => {
    if (changes) {
      localStorage.setItem("rankingChanges", JSON.stringify(changes));
    } else {
      localStorage.removeItem("rankingChanges");
    }
  }, [changes]);

  const clearChanges = () => {
    setChanges(null);
    localStorage.removeItem("rankingChanges");
  };

  return (
    <RankingChangesContext.Provider value={{ changes, setChanges, clearChanges }}>
      {children}
    </RankingChangesContext.Provider>
  );
}

export function useRankingChanges() {
  const context = useContext(RankingChangesContext);
  if (context === undefined) {
    throw new Error("useRankingChanges must be used within a RankingChangesProvider");
  }
  return context;
}
