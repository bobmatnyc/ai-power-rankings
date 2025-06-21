export const i18n = {
  defaultLocale: "en",
  locales: ["en", "de", "fr", "it", "jp", "ko", "uk", "hr", "zh"] as const,
} as const;

export type Locale = (typeof i18n)["locales"][number];
