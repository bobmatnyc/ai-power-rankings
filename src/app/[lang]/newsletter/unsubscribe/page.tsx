import { Suspense } from "react";
import { UnsubscribeContent } from "./unsubscribe-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

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
