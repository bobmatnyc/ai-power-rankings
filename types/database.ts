// Database types that are used across the application
// These types represent data structures from database queries

// Re-export types from rankings module
export type { ToolCapabilities, ToolMetrics } from "./rankings";

export interface MetricHistory {
  id?: string;
  tool_id?: string;
  published_date: string;
  source_name: string;
  source_url?: string | null;
  metrics?: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
    github_stars?: number;
    valuation?: number;
    funding?: number;
    employees?: number;
  };
  [key: string]: any;
}

export interface Tool {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  status: "active" | "inactive" | "deprecated" | "discontinued";
  created_at: string;
  updated_at: string;
  tags?: string[];
  info?: {
    product?: {
      description?: string;
      [key: string]: any;
    };
    links?: {
      website?: string;
      pricing?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface Ranking {
  id: string;
  tool_id: string;
  period: string;
  position: number;
  position_change?: number;
  score: number;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}