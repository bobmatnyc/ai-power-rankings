// JSON Database Schema Definitions

export interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  company_id?: string;
  launch_date?: string; // Actual launch/release date of the tool
  info: {
    summary: string;
    description: string;
    website: string;
    features: string[];
    technical: {
      context_window?: number;
      supported_languages?: number;
      has_api?: boolean;
      multi_file_support?: boolean;
      languages?: string[];
    };
    business: {
      pricing_model?: string;
      business_model?: string;
      base_price?: number;
      enterprise_pricing?: boolean;
      free_tier?: boolean;
      pricing_details?: Record<string, string>;
    };
    metrics: {
      github_stars?: number;
      github_contributors?: number;
      estimated_users?: number;
      monthly_arr?: number;
      valuation?: number;
      funding_total?: number;
      last_funding_date?: string;
      swe_bench_score?: number;
    };
    company?: {
      id: string;
      name: string;
      website?: string;
      founded?: string;
      size?: string;
    };
  };
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface RankingPeriod {
  period: string; // "2025-06"
  date?: string; // "2025-06-01" - Used by v7 algorithm
  algorithm_version: string;
  algorithm_name?: string; // e.g., "Enhanced Sentiment Impact"
  is_current?: boolean; // Optional for v7 algorithm
  created_at?: string; // Optional for v7 algorithm
  preview_date?: string;
  rankings: RankingEntry[];
  metadata?: {
    total_tools: number;
    calculation_date: string;
    notes?: string;
  };
}

export interface RankingEntry {
  tool_id: string;
  tool_name: string;
  position?: number; // Legacy field for backward compatibility
  rank?: number; // New field used by v7 algorithm
  score: number;
  tier?: "S" | "A" | "B" | "C" | "D";
  factor_scores: {
    // Snake case for backward compatibility
    agentic_capability?: number;
    innovation?: number;
    technical_performance?: number;
    developer_adoption?: number;
    market_traction?: number;
    business_sentiment?: number;
    development_velocity?: number;
    platform_resilience?: number;
    // Camel case for v7 algorithm
    agenticCapability?: number;
    technicalPerformance?: number;
    developerAdoption?: number;
    marketTraction?: number;
    businessSentiment?: number;
    developmentVelocity?: number;
    platformResilience?: number;
    technicalCapability?: number;
    communitySentiment?: number;
  };
  sentiment_analysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
    crisisDetection?: {
      isInCrisis: boolean;
      severityScore: number;
      negativePeriods: number;
      impactMultiplier: number;
    };
  };
  movement?: {
    previous_position?: number;
    change: number;
    direction: "up" | "down" | "same" | "new";
  };
  change_analysis?: {
    primary_reason?: string;
    narrative_explanation?: string;
  };
  algorithm_version?: string;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  author?: string;
  published_date: string;
  date?: string; // Alternative date field used in /by-month/ directory
  source?: string;
  source_url?: string;
  tags?: string[];
  tool_mentions?: string[]; // tool IDs mentioned
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  description?: string;
  website?: string;
  founded?: string;
  headquarters?: string;
  size?: string;
  funding_total?: number;
  last_funding_round?: string;
  investors?: string[];
  created_at: string;
  updated_at: string;
}

export interface Subscriber {
  id: string;
  email: string;
  status: "pending" | "verified" | "unsubscribed";
  verification_token?: string;
  verified_at?: string;
  unsubscribed_at?: string;
  created_at: string;
  updated_at: string;
  preferences?: {
    frequency?: string;
    categories?: string[];
  };
  metadata?: {
    source?: string;
    user_agent?: string;
    ip_address?: string;
    firstName?: string;
    lastName?: string;
  };
}

// Database structure types
export interface ToolsData {
  tools: Tool[];
  index: {
    byId: Record<string, Tool>;
    bySlug: Record<string, Tool>;
    byCategory: Record<string, string[]>; // category -> tool IDs
  };
  metadata: {
    total: number;
    last_updated: string;
    version: string;
  };
}

export interface RankingsData {
  periods: string[]; // List of available periods
  current: string; // Current period
  metadata: {
    last_updated: string;
    version: string;
  };
}

export interface IngestionReport {
  id: string;
  filename: string;
  status: "completed" | "partial" | "failed";
  total_items: number;
  processed_items: number;
  failed_items: number;
  duplicate_items: number;
  new_tools_created: number;
  new_companies_created: number;
  pending_tools_created?: number;
  ranking_preview_generated?: boolean;
  processing_log: string;
  errors: Array<{
    item_index?: number;
    item_title?: string;
    article_id?: string;
    error: string;
  }>;
  ingested_news_ids: string[];
  created_tools: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  created_companies: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  ranking_changes_preview?: any;
  file_size?: number;
  processing_duration?: number;
  created_at: string;
  updated_at: string;
}

export interface NewsData {
  articles: NewsArticle[];
  ingestion_reports: IngestionReport[];
  index: {
    byId: Record<string, NewsArticle>;
    bySlug: Record<string, NewsArticle>;
    byDate: Record<string, string[]>; // YYYY-MM -> article IDs
    reportsByStatus: Record<string, string[]>; // status -> report IDs
  };
  metadata: {
    total: number;
    last_updated: string;
    version: string;
    ingestion_reports_count: number;
  };
}

export interface CompaniesData {
  companies: Company[];
  index: {
    byId: Record<string, Company>;
    bySlug: Record<string, Company>;
  };
  metadata: {
    total: number;
    last_updated: string;
    version: string;
  };
}

export interface SubscribersData {
  subscribers: Subscriber[];
  index: {
    byId: Record<string, Subscriber>;
    byEmail: Record<string, Subscriber>;
    byStatus: Record<string, string[]>; // status -> subscriber IDs
  };
  metadata: {
    total: number;
    verified: number;
    pending: number;
    unsubscribed: number;
    last_updated: string;
    version: string;
  };
}

export interface SiteSettings {
  id: "settings";
  site_name: string;
  description: string;
  contact_email: string;
  algorithm_version: string;
  updated_at: string;
  created_at: string;
}

export interface SiteSettingsData {
  settings: SiteSettings;
  metadata: {
    last_updated: string;
    version: string;
  };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    version: string;
  };
}
