import type { Dictionary } from "./get-dictionary";
import { EXPECTED_DICTIONARY_STRUCTURE } from "./expected-structure";

/**
 * Deep merge two objects, filling missing properties with fallback values
 */
function deepMergeWithFallbacks(target: any, source: any, path: string = ""): any {
  if (!source || typeof source !== "object") {
    return target;
  }

  const result: any = { ...target };

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in result)) {
      // Property is missing, create fallback
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        // For objects, create a structure with fallback values
        result[key] = createFallbackStructure(source[key], currentPath);
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
      result[key] = deepMergeWithFallbacks(result[key], source[key], currentPath);
    }
  }

  return result;
}

/**
 * Create a fallback structure for missing objects
 */
function createFallbackStructure(template: any, basePath: string): any {
  if (!template || typeof template !== "object") {
    return `[${basePath} undefined]`;
  }

  const result: any = {};

  for (const key in template) {
    const path = `${basePath}.${key}`;

    if (template[key] && typeof template[key] === "object" && !Array.isArray(template[key])) {
      result[key] = createFallbackStructure(template[key], path);
    } else {
      result[key] = `[${path} undefined]`;
    }
  }

  return result;
}

/**
 * Process dictionary to ensure it's complete and serializable
 */
export async function processDictionary(dict: unknown, _locale: string): Promise<Dictionary> {
  try {
    // Start with the expected structure as our base
    const completeDict = deepMergeWithFallbacks(dict || {}, EXPECTED_DICTIONARY_STRUCTURE);

    // Ensure it's serializable (no functions, symbols, etc.)
    return JSON.parse(JSON.stringify(completeDict));
  } catch (error) {
    console.error("Error processing dictionary:", error);
    // Return the expected structure with all fallback values
    return createFallbackStructure(EXPECTED_DICTIONARY_STRUCTURE, "") as Dictionary;
  }
}
