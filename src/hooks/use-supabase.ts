"use client";

import { useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Tool, Ranking } from "@/types/database";

export function useSupabase() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTools = useCallback(async () => {
    const supabase = createBrowserClient();
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("tools")
        .select("*")
        .order("name");

      if (error) throw error;
      setTools(data || []);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching tools:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRankings = useCallback(async () => {
    const supabase = createBrowserClient();
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("rankings")
        .select("*")
        .order("period", { ascending: false })
        .order("position");

      if (error) throw error;
      setRankings(data || []);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching rankings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTool = useCallback(async (toolId: string, updates: Partial<Tool>) => {
    const supabase = createBrowserClient();
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("tools")
        .update(updates)
        .eq("id", toolId)
        .select()
        .single();

      if (error) throw error;
      
      // Update local state
      setTools(prevTools => 
        prevTools.map(tool => tool.id === toolId ? data : tool)
      );
      
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
    const supabase = createBrowserClient();
    try {
      setLoading(true);
      setError(null);
      
      const { error } = await supabase
        .from("tools")
        .delete()
        .eq("id", toolId);

      if (error) throw error;
      
      // Update local state
      setTools(prevTools => prevTools.filter(tool => tool.id !== toolId));
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