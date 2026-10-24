import type { ReactNode } from "react";
import { setToolPageParams } from "@/lib/tools/tool-page-request";

interface ToolSlugLayoutProps {
  children: ReactNode;
  params: Promise<{ lang: string; slug: string }>;
}

/**
 * Pass-through layout for one tool page.
 *
 * Why: #193: `not-found.tsx` gets no params; this layout renders before it in
 * the same request and records them for it.
 * What: stores `lang` and `slug` through `setToolPageParams` and renders
 * `children` unchanged.
 * Test: `tests/unit/tool-not-found-193.test.tsx`.
 */
export default async function ToolSlugLayout({ children, params }: ToolSlugLayoutProps): Promise<ReactNode> {
  const { lang, slug } = await params;
  setToolPageParams(lang, slug);
  return children;
}
