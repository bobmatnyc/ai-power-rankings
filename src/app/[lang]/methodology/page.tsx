import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { contentLoader } from "@/lib/content-loader";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function MethodologyPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;

  // Load methodology content
  const content = await contentLoader.loadContent(lang, "methodology");

  if (!content) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{content.title}</h1>
        {content.subtitle && <p className="text-muted-foreground text-lg">{content.subtitle}</p>}
      </div>

      <div
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
    </div>
  );
}

// Generate static params for all locales
export async function generateStaticParams() {
  const locales: Locale[] = ["en", "de", "fr", "hr", "it", "ja", "ko", "uk", "zh"];
  return locales.map((lang) => ({ lang }));
}
