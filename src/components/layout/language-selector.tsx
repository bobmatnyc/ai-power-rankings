"use client";

import { Globe } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { i18n, type Locale } from "@/i18n/config";

const languageNames: Record<Locale, string> = {
  en: "EN",
  de: "DE",
  fr: "FR",
  it: "IT",
  ja: "JA",
  ko: "KO",
  uk: "UK",
  hr: "HR",
  zh: "ZH",
  es: "ES",
};

export function LanguageSelector() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = (params["lang"] as Locale) || i18n.defaultLocale;

  const handleLanguageChange = (newLocale: Locale) => {
    // Remove current locale from pathname and add new one
    const segments = pathname.split("/");
    if (segments[1] && i18n.locales.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }

    const newPath = segments.join("/");
    router.push(newPath);
  };

  return (
    <Select value={currentLocale} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[70px] h-8 border-0 bg-transparent hover:bg-muted/50 focus:ring-0 focus:ring-offset-0">
        <div className="flex items-center gap-1">
          <Globe className="h-3 w-3 opacity-70" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[80px]">
        {i18n.locales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {languageNames[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
