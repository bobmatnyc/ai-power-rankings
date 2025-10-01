/**
 * Tool Name Mapping and Normalization Service
 * Handles mapping of tool name variations to canonical database names
 * Migrated from old site with complete alias coverage
 */

/**
 * Tool name mapping and normalization utilities
 */
export class ToolMapper {
  // Map of common variations to canonical database tool names
  // This comprehensive mapping ensures consistent tool identification across articles
  private static readonly TOOL_ALIASES: Record<string, string> = {
    // OpenAI variations
    "gpt-4": "ChatGPT Canvas",
    "gpt-4o": "ChatGPT Canvas",
    "gpt-4-turbo": "ChatGPT Canvas",
    chatgpt: "ChatGPT Canvas",
    "chatgpt canvas": "ChatGPT Canvas",
    "openai codex": "OpenAI Codex CLI",
    codex: "OpenAI Codex CLI",
    "gpt-5": "ChatGPT Canvas", // Future model
    "gpt-5-codex": "OpenAI Codex CLI", // Future model
    "gpt-3.5": "ChatGPT Canvas",
    "gpt-3": "ChatGPT Canvas",
    "openai": "ChatGPT Canvas",

    // Anthropic variations
    claude: "Claude Code",
    "claude 3": "Claude Code",
    "claude 3.5": "Claude Code",
    "claude 3.5 sonnet": "Claude Code",
    "claude sonnet": "Claude Code",
    "claude opus": "Claude Code",
    "claude haiku": "Claude Code",
    "claude artifacts": "Claude Artifacts",
    "claude canvas": "Claude Code", // Claude's Canvas is part of Claude Code
    "claude code": "Claude Code",
    "claude 4": "Claude Code",
    "claude 4 sonnet": "Claude Code",
    "anthropic": "Claude Code",

    // Google variations
    gemini: "Google Gemini Code Assist",
    "gemini pro": "Google Gemini Code Assist",
    "gemini ultra": "Google Gemini Code Assist",
    "gemini code": "Google Gemini Code Assist",
    "gemini 1.5": "Google Gemini Code Assist",
    "gemini 2.0": "Google Gemini Code Assist",
    "gemini code assist": "Google Gemini Code Assist",
    jules: "Google Jules",
    "google jules": "Google Jules",
    "project jules": "Google Jules",
    "google ai": "Google Gemini Code Assist",
    bard: "Google Gemini Code Assist", // Bard was rebranded to Gemini

    // GitHub/Microsoft variations
    copilot: "GitHub Copilot",
    "github copilot": "GitHub Copilot",
    "copilot x": "GitHub Copilot",
    "copilot chat": "GitHub Copilot",
    "copilot workspace": "GitHub Copilot",
    "microsoft copilot": "GitHub Copilot",
    "vs code copilot": "GitHub Copilot",

    // Amazon variations
    codewhisperer: "Amazon Q Developer",
    "amazon q": "Amazon Q Developer",
    "q developer": "Amazon Q Developer",
    "aws codewhisperer": "Amazon Q Developer",
    "amazon codewhisperer": "Amazon Q Developer",

    // Replit variations
    replit: "Replit Agent",
    "replit agent": "Replit Agent",
    "replit ai": "Replit Agent",
    ghostwriter: "Replit Agent", // Replit's AI feature

    // Devin variations
    cognition: "Devin",
    "cognition ai": "Devin",
    devin: "Devin",
    "devin ai": "Devin",

    // Cursor variations
    cursor: "Cursor",
    "cursor ai": "Cursor",
    "cursor editor": "Cursor",

    // Windsurf variations
    windsurf: "Windsurf",
    codeium: "Windsurf", // Codeium is the company behind Windsurf
    "codeium windsurf": "Windsurf",

    // v0 variations
    v0: "v0",
    "v0.dev": "v0",
    "vercel v0": "v0",

    // Aider variations
    aider: "Aider",
    "aider chat": "Aider",

    // Tabnine variations
    tabnine: "Tabnine",
    "tabnine ai": "Tabnine",

    // Sourcegraph Cody variations
    cody: "Sourcegraph Cody",
    "sourcegraph cody": "Sourcegraph Cody",
    "sourcegraph": "Sourcegraph Cody",

    // Continue variations
    continue: "Continue",
    "continue dev": "Continue",
    "continue.dev": "Continue",

    // Cline variations (formerly Claude-Dev)
    cline: "Cline",
    "claude-dev": "Cline",
    "claude dev": "Cline",

    // OpenHands variations
    openhands: "OpenHands",
    "open hands": "OpenHands",
    "all hands": "OpenHands", // Former name

    // JetBrains variations
    "jetbrains ai": "JetBrains AI Assistant",
    "intellij ai": "JetBrains AI Assistant",
    "jetbrains ai assistant": "JetBrains AI Assistant",
    "pycharm ai": "JetBrains AI Assistant",
    "webstorm ai": "JetBrains AI Assistant",

    // Qodo variations
    qodo: "Qodo Gen",
    "qodo gen": "Qodo Gen",
    codiumai: "Qodo Gen",
    "codium ai": "Qodo Gen",

    // CodeRabbit variations
    coderabbit: "CodeRabbit",
    "code rabbit": "CodeRabbit",

    // Bolt.new variations
    bolt: "Bolt.new",
    "bolt.new": "Bolt.new",
    "stackblitz bolt": "Bolt.new",

    // Augment variations
    augment: "Augment Code",
    "augment code": "Augment Code",
    "augment ai": "Augment Code",

    // Lovable variations
    lovable: "Lovable",
    "lovable.dev": "Lovable",
    "lovable ai": "Lovable",

    // Zed variations
    zed: "Zed",
    "zed ai": "Zed",
    "zed editor": "Zed",

    // Kiro variations
    kiro: "Kiro",
    "kiro ai": "Kiro",

    // Snyk variations
    snyk: "Snyk Code",
    "snyk code": "Snyk Code",

    // Microsoft IntelliCode variations
    intellicode: "Microsoft IntelliCode",
    "microsoft intellicode": "Microsoft IntelliCode",
    "visual studio intellicode": "Microsoft IntelliCode",

    // Sourcery variations
    sourcery: "Sourcery",
    "sourcery ai": "Sourcery",

    // Diffblue variations
    diffblue: "Diffblue Cover",
    "diffblue cover": "Diffblue Cover",

    // Magic variations
    magic: "Magic",
    "magic.dev": "Magic",
    "magic ai": "Magic",

    // Supermaven variations
    supermaven: "Supermaven",
    "super maven": "Supermaven",

    // Pieces variations
    pieces: "Pieces",
    "pieces for developers": "Pieces",
    "pieces app": "Pieces",

    // Bito variations
    bito: "Bito",
    "bito ai": "Bito",

    // Mutable variations
    mutable: "Mutable",
    "mutable ai": "Mutable",

    // Sweep variations
    sweep: "Sweep",
    "sweep ai": "Sweep",

    // Menlo variations
    menlo: "Menlo",
    "menlo security": "Menlo",

    // Phind variations
    phind: "Phind",
    "phind.com": "Phind",

    // Perplexity variations
    perplexity: "Perplexity",
    "perplexity ai": "Perplexity",

    // Factory variations
    factory: "Factory",
    "factory ai": "Factory",

    // Poolside variations
    poolside: "Poolside",
    "poolside ai": "Poolside",

    // Cosine variations
    cosine: "Cosine Genie",
    genie: "Cosine Genie",
    "cosine genie": "Cosine Genie",
  };

  // Known tool names in our database for fuzzy matching
  private static readonly KNOWN_TOOLS = [
    "Claude Code",
    "GitHub Copilot",
    "Cursor",
    "ChatGPT Canvas",
    "v0",
    "Kiro",
    "Windsurf",
    "Google Jules",
    "Amazon Q Developer",
    "Lovable",
    "Aider",
    "Tabnine",
    "Bolt.new",
    "Augment Code",
    "Google Gemini Code Assist",
    "Replit Agent",
    "Zed",
    "OpenAI Codex CLI",
    "Devin",
    "Continue",
    "Claude Artifacts",
    "Sourcegraph Cody",
    "Cline",
    "OpenHands",
    "JetBrains AI Assistant",
    "Qodo Gen",
    "CodeRabbit",
    "Snyk Code",
    "Microsoft IntelliCode",
    "Sourcery",
    "Diffblue Cover",
    "Magic",
    "Supermaven",
    "Pieces",
    "Bito",
    "Mutable",
    "Sweep",
    "Menlo",
    "Phind",
    "Perplexity",
    "Factory",
    "Poolside",
    "Cosine Genie",
  ];

  /**
   * Normalize a tool name to match database entries
   */
  static normalizeTool(toolName: string): string {
    if (!toolName) return toolName;

    // First check if it's already a known tool name
    if (ToolMapper.KNOWN_TOOLS.includes(toolName)) {
      return toolName;
    }

    // Check aliases (case-insensitive)
    const lowerName = toolName.toLowerCase().trim();
    const aliasMatch = ToolMapper.TOOL_ALIASES[lowerName];
    if (aliasMatch) {
      return aliasMatch;
    }

    // Try fuzzy matching for partial matches
    const fuzzyMatch = ToolMapper.fuzzyMatch(toolName);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    // Return original if no match found (might be a new tool)
    return toolName;
  }

  /**
   * Fuzzy match a tool name against known tools
   */
  private static fuzzyMatch(toolName: string): string | null {
    const lowerName = toolName.toLowerCase();

    // Check if any known tool name contains the input or vice versa
    for (const knownTool of ToolMapper.KNOWN_TOOLS) {
      const lowerKnown = knownTool.toLowerCase();

      // Check if the known tool contains the input or vice versa
      if (lowerKnown.includes(lowerName) || lowerName.includes(lowerKnown)) {
        return knownTool;
      }

      // Check if they share significant words (for multi-word tools)
      const inputWords = lowerName.split(/\s+/);
      const knownWords = lowerKnown.split(/\s+/);
      const significantWords = inputWords.filter((w) => w.length > 3);
      const matchingWords = significantWords.filter((w) =>
        knownWords.some((kw) => kw.includes(w) || w.includes(kw))
      );

      // If more than half of significant words match, consider it a match
      if (significantWords.length > 0 && matchingWords.length >= significantWords.length / 2) {
        return knownTool;
      }
    }

    return null;
  }

  /**
   * Process tool mentions and normalize names
   */
  static processToolMentions<
    T extends {
      tool: string;
      [key: string]: any;
    }
  >(mentions: T[]): T[] {
    return mentions.map((mention) => ({
      ...mention,
      tool: ToolMapper.normalizeTool(mention.tool),
    }));
  }

  /**
   * Get all known tool names
   */
  static getKnownTools(): string[] {
    return [...ToolMapper.KNOWN_TOOLS];
  }

  /**
   * Get all aliases for a specific tool
   */
  static getAliasesForTool(toolName: string): string[] {
    const aliases: string[] = [];
    for (const [alias, canonical] of Object.entries(ToolMapper.TOOL_ALIASES)) {
      if (canonical === toolName) {
        aliases.push(alias);
      }
    }
    return aliases;
  }

  /**
   * Check if a tool name is a known alias
   */
  static isKnownAlias(toolName: string): boolean {
    const lowerName = toolName.toLowerCase().trim();
    return lowerName in ToolMapper.TOOL_ALIASES;
  }

  /**
   * Get statistics about the tool mapping system
   */
  static getStats() {
    return {
      knownTools: ToolMapper.KNOWN_TOOLS.length,
      totalAliases: Object.keys(ToolMapper.TOOL_ALIASES).length,
      averageAliasesPerTool:
        Object.keys(ToolMapper.TOOL_ALIASES).length / ToolMapper.KNOWN_TOOLS.length,
    };
  }
}
