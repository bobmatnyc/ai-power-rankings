// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

/**
 * The `/design` preview route (#190 PR A).
 *
 * Why: `/design` is where the design-system components are reviewed and
 * snapshot-tested; a component or state missing from it is missing from
 * review and from the visual tests. The route must stay out of search and
 * navigation.
 * What: renders `DesignPreview` and requires, in the light and the `.dark`
 * panel, every core component the #190 AC names in each listed state, each
 * built from the real component (checked by a class or element only that
 * component emits). Also checks the forced-state selector rewrite, the
 * `noindex` metadata, that no source outside `app/design/` links to it, and
 * that the sitemap omits it.
 * Test: `npx vitest run tests/unit/design-page-190.test.tsx`. No network.
 */

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/design",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("../../lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/analytics/track")>()),
  trackEvent: vi.fn(),
}));
vi.mock("../../lib/db/repositories/news", () => ({
  newsRepository: { getPublishedSlugs: vi.fn(async () => []) },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  toolsRepository: { findAll: vi.fn(async () => []) },
}));

import DesignPage, { metadata } from "../../app/design/page";
import { designPreviewEnabled } from "../../app/design/preview-gate";
import { DesignPreview } from "../../app/design/design-preview";
import { forcedSelector } from "../../app/design/force-states";
import { buildSitemapEntries } from "../../lib/sitemap";

const root = join(__dirname, "..", "..");

/**
 * The #190 AC's core components and the states each must show. Written out
 * here, not imported from the page, so removing one from the page fails.
 */
const REQUIRED: Record<string, { states: string[]; signature: string }> = {
  card: { states: ["default", "hover", "focus"], signature: ".bg-card" },
  table: { states: ["default", "hover", "selected"], signature: "table" },
  badge: { states: ["default", "hover", "focus"], signature: ".rounded-full" },
  nav: { states: ["default", "hover", "focus", "active"], signature: "nav a" },
  footer: { states: ["default", "hover", "focus"], signature: "footer" },
  "score-pill": { states: ["default", "hover"], signature: ".rounded-full" },
  "rank-change": { states: ["new", "up", "down", "steady"], signature: "[class*='text-ds-rank-']" },
  // #190 PR C1
  alert: { states: ["default", "destructive"], signature: "[role='alert']" },
  "form-control": { states: ["default", "focus"], signature: "input.border-ds-border-strong" },
  "modifier-text": { states: ["default"], signature: ".text-ds-success" },
  // #190 C2: the option comparison; each gradient option shows icon swatches, each card is a Card.
  "gradient-option": { states: ["current", "a", "b", "c"], signature: "[data-swatch='icon-teal']" },
  "agent-card": { states: ["current", "purple", "teal", "amber"], signature: ".bg-card" },
  "tier-legend": { states: ["current"], signature: ".bg-card" },
};

const RANK_CLASS: Record<string, string> = {
  new: "text-ds-rank-up",
  up: "text-ds-rank-up",
  down: "text-ds-rank-down",
  steady: "text-ds-rank-steady",
};

afterEach(cleanup);

describe("/design preview (#190)", () => {
  it.each(["light", "dark"])("renders every core component in every state in the %s panel", (mode) => {
    const { container } = render(<DesignPreview dict={en as never} />);
    const panel = container.querySelector(`[data-design-mode="${mode}"]`);
    expect(panel, `${mode} panel`).not.toBeNull();
    expect(panel?.classList.contains("dark")).toBe(mode === "dark");
    for (const [component, { states, signature }] of Object.entries(REQUIRED)) {
      for (const state of states) {
        const sample = panel?.querySelector(
          `[data-design-component="${component}"][data-design-state="${state}"]`,
        );
        expect(sample, `${mode}: ${component} / ${state}`).not.toBeNull();
        expect(sample?.querySelector(signature), `${mode}: ${component} / ${state} renders ${signature}`).not.toBeNull();
      }
    }
    for (const [state, cls] of Object.entries(RANK_CLASS)) {
      const sample = panel?.querySelector(`[data-design-component="rank-change"][data-design-state="${state}"]`);
      expect(sample?.querySelector(`.${cls}`), `rank-change ${state} uses ${cls}`).not.toBeNull();
    }
  });

  it("rewrites hover and focus selectors onto the forced-state attribute", () => {
    expect(forcedSelector(".hover\\:bg-muted:hover")).toBe(
      '.hover\\:bg-muted:is([data-force-state~="hover"], [data-force-state~="hover"] *)',
    );
    expect(forcedSelector(".focus-visible\\:ring-2:focus-visible")).toContain('[data-force-state~="focus"]');
    expect(forcedSelector(".group:hover .group-hover\\:text-foreground")).toContain(
      '.group:is([data-force-state~="hover"]',
    );
    // An escaped `\:hover` inside a class name is not a pseudo-class.
    expect(forcedSelector(".dark\\:hover\\:bg-muted")).toBeNull();
    expect(forcedSelector(".x:focus-within")).toBeNull();
    expect(forcedSelector(".plain")).toBeNull();
  });

  it("is noindex", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  // #190 PR C1: production answers 404 unless DESIGN_PREVIEW is set.
  it.each([
    [{ NODE_ENV: "production" }, false],
    [{ NODE_ENV: "production", DESIGN_PREVIEW: "" }, false],
    [{ NODE_ENV: "production", DESIGN_PREVIEW: "1" }, true],
    [{ NODE_ENV: "development" }, true],
    [{ NODE_ENV: "test" }, true],
  ])("gates on %j -> %s", (env, enabled) => {
    expect(designPreviewEnabled(env)).toBe(enabled);
  });

  it("calls notFound() in production without DESIGN_PREVIEW", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DESIGN_PREVIEW", "");
    try {
      await expect(DesignPage()).rejects.toThrow("NEXT_NOT_FOUND");
      vi.stubEnv("DESIGN_PREVIEW", "1");
      await expect(DesignPage()).resolves.toBeTruthy();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("has no link from any source outside app/design", () => {
    const link = /["'`]\/design(?:["'`]|[/?#])/;
    const sources = ["app", "components", "lib", "i18n", "contexts", "hooks", "src"].flatMap((dir) =>
      walk(join(root, dir)),
    );
    expect(sources.length).toBeGreaterThan(0);
    const linking = sources.filter(
      (file) => !file.startsWith("app/design/") && link.test(readFileSync(join(root, file), "utf8")),
    );
    expect(linking).toEqual([]);
  });

  it("is absent from the sitemap", async () => {
    const entries = await buildSitemapEntries("https://example.test");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter(({ url }) => /\/design(?:[/?#]|$)/.test(url))).toEqual([]);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|jsx|mjs|md|mdx|json)$/.test(name)) out.push(relative(root, path).split(sep).join("/"));
  }
  return out;
}
