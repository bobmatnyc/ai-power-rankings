import { Suspense } from "react";
import { VerifyContent } from "./verify-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function VerifyPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={<div className="text-muted-foreground">{dict.common.loading}</div>}>
      <VerifyContent lang={lang} dict={dict} />
    </Suspense>
  );
}
