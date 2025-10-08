// SEO configuration for AI Power Rankings
// This file contains base configuration, with language-specific content loaded from dictionaries

import { getBaseUrl } from "@/lib/get-base-url";

export const seoConfig = {
  get baseUrl() {
    return getBaseUrl();
  },
  siteName: "AI Power Rankings",
  twitterHandle: "https://hyperdev.matsuoka.com/",
  author: "AI Power Rankings Team",
};

// Supported locale codes for SEO
export const supportedLocales = {
  en: "en_US",
  ja: "ja_JP",
  zh: "zh_CN",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  ko: "ko_KR",
  pt: "pt_BR",
  it: "it_IT",
  uk: "uk_UA",
  hr: "hr_HR",
} as const;

export type SupportedLocale = keyof typeof supportedLocales;
