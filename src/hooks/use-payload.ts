"use client";

import { useState, useCallback } from "react";
import { Tool, Ranking } from "@/types/database";

export function usePayload() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/tools");
      if (!response.ok) {
        throw new Error("Failed to fetch tools");
      }
      
      const data = await response.json();
      setTools(data.tools || []);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching tools:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/rankings");
      if (!response.ok) {
        throw new Error("Failed to fetch rankings");
      }
      
      const data = await response.json();
      setRankings(data.rankings || []);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching rankings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTool = useCallback(async (toolId: string, updates: Partial<Tool>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/tools/${toolId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update tool");
      }

      const data = await response.json();

      // Update local state
      setTools((prevTools) => prevTools.map((tool) => (tool.id === toolId ? data : tool)));

      return data;
    } catch (err) {
      setError(err as Error);
      console.error("Error updating tool:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTool = useCallback(async (toolId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/tools/${toolId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete tool");
      }

      // Update local state
      setTools((prevTools) => prevTools.filter((tool) => tool.id !== toolId));
    } catch (err) {
      setError(err as Error);
      console.error("Error deleting tool:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    tools,
    rankings,
    loading,
    error,
    fetchTools,
    fetchRankings,
    updateTool,
    deleteTool,
  };
}