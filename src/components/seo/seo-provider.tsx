"use client";

import { DefaultSeo } from "next-seo";
import { defaultSEOConfig, languageSEOConfig } from "@/lib/seo/config";
import { useParams } from "next/navigation";

export function SEOProvider() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";

  // Merge default config with language-specific config
  const config = {
    ...defaultSEOConfig,
    ...(languageSEOConfig[lang as keyof typeof languageSEOConfig] || {}),
  };

  return <DefaultSeo {...config} />;
}
