/**
 * Request-scoped state shared by the tool detail route's layout, page,
 * metadata and not-found boundary (#193).
 *
 * Why: Next.js renders `not-found.tsx` with no props, so it cannot see the slug
 * that missed. The `[slug]` layout receives the params and always renders
 * before the boundary inside it, so it records them here; React `cache()`
 * scopes the record to one server request (the pattern next-intl's
 * `setRequestLocale` uses).
 * What: `setToolPageParams` / `getToolPageParams` hold one request's `lang`
 * and `slug`; `findToolBySlug` is the catalogue lookup, deduplicated per
 * request so the page, its metadata and the boundary share one query.
 * Test: `tests/unit/tool-not-found-193.test.tsx`.
 */
import { cache } from "react";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";

interface ToolPageParams {
  lang?: string;
  slug?: string;
}

const requestParams = cache((): ToolPageParams => ({}));

/** Records this request's route params; called by `app/[lang]/tools/[slug]/layout.tsx`. */
export function setToolPageParams(lang: string, slug: string): void {
  const params = requestParams();
  params.lang = lang;
  params.slug = slug;
}

/** This request's route params, or `{}` when no tool layout rendered in this request. */
export function getToolPageParams(): Readonly<ToolPageParams> {
  return requestParams();
}

/**
 * The catalogue row for `slug` in any status, or `null` when no row has it.
 * A failed read rejects; it never resolves `null`.
 */
export const findToolBySlug = cache(async (slug: string) => new ToolsRepository().findBySlug(slug));
