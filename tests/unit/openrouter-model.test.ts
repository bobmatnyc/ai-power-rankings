/**
 * OpenRouter model id resolution (issue #172).
 *
 * Why: On 2026-10-19 every OpenRouter call to `anthropic/claude-sonnet-4` answered 404
 *   "No endpoints found", so the daily-news cron returned 500 and ingestion stopped. Six
 *   call sites hardcoded that id.
 * What: Checks that the shared resolver defaults to a live Sonnet id and honours the
 *   `OPENROUTER_MODEL` override, that the ingestion analyzer and the quality assessor
 *   send the resolved id to OpenRouter, and that no production source under `lib/` or
 *   `app/` still names the retired id.
 * Test: `npx vitest run tests/unit/openrouter-model.test.ts`. No network, no database.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const RETIRED_MODEL = "anthropic/claude-sonnet-4";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));

vi.mock("../../lib/services/openrouter.service", () => ({
  getOpenRouterService: () => ({ generate: mocks.generate }),
}));

import {
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_MODEL_ENV,
  getOpenRouterModel,
} from "../../lib/services/openrouter-model";
import { AIAnalyzer } from "../../lib/services/article-ingestion.service";
import { ArticleQualityService } from "../../lib/services/article-quality.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  mocks.generate.mockReset();
});

describe("getOpenRouterModel", () => {
  it("defaults to an Anthropic Sonnet id other than the retired one", () => {
    expect(getOpenRouterModel({})).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(DEFAULT_OPENROUTER_MODEL).not.toBe(RETIRED_MODEL);
    expect(DEFAULT_OPENROUTER_MODEL).toMatch(/^anthropic\/claude-sonnet-/);
  });

  it("honours the OPENROUTER_MODEL override and ignores a blank one", () => {
    expect(OPENROUTER_MODEL_ENV).toBe("OPENROUTER_MODEL");
    expect(getOpenRouterModel({ OPENROUTER_MODEL: " anthropic/claude-sonnet-x " })).toBe(
      "anthropic/claude-sonnet-x"
    );
    expect(getOpenRouterModel({ OPENROUTER_MODEL: "   " })).toBe(DEFAULT_OPENROUTER_MODEL);
  });
});

describe("call sites send the resolved model", () => {
  it("AIAnalyzer.analyzeContent posts the default, then the env override", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const sentModels: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        sentModels.push(JSON.parse(String(init.body)).model);
        return new Response("no endpoints", { status: 404 });
      })
    );

    const analyzer = new AIAnalyzer();
    await expect(analyzer.analyzeContent("article body")).rejects.toThrow(/404/);
    vi.stubEnv("OPENROUTER_MODEL", "anthropic/claude-sonnet-override");
    await expect(analyzer.analyzeContent("article body")).rejects.toThrow(/404/);

    expect(sentModels).toEqual([DEFAULT_OPENROUTER_MODEL, "anthropic/claude-sonnet-override"]);
  });

  it("ArticleQualityService.assessArticle passes the env override to generate()", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "anthropic/claude-sonnet-override");
    mocks.generate.mockRejectedValue(new Error("stop after capture"));

    await new ArticleQualityService().assessArticle({
      title: "t",
      content: "c",
      url: "https://example.com/a",
      source: "example",
    });

    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0]?.[0].model).toBe("anthropic/claude-sonnet-override");
  });
});

describe("production source", () => {
  it("names the retired model id nowhere under lib/ or app/", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === "__tests__") continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const text = readFileSync(path, "utf8");
          if (text.includes(`"${RETIRED_MODEL}"`) || text.includes(`'${RETIRED_MODEL}'`)) {
            offenders.push(relative(root, path));
          }
        }
      }
    };
    walk(join(root, "lib"));
    walk(join(root, "app"));

    expect(offenders).toEqual([]);
  });
});
