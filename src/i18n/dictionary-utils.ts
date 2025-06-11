import type { Dictionary } from "./get-dictionary";

/**
 * Deep merge two objects, using the first object as the base and filling
 * missing properties from the second object
 */
function deepMerge<T extends Record<string, unknown>>(
  target: Partial<T>,
  source: T,
  path: string = ""
): T {
  const result = { ...target } as T;

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;

    if (!(key in result)) {
      // If key is missing, use the key path as fallback
      if (typeof source[key] === "object" && source[key] !== null) {
        // For nested objects, create a structure with key paths as values
        result[key] = createFallbackObject(
          source[key] as Record<string, unknown>,
          currentPath
        ) as T[Extract<keyof T, string>];
      } else {
        // For primitive values, use the key path as fallback
        result[key] = currentPath as T[Extract<keyof T, string>];
      }
    } else if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
        currentPath
      ) as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Create a fallback object structure where each leaf value is its key path
 */
function createFallbackObject(
  template: Record<string, unknown>,
  basePath: string = ""
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key in template) {
    const path = basePath ? `${basePath}.${key}` : key;

    if (typeof template[key] === "object" && template[key] !== null) {
      result[key] = createFallbackObject(template[key] as Record<string, unknown>, path);
    } else {
      result[key] = path;
    }
  }

  return result;
}

/**
 * Get a complete English dictionary structure with all possible keys
 * This serves as our template for what a complete dictionary should look like
 */
async function getCompleteDictionaryStructure(): Promise<Dictionary> {
  // Import the full English dictionary to use as template
  const enDict = await import("./dictionaries/en.json").then((m) => m.default);

  // Create a complete structure with fallback values for any missing keys
  // This ensures we have a complete template
  return createFallbackObject(enDict) as Dictionary;
}

/**
 * Ensure a dictionary has all required keys, filling missing ones with fallbacks
 */
export async function ensureCompleteDictionary(
  partialDict: Partial<Dictionary>
): Promise<Dictionary> {
  const template = await getCompleteDictionaryStructure();
  return deepMerge(partialDict, template);
}

/**
 * Process dictionary to ensure it's complete and serializable
 * This is the main export that should be used by getDictionary
 */
export async function processDictionary(dict: unknown, _locale: string): Promise<Dictionary> {
  // Ensure the dictionary is complete
  const completeDict = await ensureCompleteDictionary(dict as Partial<Dictionary>);

  // Return a plain object (no proxies, fully serializable)
  return JSON.parse(JSON.stringify(completeDict));
}
