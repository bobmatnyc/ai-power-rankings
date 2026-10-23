import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/get-dictionary";
import { DesignPreview } from "./design-preview";
import { designPreviewEnabled } from "./preview-gate";

/**
 * `/design`: the design-system state sheet (#190). Not linked from any page,
 * not in the sitemap, `noindex`, and a 404 in production unless
 * `DESIGN_PREVIEW` is set (`./preview-gate`).
 * Test: `tests/unit/design-page-190.test.tsx`.
 */
export const metadata: Metadata = {
  title: "Design system preview",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function DesignPage() {
  // #190: production answers 404 unless the deploy sets DESIGN_PREVIEW.
  if (!designPreviewEnabled()) notFound();
  // The footer reads the locale from the i18n context.
  const dict = await getDictionary("en");
  return <DesignPreview dict={dict} />;
}
