/**
 * Curated non-commercial licence notes for tool pages (#184, owner ruling D88).
 *
 * Why: two open-weight rows stay listed although their weights are not licensed for
 *   commercial use. The ruling asks their pages to say so. The note ships with the code,
 *   so it needs no production database write.
 * What: a slug-keyed map. `licenceNoteFor(slug)` returns the note for a listed slug and
 *   `null` for every other slug, so no other tool page changes.
 * Test: `tests/unit/licence-note-184.test.tsx`.
 */

export interface LicenceNote {
  /** The licence's own name, shown as written by the vendor. */
  licenceName: string;
  /** Who grants commercial permission. */
  vendor: string;
  /** The licence text at its source. */
  licenceUrl: string;
}

// #184: D88 keeps both MiniMax rows listed and asks for this note. Keyed by slug, not by
// the stored licence id: `minimax-base-2` stores `other`, which says nothing on its own.
export const LICENCE_NOTES: Readonly<Record<string, LicenceNote>> = Object.freeze({
  // MiniMax M2.7 (hf_repo MiniMaxAI/MiniMax-M2.7, docs/refresh/model-majors-seed.json).
  "minimax-base-2": {
    licenceName: "MiniMax Non-Commercial License",
    vendor: "MiniMax",
    licenceUrl: "https://huggingface.co/MiniMaxAI/MiniMax-M2.7/raw/main/LICENSE",
  },
  // The MiniMax family row, current release MiniMax-M3.1-Flash (licence `minimax-community`).
  minimax: {
    licenceName: "MiniMax Community License",
    vendor: "MiniMax",
    licenceUrl: "https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash/raw/main/LICENSE",
  },
});

/** The licence note for `slug`, or `null` when the slug has none. */
export function licenceNoteFor(slug: string): LicenceNote | null {
  return Object.hasOwn(LICENCE_NOTES, slug) ? LICENCE_NOTES[slug]! : null;
}
