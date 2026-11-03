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
 *   2. both titles name the same, non-empty set of subjects (companies and
 *      products, after aliasing a product to its maker: claude -> anthropic);
 *   3. the titles share at least SAME_EVENT_MIN_SHARED_TERMS event terms —
 *      words left after removing stop words, subjects and generic news words
 *      (including news verbs such as adds, gets, ships), compared after light
 *      suffix stemming. Shared terms adjacent in both titles ("pull requests")
 *      count as one term.
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

/**
 * Companies and products a story is about, mapped to a canonical subject.
 * A product maps to its maker where headlines use both names for one event
 * ("Claude Code extension" / "Anthropic VS Code extension").
 */
const SUBJECTS = new Map<string, string>([
  ["openai", "openai"], ["chatgpt", "openai"], ["codex", "openai"], ["gpt", "openai"],
  ["anthropic", "anthropic"], ["claude", "anthropic"],
  ["google", "google"], ["gemini", "google"],
  ["xai", "xai"], ["grok", "xai"],
  ["cognition", "cognition"], ["devin", "cognition"],
  ["github", "github"], ["copilot", "github"],
  ["microsoft", "microsoft"], ["apple", "apple"], ["amazon", "amazon"], ["meta", "meta"],
  ["nvidia", "nvidia"], ["mistral", "mistral"], ["deepseek", "deepseek"], ["qwen", "qwen"],
  ["llama", "llama"], ["perplexity", "perplexity"], ["cursor", "cursor"],
  ["windsurf", "windsurf"], ["codeium", "windsurf"], ["gitlab", "gitlab"], ["xcode", "xcode"],
  ["replit", "replit"], ["lovable", "lovable"], ["vercel", "vercel"], ["jetbrains", "jetbrains"],
  ["cline", "cline"], ["aider", "aider"], ["tabnine", "tabnine"], ["sourcegraph", "sourcegraph"],
  ["cody", "cody"], ["kiro", "kiro"], ["zed", "zed"], ["bolt", "bolt"],
]);

/**
 * Words that appear in headlines about unrelated events: product-category
 * nouns (code, agent, model), how-to words (setup, guide) and news verbs
 * (adds, gets, ships). Matched against the raw token and every stem candidate.
 */
const GENERIC_TERMS = new Set([
  "code", "coding", "agent", "agentic", "model", "tool", "app", "feature",
  "version", "assistant", "developer", "user", "platform", "plan", "price",
  "pricing", "mode", "new", "now", "how", "why", "what", "when", "who", "this",
  "that", "its", "your", "you", "not", "isnt", "just", "more", "can",
  "use", "using", "all", "out", "one", "says", "said", "guide", "setup",
  "install", "complete", "review", "best", "top", "update", "release",
  "today", "week", "report", "inside", "vs", "versus", "here", "after", "over",
  "available", "generally", "study", "find",
]);

/**
 * #366 review: news verbs. A shared verb ("adds", "gets", "ships") is not
 * evidence of a shared event, in either the same-event test or the #319 score.
 */
const NEWS_VERBS = new Set([
  "add", "get", "ship", "bring", "make", "let", "drop", "roll", "support",
  "raise", "launch", "announce", "unveil", "debut", "introduce", "come",
  "take", "give", "open", "expand", "offer", "enable", "allow", "start",
  "begin", "turn", "hit", "cut", "go", "see", "show", "reveal", "build",
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

/**
 * #366 review: true when the word or any suffix-stripped form is in `set`.
 * stem() keeps 4+ letters, so "adds" stayed "adds" and missed "add".
 */
function inSetAnyForm(set: Set<string>, word: string): boolean {
  if (set.has(word)) return true;
  for (const suffix of ["ing", "ed", "es", "s", "d"]) {
    if (word.endsWith(suffix) && set.has(word.slice(0, -suffix.length))) return true;
  }
  return false;
}

/** True for a news verb in any inflection ("adds", "adding", "shipped"). */
export function isNewsVerb(word: string): boolean {
  return inSetAnyForm(NEWS_VERBS, word);
}

function isGeneric(word: string): boolean {
  return inSetAnyForm(GENERIC_TERMS, word) || isNewsVerb(word);
}

/** Lowercased words with punctuation split out, every word kept, stemmed. */
function rawStems(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map(stem);
}

interface TitleSignature {
  subjects: Set<string>;
  eventTerms: Set<string>;
  /** Adjacent word pairs in the title, "a b", for phrase detection. */
  bigrams: Set<string>;
}

function signature(title: string): TitleSignature {
  const subjects = new Set<string>();
  const eventTerms = new Set<string>();
  const words = title.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/);
  for (const word of words) {
    if (word.length <= 2 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
    const subject = SUBJECTS.get(word);
    if (subject) {
      subjects.add(subject);
      continue;
    }
    if (isGeneric(word)) continue;
    eventTerms.add(stem(word));
  }
  const stems = rawStems(title);
  const bigrams = new Set<string>();
  for (let i = 0; i + 1 < stems.length; i++) bigrams.add(`${stems[i]} ${stems[i + 1]}`);
  return { subjects, eventTerms, bigrams };
}

/** Epoch ms, or NaN when the value is missing or unparseable. */
function toMs(value: string | Date | null | undefined): number {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** #366 review: equal, non-empty subject sets. A subject only one title names tells them apart. */
function sameSubjects(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || a.size !== b.size) return false;
  for (const subject of a) if (!b.has(subject)) return false;
  return true;
}

/**
 * #366 review: true when both titles name subjects and the sets differ
 * ("... available in JetBrains" vs "... in Xcode"). Used by the #319 score.
 */
export function subjectsConflict(title1: string, title2: string): boolean {
  const a = signature(title1).subjects;
  const b = signature(title2).subjects;
  return a.size > 0 && b.size > 0 && !sameSubjects(a, b);
}

/**
 * #366 review: event terms (no subjects, generic words or news verbs) both
 * titles share. Used by the #319 score, which needs two to call a match.
 */
export function sharedEventTermCount(title1: string, title2: string): number {
  const a = signature(title1).eventTerms;
  const b = signature(title2).eventTerms;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared++;
  return shared;
}

/**
 * #366 review: shared event terms, where a run of terms adjacent in both
 * titles ("pull requests") counts once — one noun phrase is one concept.
 */
function sharedEventTerms(a: TitleSignature, b: TitleSignature): number {
  const shared = new Set([...a.eventTerms].filter((t) => b.eventTerms.has(t)));
  let phraseLinks = 0;
  for (const bigram of a.bigrams) {
    if (!b.bigrams.has(bigram)) continue;
    const [first, second] = bigram.split(" ") as [string, string];
    if (shared.has(first) && shared.has(second)) phraseLinks++;
  }
  return shared.size - phraseLinks;
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
 * the titles name the same subjects, and they share at least
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
  if (!sameSubjects(sigA.subjects, sigB.subjects)) return false;
  return sharedEventTerms(sigA, sigB) >= SAME_EVENT_MIN_SHARED_TERMS;
}
