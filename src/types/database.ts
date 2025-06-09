export interface Tool {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory?: string;
  description?: string;
  website_url?: string;
  github_repo?: string;
  company_name?: string;
  founded_date?: string;
  pricing_model?: 'free' | 'freemium' | 'paid' | 'enterprise';
  license_type?: 'open-source' | 'proprietary' | 'commercial';
  status: 'active' | 'discontinued' | 'beta';
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCapabilities {
  tool_id: string;
  autonomy_level: number;
  context_window_size?: number;
  supports_multi_file: boolean;
  supported_languages: string[];
  supported_platforms: string[];
  integration_types: string[];
  llm_providers: string[];
  deployment_options: string[];
}

export interface ToolMetrics {
  tool_id: string;
  metric_date: string;
  github_stars: number;
  github_forks: number;
  github_watchers: number;
  github_commits_last_month: number;
  github_contributors: number;
  github_last_commit?: string;
  funding_total: number;
  valuation_latest: number;
  estimated_users: number;
  social_mentions_30d: number;
  sentiment_score: number;
  community_size: number;
  release_frequency_days?: number;
}

export interface Ranking {
  id: string;
  period: string;
  tool_id: string;
  position: number;
  score: number;
  movement: 'up' | 'down' | 'same' | 'new' | 'returning';
  movement_positions: number;
  previous_position?: number;
  score_breakdown: Record<string, number>;
  algorithm_version: string;
  created_at: string;
}

export interface RankingPeriod {
  period: string;
  display_name: string;
  publication_date: string;
  tools_count: number;
  algorithm_version: string;
  editorial_summary?: string;
  major_changes: Record<string, any>;
  is_current: boolean;
}