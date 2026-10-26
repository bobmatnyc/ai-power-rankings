// @vitest-environment jsdom
/**
 * L1: ToolIcon and RankingCard use a stored logo before anything else, never fetch a remote
 * logo or favicon, and draw a deterministic accessible monogram otherwise.
 * Fixtures use made-up slugs and the reserved `.invalid` TLD.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../../lib/analytics/track", () => ({ trackEvent: vi.fn() }));

import { RankingCard } from "../../components/ranking/ranking-card";
import { ToolIcon } from "../../components/ui/tool-icon";

afterEach(cleanup);

const root = path.resolve(__dirname, "../..");

function row(tool: Record<string, unknown>) {
  return {
    rank: 3,
    tool: { id: "id-fixture", slug: "made-up-tool", name: "Made Up Tool", category: "code-editor", status: "active", ...tool },
    scores: { overall: 70, agentic_capability: 7, innovation: 7 },
    metrics: {},
  };
}

const imgSrcs = (c: HTMLElement) => [...c.querySelectorAll("img")].map((i) => i.getAttribute("src") ?? "");

describe("RankingCard logo precedence", () => {
  it("shows the stored logo when both logo and website_url are set", () => {
    const { container } = render(
      <RankingCard ranking={row({ logo: "/tool-icons/made-up.png", website_url: "https://made-up.invalid" })} showDetails={false} />,
    );
    const srcs = imgSrcs(container);
    expect(srcs).toHaveLength(1);
    expect(decodeURIComponent(srcs[0]!)).toContain("/tool-icons/made-up.png");
  });
});

describe("no runtime logo or favicon fetch", () => {
  it("renders no image for a tool with only a website, and requests nothing remote", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(<RankingCard ranking={row({ website_url: "https://made-up.invalid" })} showDetails={false} />);
    expect(imgSrcs(container)).toEqual([]);
    expect(container.innerHTML).not.toMatch(/api\/favicon|made-up\.invalid|google\.com/);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("has no favicon route and no favicon or remote-logo code in ToolIcon", () => {
    expect(existsSync(path.join(root, "app/api/favicon/route.ts"))).toBe(false);
    const source = readFileSync(path.join(root, "components/ui/tool-icon.tsx"), "utf8");
    expect(source).not.toMatch(/api\/favicon|google\.com\/s2|clearbit/i);
  });

  it("adds no remotePatterns to next.config.js", () => {
    expect(readFileSync(path.join(root, "next.config.js"), "utf8")).not.toMatch(/remotePatterns/);
  });
});

describe("monogram", () => {
  it("renders initials, an aria-label with the name and a deterministic colour", () => {
    const a = render(<ToolIcon name="Made Up Tool" slug="made-up-tool" />);
    const first = screen.getByRole("img", { name: "Made Up Tool" });
    expect(first.textContent).toBe("MU");
    const cls = first.className;
    expect(cls).toMatch(/from-ds-grad-/);
    a.unmount();
    render(<ToolIcon name="Made Up Tool" slug="made-up-tool" />);
    expect(screen.getByRole("img", { name: "Made Up Tool" }).className).toBe(cls);
  });

  it("uses the vendor display name when the tool slug has a vendor", () => {
    render(<ToolIcon name="Some Tool Name" slug="junie" />);
    const el = screen.getByRole("img", { name: "JetBrains" });
    expect(el.textContent).toBe("JB");
  });

  it("prefers a local logo path over the monogram", () => {
    const { container } = render(<ToolIcon name="Made Up Tool" slug="made-up-tool" logo="/tool-icons/made-up.png" />);
    expect(imgSrcs(container).map((u) => new URL(u, "http://localhost").pathname)).toEqual(["/tool-icons/made-up.png"]);
  });

  it("ignores a logo that is not a local path", () => {
    const { container } = render(<ToolIcon name="Made Up Tool" slug="made-up-tool" logo="https://made-up.invalid/x.png" />);
    expect(imgSrcs(container)).toEqual([]);
  });
});
