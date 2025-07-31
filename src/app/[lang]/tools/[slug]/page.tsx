import type { Metadata } from "next";
import { generateToolMetadata } from "@/app/tools/[slug]/metadata";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { ToolDetailClient } from "./tool-detail-client";

// Force dynamic rendering to prevent build timeout
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: Locale; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Get the base metadata from the existing function
  const baseMetadata = await generateToolMetadata(slug);

  // Get the base URL
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/tools/${slug}`;
  });

  // Override the alternates section to fix SEO duplicate content issue
  return {
    ...baseMetadata,
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/tools/${slug}`,
      // Include hreflang tags for all 10 supported languages
      languages,
    },
  };
}

export default async function ToolDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);

  return <ToolDetailClient slug={slug} lang={lang} dict={dict} />;
}
