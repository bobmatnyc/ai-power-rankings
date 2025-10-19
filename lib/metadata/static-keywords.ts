/**
 * Static SEO Keywords for AI Power Ranking
 *
 * Pre-generated tool names and keywords for metadata generation.
 * This eliminates the need for API calls during metadata generation,
 * improving First Contentful Paint (FCP) by 300-500ms.
 *
 * To regenerate: npm run generate-metadata
 * Last updated: 2025-10-14
 *
 * @module lib/metadata/static-keywords
 */

/**
 * Pre-generated list of active AI tools for SEO keywords.
 * These are the top tools currently tracked in our rankings.
 *
 * Note: This list is manually curated for the most popular tools.
 * For the complete and up-to-date list, see data/json/tools/tools.json
 */
export const STATIC_TOOL_KEYWORDS = [
  "Claude Code",
  "GitHub Copilot",
  "Cursor",
  "Windsurf",
  "ChatGPT Canvas",
  "v0",
  "Bolt.new",
  "Replit Agent",
  "Claude Dev",
  "Aider",
  "Kiro",
  "OpenAI Codex",
  "Greptile",
  "Google Gemini CLI",
  "Graphite",
  "Qwen Code",
  "GitLab Duo",
  "Amazon CodeWhisperer",
  "Tabnine",
  "Cody by Sourcegraph",
  "Supermaven",
  "Continue.dev",
  "Phind",
  "Devin",
  "Codium AI",
  "JetBrains AI Assistant",
  "Replit Ghostwriter",
  "Pieces for Developers",
].join(", ");

/**
 * Category-specific keywords for enhanced SEO
 */
export const CATEGORY_KEYWORDS = [
  "AI coding assistant",
  "AI code editor",
  "autonomous coding agent",
  "AI app builder",
  "code completion AI",
  "AI pair programming",
  "developer AI tools",
  "coding AI",
  "AI IDE",
  "agentic AI coding",
].join(", ");

/**
 * Comparison keywords for common tool comparisons
 */
export const COMPARISON_KEYWORDS = [
  "Claude Code vs GitHub Copilot",
  "Cursor vs Windsurf",
  "AI coding tools comparison",
  "best AI coding assistant 2025",
  "AI developer tools ranking",
].join(", ");

/**
 * Get all SEO keywords combined
 *
 * @param baseKeywords - Keywords from i18n dictionary
 * @returns Combined keyword string for metadata
 */
export function getAllKeywords(baseKeywords: string = ""): string {
  return [
    baseKeywords,
    STATIC_TOOL_KEYWORDS,
    CATEGORY_KEYWORDS,
    COMPARISON_KEYWORDS,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Dynamic keyword generation from database (for build-time scripts)
 *
 * This function is meant to be used in build-time scripts to regenerate
 * the static keywords from the database. Not used in runtime metadata generation.
 *
 * @example
 * // In scripts/generate-static-metadata.ts
 * import { generateStaticKeywords } from '@/lib/metadata/static-keywords';
 * const keywords = await generateStaticKeywords();
 */
export async function generateStaticKeywords(): Promise<string> {
  try {
    // Only import database connection in Node.js environment
    if (typeof window === 'undefined') {
      const { db } = await import('@/lib/db');
      const { tools } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      if (!db) {
        console.warn('[Static Keywords] Database not available, using static fallback');
        return '';
      }

      const activeTools = await db
        .select({ name: tools.name })
        .from(tools)
        .where(eq(tools.status, 'active'))
        .limit(100);

      return activeTools.map(t => t.name).join(', ');
    }
  } catch (error) {
    console.error('[Static Keywords] Failed to generate keywords from DB:', error);
  }

  // Fallback to hardcoded keywords
  return STATIC_TOOL_KEYWORDS;
}
