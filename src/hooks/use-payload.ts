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

      const response = await fetch("/api/admin/rankings/all");
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

      // Find the tool to get its slug
      const tool = tools.find(t => t.id === toolId);
      if (!tool) {
        throw new Error("Tool not found");
      }

      const response = await fetch(`/api/tools/${tool.slug}/json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...tool, ...updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update tool");
      }

      const data = await response.json();

      // Update local state
      setTools((prevTools) => prevTools.map((t) => (t.id === toolId ? data.tool : t)));

      return data.tool;
    } catch (err) {
      setError(err as Error);
      console.error("Error updating tool:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tools]);

  const deleteTool = useCallback(async (toolId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Find the tool to get its slug
      const tool = tools.find(t => t.id === toolId);
      if (!tool) {
        throw new Error("Tool not found");
      }

      const response = await fetch(`/api/tools/${tool.slug}/json`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete tool");
      }

      // Update local state - the API soft deletes by setting status to "discontinued"
      setTools((prevTools) => prevTools.map((t) => 
        t.id === toolId ? { ...t, status: "discontinued" as const } : t
      ));
    } catch (err) {
      setError(err as Error);
      console.error("Error deleting tool:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tools]);

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
