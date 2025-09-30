import { EXPECTED_DICTIONARY_STRUCTURE } from "./expected-structure";
import type { Dictionary } from "./get-dictionary";

// Global set to track missing translations (avoid duplicates)
const missingTranslations = new Set<string>();

/**
 * Log missing translation and add to tracking set
 */
function logMissingTranslation(path: string, locale: string) {
  const key = `${locale}:${path}`;
  if (!missingTranslations.has(key)) {
    missingTranslations.add(key);
    if (typeof window === "undefined") {
      // Server-side logging
      console.warn(`Missing translation [${locale}]: ${path}`);
    } else {
      // Client-side logging
      console.warn(`Missing translation [${locale}]: ${path}`);
    }
  }
}

/**
 * Get all missing translations for debugging
 */
export function getMissingTranslations(): string[] {
  return Array.from(missingTranslations).sort();
}

/**
 * Clear missing translations log
 */
export function clearMissingTranslations(): void {
  missingTranslations.clear();
}

/**
 * Deep merge two objects, filling missing properties with fallback values
 */
function deepMergeWithFallbacks(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  path: string = "",
  locale: string = "en"
): Record<string, unknown> {
  if (!source || typeof source !== "object") {
    return target;
  }

  const result: Record<string, unknown> = { ...target };

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in result)) {
      // Property is missing, log it and create fallback
      logMissingTranslation(currentPath, locale);

      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        // For objects, create a structure with fallback values
        result[key] = createFallbackStructure(
          source[key] as Record<string, unknown>,
          currentPath,
          locale
        );
      } else {
        // For primitive values, use the path as fallback
        result[key] = `[${currentPath} undefined]`;
      }
    } else if (
      result[key] &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key]) &&
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      // Both are objects, merge recursively
      result[key] = deepMergeWithFallbacks(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
        currentPath,
        locale
      );
    }
  }

  return result;
}

/**
 * Create a fallback structure for missing objects
 */
function createFallbackStructure(
  template: Record<string, unknown>,
  basePath: string,
  locale: string = "en"
): Record<string, unknown> | string {
  if (!template || typeof template !== "object") {
    logMissingTranslation(basePath, locale);
    return `[${basePath} undefined]`;
  }

  const result: Record<string, unknown> = {};

  for (const key in template) {
    const path = `${basePath}.${key}`;

    if (template[key] && typeof template[key] === "object" && !Array.isArray(template[key])) {
      result[key] = createFallbackStructure(template[key] as Record<string, unknown>, path, locale);
    } else {
      logMissingTranslation(path, locale);
      result[key] = `[${path} undefined]`;
    }
  }

  return result;
}

/**
 * Process dictionary to ensure it's complete and serializable
 */
export async function processDictionary(dict: unknown, locale: string): Promise<Dictionary> {
  try {
    console.log("[processDictionary] Processing dictionary for locale:", locale);

    // Start with the expected structure as our base
    const completeDict = deepMergeWithFallbacks(
      (dict || {}) as Record<string, unknown>,
      EXPECTED_DICTIONARY_STRUCTURE,
      "",
      locale
    );

    // Ensure it's serializable (no functions, symbols, etc.)
    const serialized = JSON.parse(JSON.stringify(completeDict));
    console.log("[processDictionary] Successfully processed dictionary for locale:", locale);
    return serialized;
  } catch (error) {
    console.error("[processDictionary] Error processing dictionary for locale:", locale, error);

    // Provide a minimal safe fallback without complex logger dependencies
    const minimalFallback = {
      common: {
        appName: "AI Power Rankings",
        loading: "Loading...",
        explore: "Explore",
        learnMore: "Learn More",
      },
      home: {
        hero: {
          badge: "Updated Monthly",
          description: "Comprehensive rankings of AI coding tools and assistants",
          exploreButton: "Explore Rankings",
          trendingButton: "View Trending",
        },
        categories: {
          title: "Categories",
          ideDescription: "IDE assistants and extensions",
          editorDescription: "AI-powered code editors",
          builderDescription: "No-code and low-code platforms",
          agentDescription: "Autonomous coding agents",
        },
        methodology: {
          title: "Methodology",
          algorithmTitle: "Algorithm",
          algorithmDescription: "Our ranking algorithm",
          modifiersTitle: "Modifiers",
          modifiersDescription: "Additional factors",
          readMoreButton: "Read More",
          factors: {
            agentic: { name: "Agentic Capability", description: "Autonomous coding ability" },
            innovation: { name: "Innovation", description: "Novel features and approaches" },
            performance: { name: "Performance", description: "Speed and efficiency" },
            traction: { name: "Traction", description: "User adoption and engagement" },
          },
          modifiers: {
            decay: { name: "Decay", description: "Time-based relevance decay" },
            risk: { name: "Risk", description: "Business and technical risks" },
            revenue: { name: "Revenue", description: "Business model sustainability" },
            validation: { name: "Validation", description: "Independent verification" },
          },
        },
      },
      seo: {
        title: "AI Power Rankings",
        description: "Comprehensive rankings of AI coding tools and assistants",
        keywords: "AI tools, coding assistant, artificial intelligence, rankings",
      },
      categories: {
        ideAssistant: "IDE Assistant",
        codeEditor: "Code Editor",
        appBuilder: "App Builder",
        autonomousAgent: "Autonomous Agent",
      },
    };

    console.log("[processDictionary] Using minimal fallback dictionary for locale:", locale);
    return minimalFallback as Dictionary;
  }
}