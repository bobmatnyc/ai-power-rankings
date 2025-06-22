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
};

// Define the raw dictionary type based on the actual JSON structure
type RawDictionary = typeof import("./dictionaries/en.json");

export const getDictionary = async (locale: Locale): Promise<RawDictionary> => {
  const dict = await (dictionaries[locale]?.() ?? dictionaries.en());
  // Process the dictionary to ensure it's complete and serializable
  return (await processDictionary(dict, locale)) as RawDictionary;
};

export type Dictionary = RawDictionary;
