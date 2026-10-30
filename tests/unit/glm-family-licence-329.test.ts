/**
 * #329: glm's family licence is its custom glm-5.3 licence, as the model card states.
 *
 * Why: the family list carried glm as "mit" with no source, while the open-weight seed and the
 *   Hugging Face card name the custom glm-5.3 licence. The stored row is corrected through the
 *   seed loader's curated-field overwrite (#334), not a migration.
 * What: holds the family row to the seed row, checks the seed marks the licence for review, and
 *   plans the seed against a stored "mit" glm row: refused without an overwrite, one marked
 *   licence change with `glm:licence`.
 * Test: `npx vitest run tests/unit/glm-family-licence-329.test.ts`. No database, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { D91_FAMILY_ROWS } from "../../lib/db/model-families";
import { MODEL_SEED_SELECT_SQL, type ModelSeedQueryable, planModelSeedRows } from "../../lib/db/repositories/model-seed-writer";
import { readModelSeeds } from "../../scripts/load-model-seeds";

const ROOT = path.resolve(__dirname, "../..");
const ENTRY = readModelSeeds("open-weight", (file) => readFileSync(path.join(ROOT, file), "utf8")).find((e) => e.row.slug === "glm")!;
const FAMILY = D91_FAMILY_ROWS.find((f) => f.slug === "glm")!;

/** The glm row as migration 0018 stored it: licence "mit", the other curated columns empty. */
const STORED = {
  slug: "glm",
  kind: "model",
  status: "inactive",
  redirect_to: null,
  open_weight: true,
  hf_repo: null,
  licence: "mit",
  parameters_b: null,
  active_parameters_b: null,
  release_date: null,
  model_seed: null,
};

const db: ModelSeedQueryable = {
  async query(sql) {
    return { rows: sql === MODEL_SEED_SELECT_SQL ? [STORED] : [] };
  },
};

describe("#329 glm family licence", () => {
  it("the family row states the seed's custom glm-5.3 licence", () => {
    expect(ENTRY.row.facts.licence?.value).toBe("glm-5.3");
    expect(ENTRY.row.licenceReview).toBe("pending");
    expect(FAMILY.licence).toBe(ENTRY.row.facts.licence?.value);
  });

  it("the seed refuses to replace a stored mit licence without an overwrite", async () => {
    const [plan] = await planModelSeedRows(db, [ENTRY]);
    expect(plan?.outcome).toBe("refused");
    expect(plan?.outcome === "refused" && plan.reason).toContain("stored licence is mit; the seed says glm-5.3");
    expect(plan?.outcome === "refused" && plan.reason).toContain("--overwrite glm:licence");
  });

  it("--overwrite glm:licence plans the licence change as an overwrite", async () => {
    const [plan] = await planModelSeedRows(db, [ENTRY], [{ slug: "glm", column: "licence" }]);
    expect(plan?.outcome).toBe("update");
    const changes = plan?.outcome === "update" ? plan.changes : [];
    expect(changes.find((c) => c.column === "licence")).toEqual({ column: "licence", from: "mit", to: "glm-5.3", overwrite: true });
  });
});
