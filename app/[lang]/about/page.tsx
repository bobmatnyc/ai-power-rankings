import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { contentLoader } from "@/lib/content-loader";
import { ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";
import { MarkdownAboutContent } from "./markdown-about-content";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;

  // #156: English canonical, no hreflang: body from content-loader, English
  // in every locale (only src/content/en exists).
  const alternates = englishOnlyAlternates(lang, "/about");
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
      url: alternates.canonical, // #156: always the canonical
      locale: ENGLISH_ONLY_OG_LOCALE, // #156: the body is English
      siteName: "AI Power Rankings",
    },
    // #156: every locale canonicalises to /en, with no hreflang.
    // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
    alternates,
  };
}

export default async function AboutPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  // Load about content
  const content = await contentLoader.loadContent(lang as Locale, "about");

  if (!content) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="text-muted-foreground">{dict.common.loading}</div>}>
      <MarkdownAboutContent lang={lang as Locale} content={content} />
    </Suspense>
  );
}

// Generate static params only for main pages to prevent Vercel timeout
export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "de" }, { lang: "ja" }];
}
