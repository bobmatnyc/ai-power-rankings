export type ToolCategory =
  | "code-editor"
  | "code-completion"
  | "code-assistant"
  | "testing-tool"
  | "documentation"
  | "deployment"
  | "monitoring"
  | "collaboration";

export type ToolSubcategory =
  | "ai-enhanced-ide"
  | "ide-integration"
  | "standalone-assistant"
  | "automated-testing"
  | "code-review"
  | "api-documentation"
  | "deployment-automation"
  | "performance-monitoring"
  | "team-collaboration";

export interface ToolFilter {
  categories?: ToolCategory[];
  subcategories?: ToolSubcategory[];
  pricingModels?: ("free" | "freemium" | "paid" | "enterprise")[];
  licenseTypes?: ("open-source" | "proprietary" | "commercial")[];
  statuses?: ("active" | "discontinued" | "beta")[];
  minAutonomyLevel?: number;
  maxAutonomyLevel?: number;
  llmProviders?: string[];
}

export interface ToolComparison {
  toolIds: string[];
  compareBy: "metrics" | "capabilities" | "rankings" | "all";
}
