/**
 * Same-event duplicate detection for daily-news ingestion (#366).
 *
 * Why: several outlets report one event under differently worded headlines
 * ("Hijacked Claude Code extension on Cursor...", "Malicious Claude Code
 * extension in Cursor..."). Their word Jaccard sits below
 * SEMANTIC_DUPLICATE_MIN_WORD_OVERLAP, so the #319 title filter keeps all of
 * them and one event takes several feed slots. Lowering that floor would bring
 * back #319: distinct stories that only share a tool name.
 *
 * What: a second, narrower test the semantic filter applies next to the title
 * score. Two articles are the same event only when all three hold:
 *   1. both publish dates parse and lie within SAME_EVENT_WINDOW_DAYS;
 *   2. the titles name at least one common subject (a company or product);
 *   3. the titles share at least SAME_EVENT_MIN_SHARED_TERMS event terms —
 *      words left after removing stop words, subjects and generic news words,
 *      compared after light suffix stemming.
 * A missing or unparseable date never matches, so an unsure pair is kept.
 * Deterministic: no LLM or network call.
 *
 * Test: lib/services/automated-ingestion.same-event-dedup.test.ts.
 */

/** Maximum distance between two publish dates for one event (#366). */
export const SAME_EVENT_WINDOW_DAYS = 3;

/** Minimum number of shared event terms between two titles (#366). */
export const SAME_EVENT_MIN_SHARED_TERMS = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Words the title normalizer already drops in the #319 filter. */
const STOP_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "to", "for", "of", "with", "by",
  "is", "are", "was", "were", "be", "been", "being", "has", "have", "had",
  "do", "does", "did", "will", "would", "should", "could", "may", "might",
  "and", "or", "but", "if", "then", "than", "as", "from", "into", "about",
]);

/** Companies and products a story is about. Sharing one is necessary, never sufficient. */
const SUBJECTS = new Set([
  "openai", "anthropic", "google", "microsoft", "apple", "amazon", "meta",
  "nvidia", "xai", "mistral", "deepseek", "qwen", "llama", "perplexity",
  "claude", "chatgpt", "gemini", "copilot", "codex", "gpt", "grok",
  "cursor", "windsurf", "devin", "cognition", "github", "gitlab", "xcode",
  "replit", "lovable", "vercel", "jetbrains", "cline", "aider", "tabnine",
  "sourcegraph", "cody", "kiro", "zed", "codeium", "bolt",
]);

/**
 * Words that appear in headlines about unrelated events: product-category
 * nouns (code, agent, model), how-to words (setup, guide) and news verbs
 * (launches, adds). Matched on the raw token and on its stem.
 */
const GENERIC_TERMS = new Set([
  "code", "coding", "agent", "agentic", "model", "tool", "app", "feature",
  "version", "assistant", "developer", "user", "platform", "plan", "price",
  "pricing", "new", "now", "how", "why", "what", "when", "who", "this",
  "that", "its", "your", "you", "not", "isnt", "just", "more", "can", "get",
  "use", "using", "all", "out", "one", "says", "said", "guide", "setup",
  "install", "complete", "review", "best", "top", "update", "release",
  "launch", "announce", "unveil", "add", "debut", "introduce", "study",
  "find", "available", "support", "today",
  "week", "report", "inside", "vs", "versus", "here", "after", "over",
]);

/** Strips a common inflection so "hijacked"/"hijacks" and "models"/"model" match. */
function stem(word: string): string {
  for (const suffix of ["ing", "ed", "es", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function tokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

interface TitleSignature {
  subjects: Set<string>;
  eventTerms: Set<string>;
}

function signature(title: string): TitleSignature {
  const subjects = new Set<string>();
  const eventTerms = new Set<string>();
  for (const word of tokens(title)) {
    if (SUBJECTS.has(word)) {
      subjects.add(word);
      continue;
    }
    const stemmed = stem(word);
    if (GENERIC_TERMS.has(word) || GENERIC_TERMS.has(stemmed)) continue;
    eventTerms.add(stemmed);
  }
  return { subjects, eventTerms };
}

/** Epoch ms, or NaN when the value is missing or unparseable. */
function toMs(value: string | Date | null | undefined): number {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function countShared(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return shared;
}

/** The fields the same-event test reads from a candidate or a stored article. */
export interface DatedTitle {
  title: string;
  publishedDate?: string | Date | null;
}

/**
 * Why: see the file header — collapse one event reported by several sources
 * without merging distinct stories about the same tool (#319).
 * What: true only when both dates parse and lie within SAME_EVENT_WINDOW_DAYS,
 * the titles share a subject, and they share at least
 * SAME_EVENT_MIN_SHARED_TERMS event terms. Symmetric in its arguments.
 * Test: `isSameEvent` cases in automated-ingestion.same-event-dedup.test.ts.
 */
export function isSameEvent(a: DatedTitle, b: DatedTitle): boolean {
  const aMs = toMs(a.publishedDate);
  const bMs = toMs(b.publishedDate);
  // Unknown date: cannot place the pair in one window, so keep both.
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return false;
  if (Math.abs(aMs - bMs) > SAME_EVENT_WINDOW_DAYS * MS_PER_DAY) return false;

  const sigA = signature(a.title);
  const sigB = signature(b.title);
  if (countShared(sigA.subjects, sigB.subjects) === 0) return false;
  return countShared(sigA.eventTerms, sigB.eventTerms) >= SAME_EVENT_MIN_SHARED_TERMS;
}
