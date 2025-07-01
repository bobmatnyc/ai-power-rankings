import { Suspense } from "react";
import { MarkdownAboutContent } from "./markdown-about-content";
import { getDictionary } from "@/i18n/get-dictionary";
import { contentLoader } from "@/lib/content-loader";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
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
