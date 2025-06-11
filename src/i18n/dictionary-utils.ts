import type { Dictionary } from "./get-dictionary";
import { EXPECTED_DICTIONARY_STRUCTURE } from "./expected-structure";

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
      console.warn(`🌐 Missing translation [${locale}]: ${path}`);
    } else {
      // Client-side logging
      console.warn(`🌐 Missing translation [${locale}]: ${path}`);
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
  target: any,
  source: any,
  path: string = "",
  locale: string = "en"
): any {
  if (!source || typeof source !== "object") {
    return target;
  }

  const result: any = { ...target };

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in result)) {
      // Property is missing, log it and create fallback
      logMissingTranslation(currentPath, locale);

      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        // For objects, create a structure with fallback values
        result[key] = createFallbackStructure(source[key], currentPath, locale);
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
      result[key] = deepMergeWithFallbacks(result[key], source[key], currentPath, locale);
    }
  }

  return result;
}

/**
 * Create a fallback structure for missing objects
 */
function createFallbackStructure(template: any, basePath: string, locale: string = "en"): any {
  if (!template || typeof template !== "object") {
    logMissingTranslation(basePath, locale);
    return `[${basePath} undefined]`;
  }

  const result: any = {};

  for (const key in template) {
    const path = `${basePath}.${key}`;

    if (template[key] && typeof template[key] === "object" && !Array.isArray(template[key])) {
      result[key] = createFallbackStructure(template[key], path, locale);
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
    // Start with the expected structure as our base
    const completeDict = deepMergeWithFallbacks(
      dict || {},
      EXPECTED_DICTIONARY_STRUCTURE,
      "",
      locale
    );

    // Ensure it's serializable (no functions, symbols, etc.)
    return JSON.parse(JSON.stringify(completeDict));
  } catch (error) {
    console.error("Error processing dictionary:", error);
    // Return the expected structure with all fallback values
    return createFallbackStructure(EXPECTED_DICTIONARY_STRUCTURE, "", locale) as Dictionary;
  }
}
