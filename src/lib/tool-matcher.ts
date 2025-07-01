import toolTermsMapping from "../../data/json/tool-terms-mapping.json";

export interface ToolMapping {
  tool_slug: string;
  tool_name: string;
  search_terms: string[];
}

/**
 * Matches text against tool search terms to find the best matching tool
 * Returns the tool slug if a match is found, null otherwise
 */
export function findToolByText(text: string): string | null {
  if (!text) {
    return null;
  }

  const textLower = text.toLowerCase();
  const mappings = toolTermsMapping.mappings as ToolMapping[];

  // Sort mappings by specificity (longer terms first to match more specific tools)
  const sortedMappings = [...mappings].sort((a, b) => {
    const aMaxLength = Math.max(...a.search_terms.map((t) => t.length));
    const bMaxLength = Math.max(...b.search_terms.map((t) => t.length));
    return bMaxLength - aMaxLength;
  });

  // Find the first matching tool
  for (const mapping of sortedMappings) {
    for (const term of mapping.search_terms) {
      const termLower = term.toLowerCase();

      // Check for exact word match (with word boundaries)
      const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(termLower)}\\b`, "i");
      if (wordBoundaryRegex.test(textLower)) {
        return mapping.tool_slug;
      }

      // Check for possessive forms
      if (textLower.includes(termLower + "'s") || textLower.includes(termLower + "'s")) {
        return mapping.tool_slug;
      }
    }
  }

  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get all search terms for a specific tool
 */
export function getToolSearchTerms(toolSlug: string): string[] {
  const mapping = toolTermsMapping.mappings.find((m: ToolMapping) => m.tool_slug === toolSlug);
  return mapping?.search_terms || [];
}

/**
 * Get tool mapping by slug
 */
export function getToolMapping(toolSlug: string): ToolMapping | null {
  return toolTermsMapping.mappings.find((m: ToolMapping) => m.tool_slug === toolSlug) || null;
}
