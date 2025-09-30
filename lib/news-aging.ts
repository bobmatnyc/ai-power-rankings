/**
 * News Aging and Decay Functions
 *
 * Implements asymptotic decay curve for news impact over time
 * - 50% decay after 1 year
 * - Increasing decay rate as news gets older
 * - PR discount for company announcements
 */

import { differenceInDays } from "date-fns";

// Constants for decay calculation
const HALF_LIFE_DAYS = 365; // 50% decay after 1 year
const PR_DISCOUNT_FACTOR = 0.7; // 30% discount for PR/company announcements

/**
 * Calculate the age-based decay factor for a news article
 * Uses an asymptotic decay curve: factor = 1 / (1 + (days / halfLife)^power)
 *
 * @param publishedDate - The date the news was published
 * @param referenceDate - The reference date to calculate age from (defaults to now)
 * @returns Decay factor between 0 and 1
 */
export function calculateNewsDecay(
  publishedDate: Date | string,
  referenceDate: Date = new Date()
): number {
  const published = typeof publishedDate === "string" ? new Date(publishedDate) : publishedDate;
  const daysOld = Math.max(0, differenceInDays(referenceDate, published));

  // Asymptotic decay curve with power of 1.5 for increasing decay rate
  // This gives us approximately 50% decay at 365 days
  const decayFactor = 1 / (1 + (daysOld / HALF_LIFE_DAYS) ** 1.5);

  return decayFactor;
}

/**
 * Calculate the effective impact of a news article considering:
 * - Age-based decay
 * - PR discount for company announcements
 * - Source credibility
 *
 * @param article - The news article object
 * @param baseImpact - The base impact score (before decay/discounts)
 * @param referenceDate - The reference date for age calculation
 * @returns Adjusted impact score
 */
export function calculateEffectiveNewsImpact(
  article: {
    published_date?: string;
    date?: string;
    source?: { name: string } | string;
    type?: string;
    metadata?: {
      is_company_announcement?: boolean;
      source_credibility?: number;
    };
  },
  baseImpact: number,
  referenceDate: Date = new Date()
): number {
  // Start with base impact
  let effectiveImpact = baseImpact;

  // Apply age-based decay
  const articleDate = article.published_date || article.date || "";
  const ageFactor = calculateNewsDecay(articleDate, referenceDate);
  effectiveImpact *= ageFactor;

  // Apply PR discount if it's a company announcement
  const sourceName =
    typeof article.source === "string" ? article.source : article.source?.name || "";
  const isCompanyAnnouncement =
    article.metadata?.is_company_announcement ||
    article.type === "company_news" ||
    sourceName.includes("Blog") ||
    sourceName.includes("Press Release") ||
    sourceName.includes("Company News");

  if (isCompanyAnnouncement) {
    effectiveImpact *= PR_DISCOUNT_FACTOR;
  }

  // Apply source credibility modifier if available
  if (article.metadata?.source_credibility) {
    effectiveImpact *= article.metadata.source_credibility;
  }

  return effectiveImpact;
}

/**
 * Get decay factor for different time periods (for visualization/debugging)
 */
export function getDecayFactorsOverTime(): Array<{
  days: number;
  factor: number;
  percentage: string;
}> {
  const timePoints = [0, 7, 30, 90, 180, 365, 730, 1095]; // 0d, 1w, 1m, 3m, 6m, 1y, 2y, 3y

  return timePoints.map((days) => ({
    days,
    factor: calculateNewsDecay(new Date(Date.now() - days * 24 * 60 * 60 * 1000)),
    percentage: `${(calculateNewsDecay(new Date(Date.now() - days * 24 * 60 * 60 * 1000)) * 100).toFixed(1)}%`,
  }));
}

/**
 * Source credibility scores for known sources
 */
export const SOURCE_CREDIBILITY: Record<string, number> = {
  // Tier 1: Highly credible tech news sources
  TechCrunch: 1.0,
  "The Verge": 1.0,
  "Ars Technica": 1.0,
  "MIT Technology Review": 1.0,
  "IEEE Spectrum": 1.0,
  Bloomberg: 0.95,
  Reuters: 0.95,
  "The Information": 0.95,
  Wired: 0.9,

  // Tier 2: Credible but potentially biased
  VentureBeat: 0.85,
  Forbes: 0.85,
  "Business Insider": 0.85,
  ZDNet: 0.85,
  InfoWorld: 0.85,

  // Tier 3: Mixed credibility
  Medium: 0.7,
  "Hacker News": 0.75,
  Reddit: 0.65,

  // Company sources (inherently biased)
  "Company Blog": 0.6,
  "Press Release": 0.6,
  "GitHub Blog": 0.75, // More technical, less marketing

  // Social media (lowest credibility)
  Twitter: 0.5,
  LinkedIn: 0.55,
};

/**
 * Get source credibility score
 */
export function getSourceCredibility(sourceName: string): number {
  // Check exact match first
  if (SOURCE_CREDIBILITY[sourceName]) {
    return SOURCE_CREDIBILITY[sourceName];
  }

  // Check partial matches
  for (const [source, credibility] of Object.entries(SOURCE_CREDIBILITY)) {
    if (sourceName.includes(source) || source.includes(sourceName)) {
      return credibility;
    }
  }

  // Default credibility for unknown sources
  return 0.75;
}
