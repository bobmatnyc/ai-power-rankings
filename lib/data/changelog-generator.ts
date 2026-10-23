/**
 * Changelog generation — parse, date and render core (#231)
 *
 * Why: The runtime read CHANGELOG.md from disk, and `.vercelignore` dropped
 * that file from every deploy, so the platform feed was empty in production
 * with no error (#231). The build now turns CHANGELOG.md into a TypeScript
 * module, and the runtime imports data instead of reading a file.
 * What: `parseChangelog` lists every top-level bullet under a change section
 * (Added, Changed, Fixed, ...), including the undated `[Unreleased]` section.
 * `buildEntries` dates each bullet: a released bullet takes its release date;
 * an unreleased bullet takes the date a resolver supplies (the commit that
 * introduced the line, else the previous module's date, else the build date).
 * `renderData` prints the generated JSON, which `lib/data/changelog-entries.ts`
 * types and exports. No filesystem, git or clock access happens here;
 * `scripts/generate-changelog-data.ts` supplies them.
 * Test: `tests/unit/changelog-generated-sync.test.ts`.
 */

import { createHash } from "crypto";

export type ChangeType = "feature" | "improvement" | "fix" | "news";

/** Where an entry's date came from. */
export type DateSource = "release" | "commit" | "build";

/** One platform change, as the generated module stores it. */
export interface ChangelogEntry {
  /** Stable id: version plus a hash of the section and bullet text. */
  id: string;
  /** Release version, or "Unreleased". */
  version: string;
  /** ISO-8601 timestamp. */
  date: string;
  dateSource: DateSource;
  /** The CHANGELOG section heading, e.g. "Fixed". */
  section: string;
  /** Conventional-commit scope (`fix(auth): ...` gives "auth"), else null. */
  scope: string | null;
  title: string;
  description: string;
  changeType: ChangeType;
}

/** One bullet as read from CHANGELOG.md, before dating. */
export interface ParsedBullet {
  version: string;
  /** `YYYY-MM-DD` from the release header; null for `[Unreleased]`. */
  releaseDate: string | null;
  section: string;
  text: string;
  /** 1-based line number in CHANGELOG.md, for git blame lookup. */
  line: number;
}

export interface ResolvedDate {
  date: string;
  dateSource: DateSource;
}

/**
 * Path of the generated data, relative to the repository root. It sits in
 * `data/`, outside the source trees that unit tests scan for code patterns,
 * because it carries CHANGELOG prose verbatim.
 */
export const GENERATED_RELATIVE_PATH = "data/changelog-entries.generated.json";

// Sections that describe changes. "Known Issues" and similar are not changes.
const SECTION_TYPES: Record<string, ChangeType> = {
  added: "feature",
  changed: "improvement",
  fixed: "fix",
  removed: "improvement",
  security: "fix",
  deprecated: "improvement",
  performance: "improvement",
};

const TITLE_MAX = 120;

/** Lists every top-level change bullet in CHANGELOG.md, in file order. */
export function parseChangelog(markdown: string): ParsedBullet[] {
  const bullets: ParsedBullet[] = [];
  let version: string | null = null;
  let releaseDate: string | null = null;
  let section: string | null = null;

  markdown.split("\n").forEach((raw, index) => {
    const line = raw.replace(/\r$/, "");
    const release = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?/.exec(line);
    if (release) {
      version = release[1] ?? null;
      releaseDate = release[2] ?? null;
      section = null;
      return;
    }
    const heading = /^### (.+?)\s*$/.exec(line);
    if (heading) {
      const name = heading[1] ?? "";
      section = name.toLowerCase() in SECTION_TYPES ? name : null;
      return;
    }
    const bullet = /^- (.+)$/.exec(line);
    if (bullet && version && section) {
      bullets.push({ version, releaseDate, section, text: bullet[1]!.trim(), line: index + 1 });
    }
  });

  return bullets;
}

/** The id an entry gets; also the key a resolver uses to find a previous date. */
export function entryId(bullet: Pick<ParsedBullet, "version" | "section" | "text">): string {
  const hash = createHash("sha1")
    .update(`${bullet.version}\n${bullet.section}\n${bullet.text}`)
    .digest("hex")
    .slice(0, 12);
  return `${bullet.version.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}-${hash}`;
}

/**
 * Dates and shapes every parsed bullet. A released bullet takes its release
 * date; an unreleased one takes `resolveDate`'s answer.
 */
export function buildEntries(
  bullets: ParsedBullet[],
  resolveDate: (bullet: ParsedBullet, id: string) => ResolvedDate
): ChangelogEntry[] {
  const seen = new Map<string, number>();
  return bullets.map((bullet) => {
    const base = entryId(bullet);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    const resolved: ResolvedDate = bullet.releaseDate
      ? { date: `${bullet.releaseDate}T00:00:00.000Z`, dateSource: "release" }
      : resolveDate(bullet, id);
    return {
      id,
      version: bullet.version,
      ...resolved,
      section: bullet.section,
      ...splitBullet(bullet.text),
      changeType: SECTION_TYPES[bullet.section.toLowerCase()] ?? "feature",
    };
  });
}

/** Splits a bullet into scope, title and description. */
export function splitBullet(text: string): Pick<ChangelogEntry, "scope" | "title" | "description"> {
  const bold = /^\*\*([^*]+)\*\*:\s*(.+)$/.exec(text);
  if (bold) return { scope: null, title: bold[1]!.trim(), description: bold[2]!.trim() };

  const conventional = /^[a-z]+(?:\(([^)]+)\))?!?:\s+(.+)$/.exec(text);
  const scope = conventional?.[1] ?? null;
  const body = conventional ? conventional[2]! : text;
  return { scope, title: firstSentence(body), description: body };
}

function firstSentence(body: string): string {
  const plain = body.replace(/`/g, "");
  const stop = plain.search(/\.\s/);
  const sentence = (stop === -1 ? plain : plain.slice(0, stop)).trim();
  if (sentence.length <= TITLE_MAX) return sentence;
  const cut = sentence.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Maps CHANGELOG.md line numbers to the committer time (Unix seconds) of the
 * commit that introduced the line's current text, from
 * `git blame --line-porcelain` output. A line not yet committed maps to null.
 */
export function parseBlamePorcelain(output: string): Map<number, number | null> {
  const lines = new Map<number, number | null>();
  let current: { line: number; uncommitted: boolean } | null = null;
  for (const row of output.split("\n")) {
    const header = /^([0-9a-f]{40}) \d+ (\d+)/.exec(row);
    if (header) {
      current = { line: Number(header[2]), uncommitted: /^0+$/.test(header[1]!) };
      continue;
    }
    const time = /^committer-time (\d+)$/.exec(row);
    if (time && current) {
      lines.set(current.line, current.uncommitted ? null : Number(time[1]));
      current = null;
    }
  }
  return lines;
}

/** Inputs to `dateResolver`. Each is optional; the build date always applies. */
export interface DateInputs {
  /** From `parseBlamePorcelain`; null when git is unavailable. */
  blame: Map<number, number | null> | null;
  /** The previous generated module's dates, keyed by entry id. */
  previous: Map<string, ResolvedDate>;
  buildDate: Date;
}

/**
 * Dates an unreleased bullet: the commit that introduced the line, else the
 * previous module's date for the same entry, else the build date. Never drops
 * an entry (#231 ruling: show [Unreleased] entries, dated by commit).
 */
export function dateResolver(inputs: DateInputs): (bullet: ParsedBullet, id: string) => ResolvedDate {
  return (bullet, id) => {
    const committed = inputs.blame?.get(bullet.line);
    if (typeof committed === "number") {
      return { date: new Date(committed * 1000).toISOString(), dateSource: "commit" };
    }
    const previous = inputs.previous.get(id);
    if (previous) return previous;
    return { date: inputs.buildDate.toISOString(), dateSource: "build" };
  };
}

/** The generated JSON text. Deterministic for a given entry list. */
export function renderData(entries: ChangelogEntry[]): string {
  return `${JSON.stringify(entries, null, 2)}\n`;
}
