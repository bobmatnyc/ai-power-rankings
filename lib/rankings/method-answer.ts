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
 * Test: `tests/unit/stale-v76-copy-280.test.tsx`.
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

export function rankingMethodAnswer(version: unknown): RankingMethodAnswer {
  const label = formatAlgorithmVersion(version);
  const build = (bold: (s: string) => string): string =>
    [
      `Models, coding harnesses and productivity tools are ranked in separate lists${label ? ` with ${bold(`Algorithm ${label}`)}` : ""}.`,
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
