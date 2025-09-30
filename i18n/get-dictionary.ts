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

export const getDictionary = async (locale: Locale): Promise<RawDictionary> => {
  try {
    console.log("[getDictionary] Loading dictionary for locale:", locale);
    const dict = await (dictionaries[locale]?.() ?? dictionaries.en());
    console.log("[getDictionary] Dictionary loaded successfully for locale:", locale);

    // Process the dictionary to ensure it's complete and serializable
    const processed = await processDictionary(dict, locale);
    console.log("[getDictionary] Dictionary processed successfully for locale:", locale);

    return processed as RawDictionary;
  } catch (error) {
    console.error("[getDictionary] Error loading dictionary for locale:", locale, error);
    console.error("[getDictionary] Error stack:", error instanceof Error ? error.stack : "No stack");

    // Try to fall back to English dictionary
    try {
      console.log("[getDictionary] Falling back to English dictionary");
      const fallbackDict = await dictionaries.en();
      return (await processDictionary(fallbackDict, "en")) as RawDictionary;
    } catch (fallbackError) {
      console.error("[getDictionary] Failed to load fallback dictionary:", fallbackError);
      throw fallbackError;
    }
  }
};

export type Dictionary = RawDictionary;