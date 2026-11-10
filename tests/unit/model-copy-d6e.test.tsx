import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AlgorithmInfoCard } from "../../components/ranking/algorithm-info-card";
import { generalFAQs, generalFAQsFor } from "../../data/seo-content";
import en from "../../i18n/dictionaries/en.json";
import type { Dictionary } from "../../i18n/get-dictionary";
import { rankingMethodAnswer } from "../../lib/rankings/method-answer";
import { generateRankingFAQSchema } from "../../lib/schema";

/**
 * D6e: public copy must not say models are ranked while the models page is hidden.
 *
 * Why: #401 hid `/rankings/models`; the answer box, FAQ JSON-LD, FAQ list and methodology
 *   summary still said "Models, coding harnesses and productivity tools are ranked".
 * What: with `modelsVisible` false every surface says models will be listed once metrics are
 *   collected; with it true they read as before; JSON-LD and the visible answer match.
 * Test: this file.
 */
const MODELS_RANKED = "Models, coding harnesses and productivity tools are ranked";
const PENDING = "Models will be listed once model metrics are collected.";

describe("D6e models copy follows the visibility signal", () => {
  it("hidden: answer text, answer HTML and FAQ JSON-LD omit 'models are ranked' and say the same thing", () => {
    const answer = rankingMethodAnswer("8.0", false);
    const schema = generateRankingFAQSchema(answer);
    const jsonLd = JSON.stringify(schema);
    for (const text of [answer.text, answer.html, jsonLd]) {
      expect(text).not.toContain(MODELS_RANKED);
      expect(text).toContain("Coding harnesses and productivity tools are ranked in separate lists");
      expect(text).toContain(PENDING);
    }
    expect(schema.mainEntity[0]?.acceptedAnswer.text).toBe(answer.text);
  });

  it("visible: answer text and FAQ JSON-LD say models are ranked, with no pending line", () => {
    const answer = rankingMethodAnswer("8.0", true);
    const jsonLd = JSON.stringify(generateRankingFAQSchema(answer));
    for (const text of [answer.text, answer.html, jsonLd]) {
      expect(text).toContain(MODELS_RANKED);
      expect(text).not.toContain(PENDING);
    }
    expect(rankingMethodAnswer("8.0")).toEqual(answer);
  });

  it("the visible FAQ list follows the signal", () => {
    expect(generalFAQsFor(true)).toBe(generalFAQs);
    const hidden = JSON.stringify(generalFAQsFor(false));
    expect(hidden).not.toContain(MODELS_RANKED);
    expect(hidden).toContain(PENDING);
    expect(JSON.stringify(generalFAQs)).toContain(MODELS_RANKED);
  });

  it("hidden: no FAQ answer says models are ranked (guards the string replace)", () => {
    for (const faq of generalFAQsFor(false)) {
      expect(faq.answer).not.toMatch(/Models, coding harnesses/i);
      expect(faq.answer).not.toMatch(/models are ranked/i);
    }
  });

  it("the methodology card follows the signal", () => {
    const dict = en as unknown as Dictionary;
    const hidden = renderToStaticMarkup(<AlgorithmInfoCard lang="en" dict={dict} modelsListed={false} />);
    expect(hidden).toContain(en.methodologyV8.listsBodyModelsPending);
    expect(hidden).not.toContain(MODELS_RANKED);
    const shown = renderToStaticMarkup(<AlgorithmInfoCard lang="en" dict={dict} />);
    expect(shown).toContain(en.methodologyV8.listsBody);
    expect(shown).not.toContain(en.methodologyV8.listsBodyModelsPending);
  });

  it.each(readdirSync(join(__dirname, "..", "..", "i18n", "dictionaries")).filter((f) => f.endsWith(".json")))(
    "%s carries the ModelsPending methodology keys",
    (file) => {
      const dict = JSON.parse(readFileSync(join(__dirname, "..", "..", "i18n", "dictionaries", file), "utf-8"));
      for (const key of ["listsBody", "metaDescription", "listsHeading"]) {
        expect(dict.methodologyV8[`${key}ModelsPending`]).toBeTruthy();
        expect(dict.methodologyV8[`${key}ModelsPending`]).not.toBe(dict.methodologyV8[key]);
      }
    },
  );
});
