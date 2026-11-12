/**
 * Curated licence notes for tool pages (#184, owner ruling D88).
 *
 * Why: two open-weight rows stay listed although their weights carry commercial-use
 *   restrictions. The ruling asks their pages to say so. The note ships with the code,
 *   so it needs no production database write.
 * What: a slug-keyed map. `licenceNoteFor(slug)` returns the note for a listed slug and
 *   `null` for every other slug, so no other tool page changes. `terms` picks the note
 *   sentence, because the two licences restrict commercial use differently.
 * Test: `tests/unit/licence-note-184.test.tsx`.
 */

/**
 * Which commercial-use terms a licence sets; selects the locale sentence.
 * - `nonCommercial`: commercial use is prohibited without prior written authorization.
 * - `community`: commercial use needs a "Built with" credit and a one-time notice, and
 *   prior written authorization above US$20 million yearly revenue.
 */
export type LicenceTerms = "nonCommercial" | "community";

export interface LicenceNote {
  /** The licence's own name, as its title reads in the licence text. */
  licenceName: string;
  /** Who grants commercial permission. */
  vendor: string;
  /** The licence text at its source. */
  licenceUrl: string;
  /** The commercial-use terms the note sentence states. */
  terms: LicenceTerms;
}

// #184: D88 keeps both MiniMax rows listed and asks for this note. Keyed by slug, not by
// the stored licence id: `minimax-base-2` stores `other`, which says nothing on its own.
export const LICENCE_NOTES: Readonly<Record<string, LicenceNote>> = Object.freeze({
  // MiniMax M2.7 (hf_repo MiniMaxAI/MiniMax-M2.7, docs/refresh/model-majors-seed.json).
  // The licence is titled "NON-COMMERCIAL LICENSE", copyright MiniMax.
  "minimax-base-2": {
    licenceName: "Non-Commercial License",
    vendor: "MiniMax",
    licenceUrl: "https://huggingface.co/MiniMaxAI/MiniMax-M2.7/raw/main/LICENSE",
    terms: "nonCommercial",
  },
  // The MiniMax family row, current release MiniMax-M3.1-Flash (licence `minimax-community`).
  // The licence is titled "MINIMAX COMMUNITY LICENSE"; it permits commercial use on terms.
  minimax: {
    licenceName: "MiniMax Community License",
    vendor: "MiniMax",
    licenceUrl: "https://huggingface.co/MiniMaxAI/MiniMax-M3.1-Flash/raw/main/LICENSE",
    terms: "community",
  },
});

/** The licence note for `slug`, or `null` when the slug has none. */
export function licenceNoteFor(slug: string): LicenceNote | null {
  return Object.hasOwn(LICENCE_NOTES, slug) ? LICENCE_NOTES[slug]! : null;
}
