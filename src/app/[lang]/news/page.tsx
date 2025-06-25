import { Suspense } from "react";
import NewsContent from "@/components/news/news-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function NewsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  return (
    <div className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <NewsContent lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}
