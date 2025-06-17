import Ajv from "ajv";
import addFormats from "ajv-formats";
import newsItemSchema from "../../schemas/news-item.schema.json";
import { logger } from "./logger";

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Compile the schema
const validateNewsItemSchema = ajv.compile(newsItemSchema);

export interface NewsItem {
  id: string;
  title: string;
  summary?: string;
  source: {
    name: string;
    url: string;
    author?: string;
  };
  published_date: string;
  discovered_date?: string;
  type: string;
  tools_mentioned: Array<{
    tool_id: string;
    relevance: "primary" | "secondary" | "mentioned";
    sentiment?: "positive" | "neutral" | "negative" | "mixed";
  }>;
  metrics_mentioned?: Array<{
    tool_id: string;
    metric_key: string;
    value: number | string | boolean | object;
    unit?: string;
    comparison?: {
      previous_value?: number | string;
      change_type?: "increase" | "decrease" | "stable";
      change_percentage?: number;
    };
  }>;
  tags?: string[];
  impact_assessment?: {
    importance?: "critical" | "high" | "medium" | "low";
    market_impact?: "major" | "moderate" | "minor" | "none";
    ranking_impact?: Array<{
      tool_id: string;
      impact_type: "positive" | "negative" | "neutral";
      factors_affected?: string[];
    }>;
  };
  content?: {
    full_text?: string;
    key_quotes?: Array<{
      text: string;
      speaker?: string;
      context?: string;
    }>;
    data_points?: Array<{
      description: string;
      value: number | string | object;
      source?: string;
    }>;
  };
  verification?: {
    status?: "verified" | "unverified" | "disputed" | "retracted";
    confidence_score?: number;
    fact_checked?: boolean;
    corroborating_sources?: Array<{
      name?: string;
      url?: string;
    }>;
  };
  metadata?: {
    language?: string;
    region?: string;
    exclusive?: boolean;
    embargo_until?: string;
    related_news_ids?: string[];
    is_company_announcement?: boolean;
    source_credibility?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    message: string;
    path: string;
    keyword: string;
  }>;
}

export function validateNewsItem(item: unknown): ValidationResult {
  const valid = validateNewsItemSchema(item);

  if (!valid) {
    const errors =
      validateNewsItemSchema.errors?.map((err) => ({
        message: err.message || "Unknown error",
        path: err.instancePath,
        keyword: err.keyword,
      })) || [];

    logger.warn("News item validation failed:", errors);

    return {
      valid: false,
      errors,
    };
  }

  return { valid: true };
}

export function validateNewsItems(items: unknown[]): {
  valid: NewsItem[];
  invalid: Array<{ item: unknown; errors: ValidationResult["errors"] }>;
} {
  const valid: NewsItem[] = [];
  const invalid: Array<{ item: unknown; errors: ValidationResult["errors"] }> = [];

  for (const item of items) {
    const result = validateNewsItem(item);
    if (result.valid) {
      valid.push(item as NewsItem);
    } else {
      invalid.push({ item, errors: result.errors });
    }
  }

  return { valid, invalid };
}
