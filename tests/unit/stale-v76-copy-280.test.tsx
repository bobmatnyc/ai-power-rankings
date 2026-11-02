import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlgorithmInfoCard } from "../../components/ranking/algorithm-info-card";
import { generalFAQs } from "../../data/seo-content";
import type { Dictionary } from "../../i18n/get-dictionary";
import en from "../../i18n/dictionaries/en.json";
import { RANKING_METHOD_QUESTION, rankingMethodAnswer } from "../../lib/rankings/method-answer";
import { generateRankingFAQSchema, generateToolReviewSchema } from "../../lib/schema";

/**
 * #280: public copy left over from v7.6/v7.10 after v8 activation (#185).
 *
 * Why: the ranking pages' answer box, FAQ JSON-LD and algorithm card said "Algorithm v7.6"
 *   and described one global board, and every locale shipped an unread v7.6
 *   `methodology` block. That contradicts the per-list v8 boards.
 * What: the answer box text names the published board's version (or none) and the
 *   per-list rule; the FAQ schema repeats it; the card renders the `methodologyV8`
 *   summary; the tool review body names the list and no algorithm version; no locale
 *   dictionary keeps the `methodology` block or a v7 version string.
 * Test: `npx vitest run tests/unit/stale-v76-copy-280.test.tsx`. No database, no network.
 */

const V7 = /v7\.\d|Algorithm v7/;

describe("ranking page answer box (#280)", () => {
  it("names the published board's version and the per-list rule", () => {
    const answer = rankingMethodAnswer("8.0");
    expect(answer.question).toBe(RANKING_METHOD_QUESTION);
    expect(answer.html).toContain("<strong>Algorithm v8.0</strong>");
    expect(answer.text).toContain("ranked in separate lists with Algorithm v8.0.");
    expect(answer.text).toContain("ranks are not compared across lists");
    expect(answer.text).not.toMatch(V7);
    expect(answer.text).not.toContain("<");
  });

  it.each([null, undefined, "", "draft"])("names no version when the board carries none (%s)", (version) => {
    const answer = rankingMethodAnswer(version);
    expect(answer.text).toContain("ranked in separate lists.");
    expect(answer.html).not.toContain("Algorithm v");
  });

  it("the FAQ schema's first answer is the answer box text", () => {
    const answer = rankingMethodAnswer("8.0");
    const schema = generateRankingFAQSchema(answer);
    expect(schema.mainEntity[0]).toMatchObject({ name: RANKING_METHOD_QUESTION, acceptedAnswer: { text: answer.text } });
    expect(JSON.stringify(schema)).not.toMatch(V7);
  });

  it("the ranking FAQ list names no v7 algorithm and no weekly update", () => {
    const text = JSON.stringify(generalFAQs);
    expect(text).not.toMatch(V7);
    expect(text).not.toContain("weekly");
  });
});

describe("algorithm card below the grid (#280)", () => {
  it("renders the v8 per-list summary and links to the methodology page", () => {
    const html = renderToStaticMarkup(<AlgorithmInfoCard lang="en" dict={en as unknown as Dictionary} />);
    expect(html).toContain(en.methodologyV8.title);
    expect(html).toContain(en.methodologyV8.listsBody);
    expect(html).toContain('href="/en/methodology"');
    expect(html).not.toMatch(V7);
    expect(html).not.toContain("67.5%");
  });
});

describe("tool review JSON-LD body (#280)", () => {
  const base = { name: "Cursor", category: "code-editor" };

  it("names the list the rank is counted in and no algorithm version", () => {
    const review = generateToolReviewSchema({ ...base, rank: 3, score: 80.04, rankingList: "coding harnesses" }, "https://x");
    expect(review?.reviewBody).toBe("Cursor ranks #3 in the coding harnesses list of AI Power Rankings, with a score of 80/100.");
  });

  it("asserts nothing without a rank", () => {
    expect(generateToolReviewSchema({ ...base, score: 80 }, "https://x")).toBeNull();
  });
});

describe("locale dictionaries (#280)", () => {
  const dir = join(__dirname, "..", "..", "i18n", "dictionaries");
  const files = readdirSync(dir).filter((name) => name.endsWith(".json"));

  it("covers every locale file", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files)("%s has no methodology block, no v7 version and the card's keys", (file) => {
    const raw = readFileSync(join(dir, file), "utf-8");
    const dict = JSON.parse(raw);
    expect(dict).not.toHaveProperty("methodology");
    expect(raw).not.toMatch(V7);
    expect(dict.methodologyV8.title).toBeTruthy();
    expect(dict.methodologyV8.listsBody).toBeTruthy();
    expect(dict.rankings.algorithm.viewMethodology).toBeTruthy();
  });
});
