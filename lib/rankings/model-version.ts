/**
 * #329: the version a model row shows on the Models list and its tool page.
 *
 * Why: the owner ruled that every ranked model shows its version (D0c: the latest
 * point within the major ranks). Before this, the only version a reader saw was
 * prose inside the description.
 * What: for a tool whose `kind` is `model`, returns the stored lifecycle point
 * (`data.modelLifecycle.point`), else the stored seed fact
 * (`data.modelSeed.facts.current_version.value`), else null. Any other kind
 * returns null. The description is never read.
 * Test: `tests/unit/model-version-329.test.ts`.
 */
export function modelVersion(tool: unknown): string | null {
  if (typeof tool !== "object" || tool === null) return null;
  const t = tool as Record<string, any>;
  if (t["kind"] !== "model") return null;
  const point = nonEmpty(t["modelLifecycle"]?.["point"]);
  if (point !== null) return point;
  return nonEmpty(t["modelSeed"]?.["facts"]?.["current_version"]?.["value"]);
}

function nonEmpty(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
