import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { safeSourceUrl, type ToolLinkEntry, type ToolLinksDirection } from "@/lib/tools/tool-links";

/**
 * The tool page's "Models it runs" / "Harnesses for this model" block (#183 B-2 step 2).
 *
 * Why: a harness page should say which models it runs, and a model page which harnesses
 *   offer it, with the source for each claim.
 * What: one server-rendered section. Each entry links to `/<lang>/tools/<slug>`, shows the
 *   relation label and, when `sourceUrl` is an absolute http(s) URL, an external source
 *   link (`target="_blank"`, `rel="noopener noreferrer nofollow"`). Any other URL renders
 *   no source link. With no direction or no entries it renders nothing: no heading, no list.
 * Test: `tests/unit/tool-links-page-183.test.tsx`.
 */

export interface ToolLinksLabels {
  modelsHeading: string;
  harnessesHeading: string;
  native: string;
  supports: string;
  source: string;
}

interface ToolLinksBlockProps {
  lang: string;
  direction: ToolLinksDirection | null;
  links: ToolLinkEntry[];
  labels: ToolLinksLabels;
}

export function ToolLinksBlock({ lang, direction, links, labels }: ToolLinksBlockProps) {
  if (direction === null || links.length === 0) return null;
  const heading = direction === "models" ? labels.modelsHeading : labels.harnessesHeading;
  const headingId = `tool-links-${direction}`;
  return (
    // Same static Card treatment as the #193 profile block.
    <Card data-tool-links={direction} className="mb-8 hover:translate-y-0 hover:shadow-sm">
      <CardContent className="p-6">
        <section aria-labelledby={headingId} className="space-y-1">
          <h2 id={headingId} className="text-lg font-semibold text-foreground">
            {heading}
          </h2>
          <ul className="space-y-1">
            {links.map((link) => {
              // #183: defence in depth; the writer already refuses a non-http(s) URL.
              const href = safeSourceUrl(link.sourceUrl);
              return (
                <li key={link.slug} data-tool-link={link.slug} data-tool-link-relation={link.relation}>
                  <Link href={`/${lang}/tools/${link.slug}`} className="font-medium text-primary hover:underline">
                    {link.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    {link.relation === "native" ? labels.native : labels.supports}
                  </span>
                  {href ? (
                    <>
                      {" "}
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-sm text-muted-foreground hover:underline"
                      >
                        {labels.source}
                      </a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
