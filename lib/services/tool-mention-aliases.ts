/**
 * Explicit tool-name aliases for the catalogue lookup (#187).
 *
 * Why: the old `ToolMapper` classes (two copies, `article-ingestion.service.ts` and
 * `tool-mapper.service.ts`) turned model, vendor and variant names into one tool's
 * name, and those names feed ranking changes. Dropping them would move public scores,
 * so every alias is kept and keeps its old target.
 * What: lower-cased, trimmed alias -> the target tool's NAME as the old mapper wrote
 * it. The lookup resolves the target to a catalogue row by name or slug; a target
 * that is not an active row leaves the mention unmapped (see `tool-mention-catalogue.ts`).
 * The list is the union of both old copies; they never disagreed on a shared key.
 * A `// suspect:` comment marks an alias that maps to a different product than the
 * name says. The mapping is unchanged; the owner decides whether to correct it.
 * Test: `tests/unit/tool-mention-aliases-187.test.ts`.
 */
export const TOOL_ALIASES: Readonly<Record<string, string>> = {
  // OpenAI
  "gpt-4": "ChatGPT Canvas", // suspect: a model name, mapped to a product
  "gpt-4o": "ChatGPT Canvas", // suspect: a model name, mapped to a product
  "gpt-4-turbo": "ChatGPT Canvas", // suspect: a model name, mapped to a product
  chatgpt: "ChatGPT Canvas", // suspect: the ChatGPT app, mapped to its Canvas feature
  "chatgpt canvas": "ChatGPT Canvas",
  // Codex-merge: ar-Te2/T76 merged the Codex CLI row into OpenAI Codex; every Codex name lands there.
  "openai codex": "OpenAI Codex",
  "openai codex cli": "OpenAI Codex",
  "codex cli": "OpenAI Codex",
  codex: "OpenAI Codex",
  "gpt-5": "ChatGPT Canvas", // suspect: a model name, mapped to a product
  "gpt-5-codex": "OpenAI Codex",
  "gpt-3.5": "ChatGPT Canvas", // suspect: a model name, mapped to a product
  "gpt-3": "ChatGPT Canvas", // suspect: a model name, mapped to a product
  openai: "ChatGPT Canvas", // suspect: the vendor, mapped to one of its products

  // Anthropic
  claude: "Claude Code", // suspect: the model family, mapped to the coding harness
  "claude 3": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude 3.5": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude 3.5 sonnet": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude sonnet": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude opus": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude haiku": "Claude Code", // suspect: a model name, mapped to the coding harness
  // #314: Claude Artifacts is renamed Claude.AI (slug claude-artifacts kept); the old name still maps to it.
  "claude artifacts": "Claude.AI",
  "claude.ai": "Claude.AI",
  "claude ai": "Claude.AI",
  "claude canvas": "Claude Code", // suspect: Canvas/Artifacts is a Claude.AI feature, not Claude Code
  "claude code": "Claude Code",
  "claude 4": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude 4 sonnet": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude opus 4": "Claude Code", // suspect: a model name, mapped to the coding harness
  "claude opus 4.1": "Claude Code", // suspect: a model name, mapped to the coding harness
  anthropic: "Claude Code", // suspect: the vendor, mapped to one of its products

  // Google
  gemini: "Google Gemini Code Assist", // suspect: the model family, mapped to the code-assist product
  "gemini pro": "Google Gemini Code Assist", // suspect: a model name, mapped to the code-assist product
  "gemini ultra": "Google Gemini Code Assist", // suspect: a model name, mapped to the code-assist product
  "gemini code": "Google Gemini Code Assist",
  "gemini 1.5": "Google Gemini Code Assist", // suspect: a model name, mapped to the code-assist product
  "gemini 2.0": "Google Gemini Code Assist", // suspect: a model name, mapped to the code-assist product
  "gemini 2.5": "Google Gemini Code Assist", // suspect: a model name, mapped to the code-assist product
  "gemini 2.5 pro": "Google Gemini Code Assist", // suspect: a model name, mapped to the code-assist product
  "gemini code assist": "Google Gemini Code Assist",
  jules: "Google Jules",
  "google jules": "Google Jules",
  "project jules": "Google Jules",
  "google ai": "Google Gemini Code Assist", // suspect: the vendor's AI umbrella, mapped to one product
  bard: "Google Gemini Code Assist", // suspect: Bard was the chatbot, not a code assistant

  // GitHub/Microsoft
  copilot: "GitHub Copilot",
  "github copilot": "GitHub Copilot",
  "copilot x": "GitHub Copilot",
  "copilot chat": "GitHub Copilot",
  "copilot workspace": "GitHub Copilot",
  "microsoft copilot": "GitHub Copilot", // suspect: Microsoft Copilot is the Microsoft 365 assistant, not GitHub Copilot
  "vs code copilot": "GitHub Copilot",

  // Amazon
  codewhisperer: "Amazon Q Developer",
  "amazon q": "Amazon Q Developer",
  "q developer": "Amazon Q Developer",
  "aws codewhisperer": "Amazon Q Developer",
  "amazon codewhisperer": "Amazon Q Developer",

  // Other tools
  replit: "Replit Agent",
  "replit agent": "Replit Agent",
  "replit ai": "Replit Agent",
  ghostwriter: "Replit Agent",
  "agent 3": "Replit Agent", // suspect: a generic name, taken to be Replit's Agent 3
  "replit agent 3": "Replit Agent",
  cognition: "Devin", // suspect: the company (it also owns Windsurf), mapped to one product
  "cognition ai": "Devin", // suspect: the company (it also owns Windsurf), mapped to one product
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
  sourcegraph: "Sourcegraph Cody", // suspect: the company, mapped to one product
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
  magic: "Magic", // suspect: a common word, taken to be Magic.dev
  "magic.dev": "Magic",
  "magic ai": "Magic",
  supermaven: "Supermaven",
  "super maven": "Supermaven",
  pieces: "Pieces", // suspect: a common word, taken to be Pieces for Developers
  "pieces for developers": "Pieces",
  "pieces app": "Pieces",
  bito: "Bito",
  "bito ai": "Bito",
  mutable: "Mutable",
  "mutable ai": "Mutable",
  sweep: "Sweep", // suspect: a common word, taken to be Sweep AI
  "sweep ai": "Sweep",
  menlo: "Menlo", // suspect: a common word, taken to be the AI tool
  "menlo security": "Menlo", // suspect: Menlo Security is a web-security company, not an AI coding tool
  phind: "Phind",
  "phind.com": "Phind",
  perplexity: "Perplexity",
  "perplexity ai": "Perplexity",
  factory: "Factory", // suspect: a common word, taken to be Factory AI
  "factory ai": "Factory",
  poolside: "Poolside",
  "poolside ai": "Poolside",
  cosine: "Cosine Genie",
  genie: "Cosine Genie", // suspect: "Genie" is also other vendors' products (e.g. Databricks Genie)
  "cosine genie": "Cosine Genie",
};

/** The aliases whose target name or slug is not in `byKey` (a catalogue's lookup keys). */
export function unresolvedAliasTargets(byKey: ReadonlyMap<string, unknown>): Array<[alias: string, target: string]> {
  return Object.entries(TOOL_ALIASES).filter(([, target]) => !byKey.has(target.trim().toLowerCase()));
}
