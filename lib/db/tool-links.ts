/**
 * The tool_links kind rule as a query (#183, Q-A5).
 *
 * Why: a link's model side must be a `kind='model'` tool and its harness side a
 *   non-model tool. Postgres cannot CHECK a rule across two tables, and Q-A5 rules out a
 *   trigger (migration risk, rollback cost, trigger edits on every kind change). The rule
 *   is enforced by the writer (B-2) and verified by this query, which also catches a row
 *   that went wrong later, when a linked tool's kind changed.
 * What: one read-only SELECT; each returned row is a violating link with both kinds. An
 *   empty result means every link obeys the rule.
 * Test: `tests/unit/tool-kind-links-pglite-183.test.ts`
 */
export const TOOL_LINK_KIND_VIOLATIONS_SQL = `SELECT l.id, l.model_tool_id, m.kind AS model_kind, l.harness_tool_id, h.kind AS harness_kind
  FROM public."tool_links" AS l
  JOIN public."tools" AS m ON m.id = l.model_tool_id
  JOIN public."tools" AS h ON h.id = l.harness_tool_id
 WHERE m.kind <> 'model' OR h.kind = 'model'
 ORDER BY l.id`;
