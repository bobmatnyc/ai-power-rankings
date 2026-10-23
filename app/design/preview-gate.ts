/**
 * Whether `/design` renders (#190).
 *
 * Why: the state sheet is a review tool. It is `noindex`, but in production it
 * should not answer at all unless a deploy opts in.
 * What: true outside production (dev, local and visual test runs), and in
 * production only when `DESIGN_PREVIEW` is set to a non-empty value. The page
 * is prerendered, so set the variable before the build.
 * Test: `tests/unit/design-page-190.test.tsx`.
 */
export function designPreviewEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || Boolean(env.DESIGN_PREVIEW);
}
