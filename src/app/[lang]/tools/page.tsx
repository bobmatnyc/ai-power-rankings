import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import ToolsClient from "./tools-client";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function ToolsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <ToolsClient lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}
