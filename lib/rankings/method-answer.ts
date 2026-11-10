/**
 * The "How are AI tool rankings determined?" answer on the ranking pages (#280).
 *
 * Why: the answer box and the FAQ JSON-LD both said "Algorithm v7.6" and described one
 *   global board. After v8 activation (#185) each list is ranked on its own with its own
 *   scoring profile, so that text contradicted the boards on the same page.
 * What: `rankingMethodAnswer(version)` returns the question and the answer as HTML (for
 *   `QuickAnswerBox`) and as plain text (for the FAQ schema), so both say the same thing.
 *   `version` is the published board's `algorithm.version`; it is formatted with
 *   `formatAlgorithmVersion` and left out when missing or unusable, so the answer never
 *   names a version the board does not carry.
 *   D6e: while the models page is hidden (`isModelPageVisible()` false) the first sentence
 *   says coding harnesses and productivity tools are ranked and models will be listed once
 *   model metrics are collected; it flips back by itself when the page returns.
 * Test: `tests/unit/stale-v76-copy-280.test.tsx`, `tests/unit/model-copy-d6e.test.tsx`.
 */
import { formatAlgorithmVersion } from "./header";

export const RANKING_METHOD_QUESTION = "How are AI tool rankings determined?";

const FACTORS =
  "Agentic Capability, Innovation, Technical Performance, Developer Adoption, Market Traction, Business Sentiment, Development Velocity and Platform Resilience";

export interface RankingMethodAnswer {
  question: string;
  html: string;
  text: string;
}

/** D6e: the sentence naming which lists are ranked; `modelsVisible` is `isModelPageVisible()`. */
export function rankedListsSentence(modelsVisible: boolean): string {
  return modelsVisible
    ? "Models, coding harnesses and productivity tools are ranked in separate lists"
    : "Coding harnesses and productivity tools are ranked in separate lists";
}

/** D6e: appended while the models page is hidden. */
export const MODELS_PENDING_SENTENCE = "Models will be listed once model metrics are collected.";

export function rankingMethodAnswer(version: unknown, modelsVisible = true): RankingMethodAnswer {
  const label = formatAlgorithmVersion(version);
  const build = (bold: (s: string) => string): string =>
    [
      // D6e: say models are ranked only while the models page is shown.
      `${rankedListsSentence(modelsVisible)}${label ? ` with ${bold(`Algorithm ${label}`)}` : ""}.`,
      ...(modelsVisible ? [] : [MODELS_PENDING_SENTENCE]),
      `Each list is scored with the profile for its kind, across 8 factors: ${FACTORS}.`,
      "A tool is ranked in one list at most, and ranks are not compared across lists.",
      "Rankings are recalculated monthly.",
    ].join(" ");
  return {
    question: RANKING_METHOD_QUESTION,
    html: build((s) => `<strong>${s}</strong>`),
    text: build((s) => s),
  };
}
