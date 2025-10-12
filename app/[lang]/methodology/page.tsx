import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { contentLoader } from "@/lib/content-loader";
import { getUrl } from "@/lib/get-url";

// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/methodology`;
  });

  return {
    title: "AI Power Rankings Methodology - How We Rank AI Coding Tools",
    description:
      "Learn about our comprehensive methodology for ranking AI coding tools. Understand the criteria, metrics, and evaluation process behind our rankings.",
    keywords: [
      "AI ranking methodology",
      "AI tool evaluation",
      "ranking criteria",
      "AI metrics",
      "evaluation process",
      "ranking system",
      "AI assessment framework",
      "coding tool comparison",
    ],
    openGraph: {
      title: "AI Power Rankings Methodology",
      description:
        "Discover how we evaluate and rank AI coding tools using our comprehensive methodology.",
      type: "website",
      url: `${baseUrl}/${lang}/methodology`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/methodology`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function MethodologyPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;

  // Load methodology content
  const content = await contentLoader.loadContent(lang as Locale, "methodology");

  if (!content) {
    notFound();
  }

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-4xl">
      <article
        className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-2xl prose-h3:mt-6 prose-h3:mb-3
          prose-h4:text-xl prose-h4:mt-4 prose-h4:mb-2
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-ul:my-4 prose-li:text-muted-foreground
          prose-strong:font-semibold prose-strong:text-foreground
          prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-muted prose-pre:border prose-pre:border-border
          prose-blockquote:border-l-primary prose-blockquote:bg-muted/50
          prose-table:w-full prose-th:text-left prose-th:font-semibold
          prose-td:p-2 prose-th:p-2 prose-tr:border-b prose-tr:border-muted"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe pre-processed markdown content
        dangerouslySetInnerHTML={{ __html: content.htmlContent }}
      />
    </main>
  );
}

// Generate static params only for main pages to prevent Vercel timeout
export async function generateStaticParams() {
  return [{ lang: "en" }, { lang: "de" }, { lang: "ja" }];
}
