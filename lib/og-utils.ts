/**
 * Utilities for generating Open Graph image URLs
 */

export interface ToolOGParams {
  name: string;
  category: string;
  rank?: number;
  score?: number;
  logo?: string;
  company?: string;
}

export interface RankingOGParams {
  title?: string;
  period?: string;
  topTools?: string[];
  totalTools?: number;
}

export interface GeneralOGParams {
  title: string;
  subtitle?: string;
  description?: string;
  type?: string;
  rank?: number;
  logo?: string;
}

/**
 * Generate OG image URL for tool pages
 */
export function generateToolOGImageUrl(params: ToolOGParams, baseUrl?: string): string {
  const base = baseUrl || process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";
  const searchParams = new URLSearchParams();

  searchParams.set("name", params.name);
  searchParams.set("category", params.category);

  if (params.rank) {
    searchParams.set("rank", params.rank.toString());
  }
  if (params.score) {
    searchParams.set("score", Math.round(params.score).toString());
  }
  if (params.logo) {
    searchParams.set("logo", params.logo);
  }
  if (params.company) {
    searchParams.set("company", params.company);
  }

  return `${base}/api/og/tool?${searchParams.toString()}`;
}

/**
 * Generate OG image URL for ranking pages
 */
export function generateRankingOGImageUrl(params: RankingOGParams, baseUrl?: string): string {
  const base = baseUrl || process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";
  const searchParams = new URLSearchParams();

  if (params.title) {
    searchParams.set("title", params.title);
  }
  if (params.period) {
    searchParams.set("period", params.period);
  }
  if (params.topTools && params.topTools.length > 0) {
    searchParams.set("topTools", params.topTools.join(","));
  }
  if (params.totalTools) {
    searchParams.set("totalTools", params.totalTools.toString());
  }

  return `${base}/api/og/ranking?${searchParams.toString()}`;
}

/**
 * Generate OG image URL for general pages
 */
export function generateGeneralOGImageUrl(params: GeneralOGParams, baseUrl?: string): string {
  const base = baseUrl || process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";
  const searchParams = new URLSearchParams();

  searchParams.set("title", params.title);
  if (params.subtitle) {
    searchParams.set("subtitle", params.subtitle);
  }
  if (params.description) {
    searchParams.set("description", params.description);
  }
  if (params.type) {
    searchParams.set("type", params.type);
  }
  if (params.rank) {
    searchParams.set("rank", params.rank.toString());
  }
  if (params.logo) {
    searchParams.set("logo", params.logo);
  }

  return `${base}/api/og?${searchParams.toString()}`;
}

/**
 * Sanitize text for URL parameters
 */
export function sanitizeForUrl(text: string): string {
  return text
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, " ") // Normalize whitespace
    .substring(0, 100); // Limit length
}

/**
 * Get fallback OG image URL
 */
export function getFallbackOGImageUrl(baseUrl?: string): string {
  const base = baseUrl || process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";
  return `${base}/api/og?title=AI%20Power%20Rankings&subtitle=Developer%20Tool%20Intelligence`;
}
