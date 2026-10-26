// @vitest-environment jsdom
/**
 * L1 fix: a vendor with a non-`permitted` manifest entry always renders the monogram; the
 * tool's legacy `logo` prop is ignored for it (D82). Fixture manifests, made-up files.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock("../../data/logos/manifest.json");
});

const pathOf = (u: string) => new URL(u, "http://localhost").pathname;
const sha = "a".repeat(64);
const base = {
  vendor: "jetbrains",
  source_url: "https://example.invalid/brand",
  terms_url: "https://example.invalid/terms",
  terms_note: "fixture",
  fetched_at: "2026-01-01",
};

async function renderIcon(entry: Record<string, unknown> | null) {
  vi.doMock("../../data/logos/manifest.json", () => ({ default: { version: 1, logos: entry ? [{ ...base, ...entry }] : [] } }));
  const { ToolIcon } = await import("../../components/ui/tool-icon");
  return render(<ToolIcon name="Some Tool" slug="junie" logo="/tool-icons/made-up.png" />);
}

describe("ToolIcon with a vendor manifest entry", () => {
  it.each([
    ["monogram", { status: "monogram", file: null, sha256: null }],
    ["reference-only", { status: "reference-only", file: "data/logos/reference/jetbrains.svg", sha256: sha }],
  ])("renders the monogram, not the legacy logo, for a %s entry", async (_status, entry) => {
    const { container } = await renderIcon(entry);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByRole("img", { name: "JetBrains" }).textContent).toBe("JB");
  });

  it("renders the permitted file for a permitted entry", async () => {
    const { container } = await renderIcon({ status: "permitted", file: "public/logos/jetbrains.svg", sha256: sha });
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? "");
    expect(srcs.map(pathOf)).toEqual(["/logos/jetbrains.svg"]);
  });

  it("keeps the legacy logo for a vendor with no manifest entry", async () => {
    const { container } = await renderIcon(null);
    const srcs = [...container.querySelectorAll("img")].map((i) => pathOf(i.getAttribute("src") ?? ""));
    expect(srcs).toEqual(["/tool-icons/made-up.png"]);
  });
});
