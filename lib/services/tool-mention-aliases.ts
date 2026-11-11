/**
 * Explicit tool-name aliases for the catalogue lookup (#187).
 *
 * Why: the old `ToolMapper` classes (two copies, `article-ingestion.service.ts` and
 * `tool-mapper.service.ts`) turned model, vendor and variant names into one tool's
 * name, and those names feed ranking changes. Dropping them would move public scores,
 * so every alias was kept with its old target, except where the owner ruled (#432).
 * What: lower-cased, trimmed alias -> the target tool's NAME as the old mapper wrote
 * it. The lookup resolves the target to a catalogue row by name or slug; a target
 * that is not an active row leaves the mention unmapped (see `tool-mention-catalogue.ts`).
 * The list is the union of both old copies; they never disagreed on a shared key.
 * #432 (owner ruling D35): 34 suspect aliases (model, vendor and common-word names)
 * are dropped, so they map only when the raw name is a catalogue name or slug; 8 Claude
 * aliases map to the Claude model rows or Claude.AI. The per-alias table is on #432.
 * Test: `tests/unit/tool-mention-aliases-187.test.ts`,
 * `tests/unit/tool-mention-aliases-432.test.ts`.
 */
export const TOOL_ALIASES: Readonly<Record<string, string>> = {
  // OpenAI
  // #432: the GPT model names, "chatgpt" and "openai" are dropped; none names the Canvas feature.
  "chatgpt canvas": "ChatGPT Canvas",
  // Codex-merge: ar-Te2/T76 merged the Codex CLI row into OpenAI Codex; every Codex name lands there.
  "openai codex": "OpenAI Codex",
  "openai codex cli": "OpenAI Codex",
  "codex cli": "OpenAI Codex",
  codex: "OpenAI Codex",
  "gpt-5-codex": "OpenAI Codex",

  // Anthropic
  // #432: a Claude model name maps to its model row, not Claude Code; "claude", "claude 3",
  // "claude 3.5", "claude 4" and "anthropic" name no tier and are dropped.
  "claude 3.5 sonnet": "Claude Sonnet",
  "claude sonnet": "Claude Sonnet",
  "claude opus": "Claude Opus",
  "claude haiku": "claude-haiku", // #432: the slug; the row name carries the version ("Claude Haiku 5.5")
  // #314: Claude Artifacts is renamed Claude.AI (slug claude-artifacts kept); the old name still maps to it.
  "claude artifacts": "Claude.AI",
  "claude.ai": "Claude.AI",
  "claude ai": "Claude.AI",
  "claude canvas": "Claude.AI", // #432: Canvas/Artifacts is a Claude.AI feature, not Claude Code
  "claude code": "Claude Code",
  "claude 4 sonnet": "Claude Sonnet",
  "claude opus 4": "Claude Opus",
  "claude opus 4.1": "Claude Opus",

  // Google
  // #432: Gemini model names, "google ai" and "bard" are dropped; none names Code Assist.
  "gemini code": "Google Gemini Code Assist",
  "gemini code assist": "Google Gemini Code Assist",
  jules: "Google Jules",
  "google jules": "Google Jules",
  "project jules": "Google Jules",

  // GitHub/Microsoft
  // #432: "microsoft copilot" (the Microsoft 365 assistant) is dropped.
  copilot: "GitHub Copilot",
  "github copilot": "GitHub Copilot",
  "copilot x": "GitHub Copilot",
  "copilot chat": "GitHub Copilot",
  "copilot workspace": "GitHub Copilot",
  "vs code copilot": "GitHub Copilot",

  // Amazon
  codewhisperer: "Amazon Q Developer",
  "amazon q": "Amazon Q Developer",
  "q developer": "Amazon Q Developer",
  "aws codewhisperer": "Amazon Q Developer",
  "amazon codewhisperer": "Amazon Q Developer",

  // Other tools
  // #432: company names and common words ("agent 3", "cognition", "sourcegraph", "magic",
  // "pieces", "sweep", "menlo", "factory", "genie", ...) are dropped; the specific forms stay.
  replit: "Replit Agent",
  "replit agent": "Replit Agent",
  "replit ai": "Replit Agent",
  ghostwriter: "Replit Agent",
  "replit agent 3": "Replit Agent",
  devin: "Devin",
  "devin ai": "Devin",
  cursor: "Cursor",
  "cursor ai": "Cursor",
  "cursor editor": "Cursor",
  windsurf: "Windsurf",
  codeium: "Windsurf", // Codeium is the company behind Windsurf
  "codeium windsurf": "Windsurf",
  v0: "v0",
  "v0.dev": "v0",
  "vercel v0": "v0",
  aider: "Aider",
  "aider chat": "Aider",
  tabnine: "Tabnine",
  "tabnine ai": "Tabnine",
  cody: "Sourcegraph Cody",
  "sourcegraph cody": "Sourcegraph Cody",
  continue: "Continue",
  "continue dev": "Continue",
  "continue.dev": "Continue",
  cline: "Cline",
  "claude-dev": "Cline", // Cline's former name
  "claude dev": "Cline", // Cline's former name
  openhands: "OpenHands",
  "open hands": "OpenHands",
  "all hands": "OpenHands",
  "jetbrains ai": "JetBrains AI Assistant",
  "intellij ai": "JetBrains AI Assistant",
  "jetbrains ai assistant": "JetBrains AI Assistant",
  "pycharm ai": "JetBrains AI Assistant",
  "webstorm ai": "JetBrains AI Assistant",
  qodo: "Qodo Gen",
  "qodo gen": "Qodo Gen",
  codiumai: "Qodo Gen",
  "codium ai": "Qodo Gen",
  coderabbit: "CodeRabbit",
  "code rabbit": "CodeRabbit",
  bolt: "Bolt.new",
  "bolt.new": "Bolt.new",
  "stackblitz bolt": "Bolt.new",
  augment: "Augment Code",
  "augment code": "Augment Code",
  "augment ai": "Augment Code",
  lovable: "Lovable",
  "lovable.dev": "Lovable",
  "lovable ai": "Lovable",
  zed: "Zed",
  "zed ai": "Zed",
  "zed editor": "Zed",
  kiro: "Kiro",
  "kiro ai": "Kiro",
  snyk: "Snyk Code",
  "snyk code": "Snyk Code",
  intellicode: "Microsoft IntelliCode",
  "microsoft intellicode": "Microsoft IntelliCode",
  "visual studio intellicode": "Microsoft IntelliCode",
  sourcery: "Sourcery",
  "sourcery ai": "Sourcery",
  diffblue: "Diffblue Cover",
  "diffblue cover": "Diffblue Cover",
  "magic.dev": "Magic",
  "magic ai": "Magic",
  supermaven: "Supermaven",
  "super maven": "Supermaven",
  "pieces for developers": "Pieces",
  "pieces app": "Pieces",
  bito: "Bito",
  "bito ai": "Bito",
  mutable: "Mutable",
  "mutable ai": "Mutable",
  "sweep ai": "Sweep",
  phind: "Phind",
  "phind.com": "Phind",
  perplexity: "Perplexity",
  "perplexity ai": "Perplexity",
  "factory ai": "Factory",
  poolside: "Poolside",
  "poolside ai": "Poolside",
  cosine: "Cosine Genie",
  "cosine genie": "Cosine Genie",
};

/** The aliases whose target name or slug is not in `byKey` (a catalogue's lookup keys). */
export function unresolvedAliasTargets(byKey: ReadonlyMap<string, unknown>): Array<[alias: string, target: string]> {
  return Object.entries(TOOL_ALIASES).filter(([, target]) => !byKey.has(target.trim().toLowerCase()));
}
