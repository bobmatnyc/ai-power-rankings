import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Source files outside the Insights route and templates that link to `/insights` (#198).
 *
 * Why: #198: every Insights slice must stay unlinked until launch, so each
 * slice's test runs the same scan.
 * What: walks `app`, `components`, `lib`, `i18n`, `contexts`, `hooks` and `src`
 * for a quoted `/insights...` path, or one after a template `${...}` segment,
 * and returns the matching files outside `app/[lang]/insights/` and
 * `components/insights/`. Also returns the number of files scanned, so a
 * caller can show the scan read something.
 * Test: `tests/unit/insights-weekly-198.test.tsx`, `tests/unit/insights-monthly-198.test.tsx`.
 */
export function insightsLinksOutsideInsights(): { scanned: number; linking: string[] } {
  const root = join(__dirname, "..", "..");
  const link = /(?:["'`]|\})\/insights(?:["'`/?#])/;
  const sources = ["app", "components", "lib", "i18n", "contexts", "hooks", "src"].flatMap((dir) =>
    walk(root, join(root, dir))
  );
  const linking = sources.filter(
    (file) =>
      !file.startsWith("app/[lang]/insights/") &&
      !file.startsWith("components/insights/") &&
      link.test(readFileSync(join(root, file), "utf8"))
  );
  return { scanned: sources.length, linking };
}

function walk(root: string, dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(root, path, out);
    else if (/\.(ts|tsx|js|jsx|mjs|md|mdx|json)$/.test(name)) out.push(relative(root, path).split(sep).join("/"));
  }
  return out;
}
