import "server-only";
import type { Locale } from "./config";
import { processDictionary } from "./dictionary-utils";

// We enumerate all dictionaries here for better linting and typescript support
// We also get the default import for cleaner types
const dictionaries = {
  en: () => import("./dictionaries/en.json").then((module) => module.default),
  de: () => import("./dictionaries/de.json").then((module) => module.default),
  fr: () => import("./dictionaries/fr.json").then((module) => module.default),
  it: () => import("./dictionaries/it.json").then((module) => module.default),
  ja: () => import("./dictionaries/ja.json").then((module) => module.default),
  ko: () => import("./dictionaries/ko.json").then((module) => module.default),
  uk: () => import("./dictionaries/uk.json").then((module) => module.default),
  hr: () => import("./dictionaries/hr.json").then((module) => module.default),
  zh: () => import("./dictionaries/zh.json").then((module) => module.default),
  es: () => import("./dictionaries/es.json").then((module) => module.default),
};

// Define the raw dictionary type based on the actual JSON structure
type RawDictionary = typeof import("./dictionaries/en.json");

// In-memory cache for processed dictionaries (immutable during runtime)
// This eliminates 50-150ms dictionary processing on every request
const dictionaryCache = new Map<Locale, RawDictionary>();

export const getDictionary = async (locale: Locale): Promise<RawDictionary> => {
  try {
    // Check cache first - dictionaries are immutable so we can safely cache them
    if (dictionaryCache.has(locale)) {
      console.log("[getDictionary] Using cached dictionary for locale:", locale);
      return dictionaryCache.get(locale)!;
    }

    console.log("[getDictionary] Loading dictionary for locale:", locale);
    const dict = await (dictionaries[locale]?.() ?? dictionaries.en());
    console.log("[getDictionary] Dictionary loaded successfully for locale:", locale);

    // Process the dictionary to ensure it's complete and serializable
    const processed = await processDictionary(dict, locale);
    console.log("[getDictionary] Dictionary processed successfully for locale:", locale);

    // Cache the processed result for subsequent requests
    const processedDict = processed as RawDictionary;
    dictionaryCache.set(locale, processedDict);
    console.log("[getDictionary] Cached dictionary for locale:", locale);

    return processedDict;
  } catch (error) {
    console.error("[getDictionary] Error loading dictionary for locale:", locale, error);
    console.error("[getDictionary] Error stack:", error instanceof Error ? error.stack : "No stack");

    // Try to fall back to English dictionary
    try {
      console.log("[getDictionary] Falling back to English dictionary");

      // Check if English is in cache
      if (dictionaryCache.has("en")) {
        return dictionaryCache.get("en")!;
      }

      const fallbackDict = await dictionaries.en();
      const processedFallback = (await processDictionary(fallbackDict, "en")) as RawDictionary;
      dictionaryCache.set("en", processedFallback);
      return processedFallback;
    } catch (fallbackError) {
      console.error("[getDictionary] Failed to load fallback dictionary:", fallbackError);
      throw fallbackError;
    }
  }
};

export type Dictionary = RawDictionary;