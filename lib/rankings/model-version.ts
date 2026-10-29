/**
 * #329: the version a model row shows on the Models list and its tool page.
 *
 * Why: every ranked model shows its version: the latest point release within its
 * major. Before this, the only version a reader saw was prose inside the description.
 * What: for a tool whose `kind` is `model`, returns the stored lifecycle point
 * (`data.modelLifecycle.point`), else null. Any other kind returns null. The seed
 * `current_version` fact holds a full model name, not a version, so it is never
 * read; neither is the description.
 * Test: `tests/unit/model-version-329.test.ts`.
 */
export function modelVersion(tool: unknown): string | null {
  if (typeof tool !== "object" || tool === null) return null;
  const t = tool as Record<string, any>;
  if (t["kind"] !== "model") return null;
  return nonEmpty(t["modelLifecycle"]?.["point"]);
}

function nonEmpty(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
