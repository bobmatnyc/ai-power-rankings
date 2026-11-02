import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * The methodology summary card below the rankings grid (moved out of `rankings-grid.tsx`, #186).
 *
 * #280: it showed "About Algorithm v7.6" with the v7 primary/secondary factor split and
 * modifiers. It now shows the v8 per-list summary from the `methodologyV8` block, the
 * same text as the methodology page, and links there. It names no version, so it cannot
 * disagree with the version the board's header shows.
 * Test: `tests/unit/stale-v76-copy-280.test.tsx`.
 */
export function AlgorithmInfoCard({ lang, dict }: { lang: Locale; dict: Dictionary }): React.JSX.Element {
  const text = dict.methodologyV8;
  return (
    <Card className="mt-12" data-algorithm-info-card>
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm text-muted-foreground space-y-2">
          <p>{text.listsBody}</p>
          <p>{text.profilesBody}</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href={`/${lang}/methodology`}>{dict.rankings.algorithm.viewMethodology}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
