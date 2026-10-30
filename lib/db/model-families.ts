/**
 * D91: the model family rows and the per-version rows that fold into them (#197).
 *
 * Why: ruling D91 creates glm, kimi, claude-opus and claude-sonnet (migration 0018) and
 *   folds seven per-version rows into them (0019). The migrations carry the slugs as SQL
 *   literals; this module is the reviewable list the tests hold the files to.
 * What: `D91_FOLD_PAIRS` lists old -> family in the order 0019 settles clashes (the D90
 *   "earlier pair wins" rule): the four survivors first, then the three aliases.
 *   `D91_SURVIVORS` maps each family to the version whose data and scores it carries.
 *   `D91_FAMILY_ROWS` are the 0018 rows, except glm's licence, which follows the model card (#329).
 * Test: `tests/unit/model-family-fold-d91.test.ts`.
 */

export interface FoldPair {
  oldSlug: string;
  newSlug: string;
}

/** D91: old slug -> family slug; the order is the clash-resolution order of 0019. */
export const D91_FOLD_PAIRS: readonly FoldPair[] = [
  { oldSlug: "opus-4-6", newSlug: "claude-opus" },
  { oldSlug: "sonnet-4-5", newSlug: "claude-sonnet" },
  { oldSlug: "glm-5-0", newSlug: "glm" },
  { oldSlug: "kimi-2-5", newSlug: "kimi" },
  { oldSlug: "opus-4-5", newSlug: "claude-opus" },
  { oldSlug: "zhipu-glm-5-0", newSlug: "glm" },
  { oldSlug: "moonshot-kimi-2-5", newSlug: "kimi" },
];

/** D91: the newest version per family; 0019 copies its data and scores. */
export const D91_SURVIVORS: Readonly<Record<string, string>> = {
  "claude-opus": "opus-4-6",
  "claude-sonnet": "sonnet-4-5",
  glm: "glm-5-0",
  kimi: "kimi-2-5",
};

export interface FamilyRow {
  slug: string;
  name: string;
  openWeight: boolean;
  licence: string | null;
}

/** D91: the rows 0018 inserts (status inactive, kind model, category other, company_id NULL). */
export const D91_FAMILY_ROWS: readonly FamilyRow[] = [
  { slug: "claude-opus", name: "Claude Opus", openWeight: false, licence: null },
  { slug: "claude-sonnet", name: "Claude Sonnet", openWeight: false, licence: null },
  // #329: glm licence follows the model card (custom glm-5.3 licence)
  // 0018 inserted "mit"; the stored row is corrected by the seed loader's --overwrite glm:licence.
  { slug: "glm", name: "GLM", openWeight: true, licence: "glm-5.3" },
  { slug: "kimi", name: "Kimi", openWeight: true, licence: "modified-mit" },
];
