import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { DesignPreview } from "./design-preview";

/**
 * `/design`: the design-system state sheet (#190). Not linked from any page,
 * not in the sitemap, and `noindex`.
 * Test: `tests/unit/design-page-190.test.tsx`.
 */
export const metadata: Metadata = {
  title: "Design system preview",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function DesignPage() {
  // The footer reads the locale from the i18n context.
  const dict = await getDictionary("en");
  return <DesignPreview dict={dict} />;
}
