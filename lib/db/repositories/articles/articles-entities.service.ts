/**
 * Articles Entities Service
 * Handles auto-creation of tools and companies from article processing
 */

import { eq } from "drizzle-orm";
import { companies, tools } from "@/lib/db/schema";
import { getDb } from "@/lib/db/connection";

type DbInstance = ReturnType<typeof getDb>;

export interface AutoToolInput {
  name: string;
  slug: string;
  category: string;
  companyId?: string;
}

export interface AutoToolResult {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export interface AutoCompanyInput {
  name: string;
  slug: string;
  website?: string;
}

export interface AutoCompanyResult {
  id: string;
  name: string;
  slug: string;
}

export class ArticlesEntitiesService {
  private db: DbInstance;

  constructor() {
    this.db = getDb();
  }

  private ensureConnection(): void {
    if (!this.db) {
      this.db = getDb();
      if (!this.db) {
        throw new Error("Database connection not available");
      }
    }
  }

  // Guard 1: Only create auto-tools for known-good taxonomy categories.
  // Derived from the categories actually used by the live taxonomy, minus the
  // noise buckets ("other", "llm", "chat") that recurringly attract non-tools.
  // See docs/research/non-ai-tools-deletion-2026-03-15.md (issue #79/#80).
  private static readonly VALID_AUTO_TOOL_CATEGORIES = new Set([
    "code-editor",
    "code-assistant",
    "code-completion",
    "code-generation",
    "code-review",
    "autonomous-agent",
    "ide-assistant",
    "proprietary-ide",
    "app-builder",
    "open-source-framework",
    "testing-tool",
    "devops-assistant",
  ]);

  // Guard 2: Blocklist of non-AI-tool slugs. Maintainable constant — extend as
  // new noise is discovered. Includes the common non-AI tech names that surface
  // in AI articles plus every slug called out in the March 2026 deletion report.
  private static readonly AUTO_TOOL_SLUG_BLOCKLIST = new Set([
    // Generic dev tooling / infra that is not an AI coding tool
    "playwright", "docker", "gitlab", "github", "jira", "vs-code", "vscode",
    "youtube", "stackoverflow", "stack-overflow", "apache-iceberg", "iceberg",
    "tower", "tower-python-sdk", "gws", "vib-os", "npm", "pip", "homebrew",
    "terraform", "kubernetes", "k8s", "jenkins", "circleci", "vercel", "netlify",
    "aws", "gcp", "azure", "postgresql", "mysql", "mongodb", "redis",
    "react", "vue", "angular", "svelte", "nextjs", "typescript", "python",
    "rust", "golang", "java", "nodejs", "fastapi", "django", "rails",
    // Non-tools from docs/research/non-ai-tools-deletion-2026-03-15.md
    "ai-coding-tools", "armadin-autonomous-cybersecurity-agents", "potpie",
    // Known garbage entity fragment (issue #80)
    "anthropic-s-claude-agent",
  ]);

  // Guard 2b: Structural slug patterns that indicate a bad entity fragment
  // rather than a real product name (possessives, leading articles).
  private static readonly INVALID_SLUG_PATTERNS: readonly RegExp[] = [
    /^[a-z0-9]+-s-[a-z]/, // possessive: "anthropic-s-claude-agent", "openai-s-agent"
    /^(a|an|the)-/, // leading article: "the-new-agent"
  ];

  // Guard 2b: A runaway multi-word slug is almost always a descriptive phrase
  // extracted from prose, not a product name. Legit tools with 4 segments exist
  // (e.g. "gitlab-duo-agent-platform"), so the threshold is deliberately high.
  private static readonly MAX_SLUG_SEGMENTS = 5;

  /**
   * Normalize a display name into a slug candidate for blocklist matching.
   */
  private static normalizeSlug(value: string): string {
    return value
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  /**
   * Validate an auto-tool candidate against all creation guards.
   * Returns a human-readable rejection reason, or null when the candidate is
   * acceptable for auto-creation. Pure/testable — performs no I/O.
   */
  static getAutoToolRejectionReason(toolData: AutoToolInput): string | null {
    const normalizedSlug = ArticlesEntitiesService.normalizeSlug(toolData.name);
    const candidateSlugs = [normalizedSlug, toolData.slug];

    // Guard 2: explicit blocklist
    for (const slug of candidateSlugs) {
      if (ArticlesEntitiesService.AUTO_TOOL_SLUG_BLOCKLIST.has(slug)) {
        return `slug "${slug}" is blocklisted`;
      }
    }

    // Guard 2b: structural slug validation (possessives / articles)
    for (const slug of candidateSlugs) {
      for (const pattern of ArticlesEntitiesService.INVALID_SLUG_PATTERNS) {
        if (pattern.test(slug)) {
          return `slug "${slug}" matches invalid entity pattern ${pattern}`;
        }
      }
    }

    // Guard 2b: runaway multi-word garbage
    for (const slug of candidateSlugs) {
      if (slug.split("-").filter(Boolean).length >= ArticlesEntitiesService.MAX_SLUG_SEGMENTS) {
        return `slug "${slug}" has too many segments (likely a descriptive phrase, not a product)`;
      }
    }

    // Guard 1: category allowlist
    if (!ArticlesEntitiesService.VALID_AUTO_TOOL_CATEGORIES.has(toolData.category)) {
      return `category "${toolData.category}" not in allowlist`;
    }

    return null;
  }

  /**
   * Create a new tool (auto-created from article)
   * Returns null if the tool fails category or slug validation guards.
   */
  async createAutoTool(
    toolData: AutoToolInput,
    articleId: string
  ): Promise<AutoToolResult | null> {
    // Guards 1/2/2b: reject known noise before any DB work
    const rejectionReason = ArticlesEntitiesService.getAutoToolRejectionReason(toolData);
    if (rejectionReason) {
      console.info(
        `[ArticlesRepo] Skipping auto-tool creation for "${toolData.name}" — ${rejectionReason}`
      );
      return null;
    }

    this.ensureConnection();
    if (!this.db) throw new Error("Database not connected");

    const result = await this.db
      .insert(tools)
      .values({
        name: toolData.name,
        slug: toolData.slug,
        category: toolData.category,
        companyId: toolData.companyId,
        status: "pending_review", // Guard 3: not publicly visible until manually approved
        data: {
          autoCreated: true,
          createdByArticleId: articleId,
          firstMentionedDate: new Date().toISOString(),
        },
      })
      .returning();
    if (!result || result.length === 0) {
      throw new Error("Failed to create tool");
    }
    return result[0] as AutoToolResult;
  }

  /**
   * Create a new company (auto-created from article)
   */
  async createAutoCompany(
    companyData: AutoCompanyInput,
    articleId: string
  ): Promise<AutoCompanyResult> {
    this.ensureConnection();
    if (!this.db) throw new Error("Database not connected");

    try {
      // Ensure slug is valid and unique
      const validSlug = companyData.slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check if company already exists
      const existing = await this.db
        .select()
        .from(companies)
        .where(eq(companies.slug, validSlug))
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[ArticlesRepo] Company ${validSlug} already exists, returning existing`);
        return existing[0] as AutoCompanyResult;
      }

      const result = await this.db
        .insert(companies)
        .values({
          slug: validSlug,
          name: companyData.name,
          data: {
            website: companyData.website || null,
            autoCreated: true,
            createdByArticleId: articleId,
            firstMentionedDate: new Date().toISOString(),
          },
        })
        .returning();

      if (!result || result.length === 0) {
        throw new Error(`Failed to create company: ${companyData.name}`);
      }

      console.log(`[ArticlesRepo] Created new company: ${validSlug}`);
      return result[0] as AutoCompanyResult;
    } catch (error) {
      console.error("[ArticlesRepo] Error creating company:", error);
      throw new Error(
        `Failed to create company ${companyData.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}
