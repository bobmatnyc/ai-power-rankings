import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { contentLoader } from "@/lib/content-loader";
import { getUrl } from "@/lib/get-url";
import { MarkdownAboutContent } from "./markdown-about-content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/about`;
  });

  return {
    title: "About AI Power Rankings - Independent AI Tool Analysis & Reviews",
    description:
      "Learn about AI Power Rankings, our mission to provide unbiased, data-driven rankings of AI coding tools. Discover our methodology and commitment to transparency.",
    keywords: [
      "about AI Power Rankings",
      "AI tool analysis",
      "independent AI reviews",
      "AI ranking platform",
      "unbiased AI ratings",
      "AI tool comparison",
      "developer tools ranking",
      "AI methodology",
    ],
    openGraph: {
      title: "About AI Power Rankings",
      description:
        "Learn about our mission to provide unbiased, data-driven rankings of AI coding tools.",
      type: "website",
      url: `${baseUrl}/${lang}/about`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/about`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function AboutPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Load about content
  const content = await contentLoader.loadContent(lang, "about");

  if (!content) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="text-muted-foreground">{dict.common.loading}</div>}>
      <MarkdownAboutContent lang={lang} content={content} />
    </Suspense>
  );
}

// Generate static params only for main pages to prevent Vercel timeout
export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "de" }, { lang: "ja" }];
}
