export const i18n = {
  defaultLocale: "en",
  locales: ["en", "de", "fr", "it", "ja", "ko", "uk", "hr", "zh", "es"] as const,
} as const;

export const locales = i18n.locales;

export type Locale = (typeof i18n)["locales"][number];