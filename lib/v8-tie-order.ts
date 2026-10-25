/**
 * Tie order for v8 boards (#185, ruling D8f).
 *
 * Why: v8 is scored per kind, so tools that v7.10 kept apart can land on one
 *   score. Ruling D8f: "Break v8 ties by published v7.10 position"; tools with
 *   no published v7.10 position go last in their tie.
 * What: `v8TieOrder()` returns the tools in the order `computeRankings()` must
 *   receive them so that equal v8 scores follow the published v7.10 position.
 *   `computeRankings()` sorts by score only, with a stable sort, so equal scores
 *   keep input order and tools with different scores are ordered by score
 *   alone: the input order decides ties and nothing else. Tools with a v7.10
 *   position come first, by that position; tools without one follow. Equal
 *   positions, and tools without one, fall back to `tool_id` order, a key that
 *   does not depend on the order the rows were read or on a renamed slug.
 * Test: `lib/v8-tie-order.test.ts`, `lib/v8-board-measurement.test.ts`
 */

/**
 * Order `tools` for a v8 `computeRankings()` call.
 *
 * `v710Positions` maps `tool_id` to its rank on the published v7.10 snapshot;
 * a missing or non-finite entry means the tool has no v7.10 position.
 * Postcondition: the result is a permutation of `tools`; for any two tools
 * with v7.10 positions p < q, the one at p comes first; every tool with a
 * position comes before every tool without one.
 */
export function v8TieOrder<T extends { id: string }>(tools: readonly T[], v710Positions: ReadonlyMap<string, number>): T[] {
  const position = (t: T) => {
    const p = v710Positions.get(t.id);
    return p !== undefined && Number.isFinite(p) ? p : Number.POSITIVE_INFINITY;
  };
  return [...tools].sort((a, b) => {
    const pa = position(a);
    const pb = position(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
