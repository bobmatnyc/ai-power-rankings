import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { UnsubscribeContent } from "./unsubscribe-content";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function UnsubscribePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={<div className="text-muted-foreground">{dict.common.loading}</div>}>
      <UnsubscribeContent lang={lang} dict={dict} />
    </Suspense>
  );
}
