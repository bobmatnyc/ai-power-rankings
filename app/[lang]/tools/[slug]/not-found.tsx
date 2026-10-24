import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotFoundPanel } from "@/components/ui/not-found-panel";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { canonicalLocale } from "@/lib/seo/alternates";
import { nearestTools, type ToolSuggestion } from "@/lib/tools/nearest-tools";
import { findToolBySlug, getToolPageParams } from "@/lib/tools/tool-page-request";
import { ToolNotFoundSearch } from "./tool-not-found-search";

interface ToolNotFoundData {
  matches: ToolSuggestion[];
  active: ToolSuggestion[];
}

const EMPTY: ToolNotFoundData = { matches: [], active: [] };

/**
 * Nearest matches and the active catalogue for a slug with no catalogue row.
 *
 * Why: Next.js renders this boundary with every tool page, not only on a
 * miss, so it reads the catalogue only once the deduplicated lookup has
 * returned no row. The 404 page must render whatever the catalogue read does.
 * What: `EMPTY` for a known slug, a missing slug or a failed read (logged).
 */
async function loadToolNotFoundData(slug: string | undefined): Promise<ToolNotFoundData> {
  if (!slug) return EMPTY;
  try {
    if (await findToolBySlug(slug)) return EMPTY;
    const catalogue = (await new ToolsRepository().findByStatus("active")).map((t) => ({
      slug: t.slug,
      name: t.name,
      status: t.status,
    }));
    const active = catalogue
      .filter((t) => t.status === "active")
      .map(({ slug: s, name }) => ({ slug: s, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { matches: nearestTools(slug, catalogue), active };
  } catch (error) {
    console.error("[tool-not-found] catalogue read failed; rendering without suggestions", error);
    return EMPTY;
  }
}

/**
 * 404 page for `/[lang]/tools/<slug>` when the slug is not in the catalogue.
 *
 * Why: #193: an unknown tool URL answered 200 with a client-side "not found"
 * text. The page now calls `notFound()`, and this boundary gives the visitor
 * a way on: a search box, up to five nearest tools, and the rankings.
 * What: reads the slug recorded by `layout.tsx`, ranks active tools with
 * `nearestTools()` on the server, and renders them with `ToolNotFoundSearch`.
 * Next.js adds `<meta name="robots" content="noindex">` to the 404 response.
 * Test: `tests/unit/tool-not-found-193.test.tsx`.
 */
export default async function ToolNotFound() {
  const { lang, slug } = getToolPageParams();
  const locale = canonicalLocale(lang ?? "en");
  const { matches, active } = await loadToolNotFoundData(slug);

  return (
    <NotFoundPanel title="Tool Not Found" message="We couldn't find a tool at this address.">
      <ToolNotFoundSearch lang={locale} tools={active} />
      {matches.length > 0 && (
        <nav aria-label="Did you mean">
          <p className="mb-1 text-sm text-ds-text-paper-subtle">Did you mean:</p>
          <ul className="flex flex-col gap-1">
            {matches.map((tool) => (
              <li key={tool.slug}>
                <Link href={`/${locale}/tools/${tool.slug}`}>{tool.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {/* #190: hover/active variants hold the colour against globals.css a:hover and a:active. */}
      <Button asChild className="hover:text-primary-foreground active:text-primary-foreground">
        <Link href={`/${locale}/rankings`}>View Rankings</Link>
      </Button>
    </NotFoundPanel>
  );
}
