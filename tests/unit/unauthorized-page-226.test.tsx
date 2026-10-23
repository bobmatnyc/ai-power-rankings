// @vitest-environment jsdom
/**
 * #226: `/<locale>/unauthorized` rendered a 500 for every visitor.
 *
 * Why: The page is a Server Component and passed `onClick` to a `<button>`.
 * React refuses to send a function from a Server Component to a DOM element
 * ("Event handlers cannot be passed to Client Component props"), so the render
 * threw. Vitest cannot run the React Server Components serializer, so the
 * first test checks the rule on the page source; a local `next dev` request
 * reproduced the 500 and showed 200 after the fix.
 * What: The page source has no `on<Event>=` attribute and no `"use client"`
 * directive; the handler lives in the `"use client"` GoBackButton. The page
 * renders static content only, and the button steps back in history.
 * Test: `npx vitest run tests/unit/unauthorized-page-226.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import UnauthorizedPage from "../../app/[lang]/(authenticated)/unauthorized/page";
import { GoBackButton } from "../../app/[lang]/(authenticated)/unauthorized/go-back-button";

const DIR = join(__dirname, "../../app/[lang]/(authenticated)/unauthorized");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("#226: unauthorized page", () => {
  it("keeps event handlers out of the Server Component page", () => {
    const page = readFileSync(join(DIR, "page.tsx"), "utf8");
    expect(page).not.toMatch(/^\s*["']use client["']/);
    expect(page).not.toMatch(/\son[A-Z][A-Za-z]*=\{/);
    const button = readFileSync(join(DIR, "go-back-button.tsx"), "utf8");
    expect(button).toMatch(/^["']use client["'];/);
  });

  it("renders static content only, without fetching data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const html = renderToStaticMarkup(await UnauthorizedPage({ params: Promise.resolve({ lang: "es" }) }));
    expect(html).toContain("Access Denied");
    expect(html).toContain('href="/es"');
    expect(html).toContain("Go Back");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("goes back one history entry when Go Back is clicked", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(<GoBackButton />);
    fireEvent.click(screen.getByRole("button", { name: "Go Back" }));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
