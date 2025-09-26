export interface ToolMapping {
  tool_slug: string;
  tool_name: string;
  search_terms: string[];
}

// Default tool mappings - can be extended or replaced with database data
const defaultToolMappings: ToolMapping[] = [
  {
    tool_slug: "github-copilot",
    tool_name: "GitHub Copilot",
    search_terms: ["github copilot", "copilot", "gh copilot"]
  },
  {
    tool_slug: "cursor",
    tool_name: "Cursor",
    search_terms: ["cursor", "cursor ai", "cursor ide"]
  },
  {
    tool_slug: "codeium",
    tool_name: "Codeium",
    search_terms: ["codeium"]
  },
  {
    tool_slug: "tabnine",
    tool_name: "Tabnine",
    search_terms: ["tabnine", "tab nine"]
  },
  {
    tool_slug: "amazon-codewhisperer",
    tool_name: "Amazon CodeWhisperer",
    search_terms: ["codewhisperer", "code whisperer", "amazon codewhisperer", "aws codewhisperer"]
  },
  {
    tool_slug: "replit-ai",
    tool_name: "Replit AI",
    search_terms: ["replit ai", "replit", "repl.it"]
  },
  {
    tool_slug: "cody",
    tool_name: "Cody",
    search_terms: ["cody", "sourcegraph cody", "cody ai"]
  },
  {
    tool_slug: "claude",
    tool_name: "Claude",
    search_terms: ["claude", "claude ai", "anthropic claude", "claude code"]
  },
  {
    tool_slug: "chatgpt",
    tool_name: "ChatGPT",
    search_terms: ["chatgpt", "chat gpt", "openai chatgpt", "gpt-4", "gpt-4o"]
  },
  {
    tool_slug: "gemini",
    tool_name: "Gemini",
    search_terms: ["gemini", "google gemini", "gemini ai", "gemini code"]
  },
  {
    tool_slug: "v0",
    tool_name: "v0",
    search_terms: ["v0", "v0.dev", "vercel v0"]
  },
  {
    tool_slug: "windsurf",
    tool_name: "Windsurf",
    search_terms: ["windsurf", "windsurf ide", "windsurf editor"]
  },
  {
    tool_slug: "bolt",
    tool_name: "Bolt",
    search_terms: ["bolt", "bolt.new", "stackblitz bolt"]
  },
  {
    tool_slug: "lovable",
    tool_name: "Lovable",
    search_terms: ["lovable", "lovable.dev"]
  },
  {
    tool_slug: "devin",
    tool_name: "Devin",
    search_terms: ["devin", "cognition devin", "devin ai"]
  }
];

// In-memory cache for tool mappings
let toolMappingsCache: ToolMapping[] = defaultToolMappings;

/**
 * Set custom tool mappings (useful for loading from database)
 */
export function setToolMappings(mappings: ToolMapping[]) {
  toolMappingsCache = mappings;
}

/**
 * Get current tool mappings
 */
export function getToolMappings(): ToolMapping[] {
  return toolMappingsCache;
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
  const mappings = toolMappingsCache;

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
      if (textLower.includes(`${termLower}'s`) || textLower.includes(`${termLower}'s`)) {
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
  const mapping = toolMappingsCache.find((m: ToolMapping) => m.tool_slug === toolSlug);
  return mapping?.search_terms || [];
}

/**
 * Get tool mapping by slug
 */
export function getToolMapping(toolSlug: string): ToolMapping | null {
  return toolMappingsCache.find((m: ToolMapping) => m.tool_slug === toolSlug) || null;
}
