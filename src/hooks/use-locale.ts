"use client";

import { usePathname } from "next/navigation";
import { i18n, type Locale } from "@/i18n/config";

export function useLocale(): Locale {
  const pathname = usePathname();
  const segments = pathname.split("/");
  const locale = segments[1] as Locale;

  // Return the locale if it's valid, otherwise default to 'en'
  return i18n.locales.includes(locale) ? locale : "en";
}
