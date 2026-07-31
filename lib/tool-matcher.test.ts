import { describe, expect, it } from "vitest";
import { findToolByText, getToolMapping, getToolSearchTerms } from "./tool-matcher";

// Re-enabled for #76 (bit-rotted before vitest was wired, #10).
//
// Every assertion was rewritten against the ACTUAL current `defaultToolMappings`
// in ./tool-matcher.ts (verified by direct execution, not by inspection), not
// against the finer-grained tool taxonomy this file's old comments assumed
// (e.g. it expected "chatgpt-canvas"/"claude-artifacts"/"amazon-q-developer"/
// "replit-agent", but the real map only knows "chatgpt"/"claude"/
// "amazon-codewhisperer"/"replit-ai").
//
// REAL BUG FOUND, reported separately rather than fixed here (see PR body):
// `findToolByText` is live in production (app/api/news/route.ts and
// app/api/news/[slug]/route.ts, used to derive a news article's primary tool
// slug), but `defaultToolMappings` here only knows 15 tools and several of
// its slugs no longer match the real tool taxonomy used elsewhere in the app
// (e.g. rankings data has separate "claude-code" / "claude-artifacts" tools,
// but this matcher can only ever return "claude" for either). It's also
// missing ~20 tools present in lib/services/article-ingestion.service.ts's
// ToolMapper (aider, continue, cline, openhands, jetbrains-ai, coderabbit,
// sourcery, diffblue, snyk, augment, zed, kiro, jules, microsoft intellicode,
// qodo, etc). Fixing the taxonomy mismatch is a real, if minor,
// mis-attribution bug for news tool tagging, but expanding/renaming
// `defaultToolMappings` to match the live taxonomy is a non-trivial,
// separate change — out of scope for a test re-enablement PR. Assertions
// below that hit this gap intentionally expect `null` and are commented
// inline as "known gap", so this test suite won't silently start masking the
// gap if it's ever fixed.
describe("ToolMatcher - Text-based Tool Detection", () => {
  describe("findToolByText", () => {
    it("should find tools by exact search terms", () => {
      expect(findToolByText("I am using ChatGPT Canvas for coding")).toBe("chatgpt");
      // "Claude Code" matches the "claude" mapping's "claude" term first
      expect(findToolByText("Claude Code is great")).toBe("claude");
      expect(findToolByText("GitHub Copilot helps me code")).toBe("github-copilot");
      expect(findToolByText("Replit Agent is amazing")).toBe("replit-ai");
      expect(findToolByText("Devin by Cognition AI")).toBe("devin");
    });

    it("should demonstrate search order prioritization", () => {
      // Even "claude code" matches "claude" first due to word boundary matching
      expect(findToolByText("claude code")).toBe("claude");
      expect(findToolByText("using claude code today")).toBe("claude");

      // No word boundary match for "claude" (it's fused into "claudecode")
      expect(findToolByText("coding with claudecode tool")).toBe(null);
    });

    it("should find tools by alternative search terms", () => {
      expect(findToolByText("Using claude.ai for development")).toBe("claude");
      expect(findToolByText("Anthropic Claude is helpful")).toBe("claude");
      expect(findToolByText("I love using Copilot")).toBe("github-copilot");
      expect(findToolByText("Amazon CodeWhisperer rocks")).toBe("amazon-codewhisperer");
      expect(findToolByText("Gemini Code helps me")).toBe("gemini");
    });

    it("should handle case insensitive matching", () => {
      expect(findToolByText("CLAUDE CODE is great")).toBe("claude");
      expect(findToolByText("chatgpt canvas for coding")).toBe("chatgpt");
      expect(findToolByText("GITHUB COPILOT helps")).toBe("github-copilot");
      expect(findToolByText("replit agent is amazing")).toBe("replit-ai");
    });

    it("should find tools with word boundaries", () => {
      expect(findToolByText("I use Cursor editor daily")).toBe("cursor");
      // Known gap: Aider, Continue and Cline aren't in defaultToolMappings at all
      expect(findToolByText("Aider chat is useful")).toBeNull();
      expect(findToolByText("Continue dev extension")).toBeNull();
      expect(findToolByText("Cline VSCode extension")).toBeNull();
    });

    it("should handle possessive forms", () => {
      expect(findToolByText("Claude's capabilities are amazing")).toBe("claude");
      expect(findToolByText("Cursor's AI features are great")).toBe("cursor");
      // Known gap: Aider isn't in defaultToolMappings at all
      expect(findToolByText("Aider's code generation")).toBeNull();
      expect(findToolByText("Devin's autonomous coding")).toBe("devin");
    });

    it("should prioritize more specific matches", () => {
      // Should match "ChatGPT Canvas" rather than generic "canvas"
      expect(findToolByText("Using ChatGPT Canvas for UI")).toBe("chatgpt");

      // "Claude Code" matches "claude" first due to search order
      expect(findToolByText("Claude Code is my favorite")).toBe("claude");

      // Known gap: "Amazon Q Developer" isn't a search term for
      // amazon-codewhisperer (only "codewhisperer" variants are)
      expect(findToolByText("Amazon Q Developer helps")).toBeNull();
    });

    it("should return null for unmatched text", () => {
      expect(findToolByText("This mentions no AI tools")).toBeNull();
      expect(findToolByText("Just some random text")).toBeNull();
      expect(findToolByText("Programming without AI")).toBeNull();
      expect(findToolByText("")).toBeNull();
    });

    it("should handle partial word matches correctly", () => {
      // Should NOT match partial words
      expect(findToolByText("I like cursory reviews")).toBeNull(); // "cursor" in "cursory"
      expect(findToolByText("The aiderman helped")).toBeNull(); // "aider" in "aiderman" (also: not in the map at all)
      // Known gap: "continue" isn't in defaultToolMappings at all
      expect(findToolByText("Continue developing")).toBeNull();
    });

    it("should find multiple tools mentioned in same text", () => {
      // findToolByText returns the first match based on specificity
      const text = "I use both Claude Code and GitHub Copilot for development";
      const result = findToolByText(text);
      // Should return one of them (the more specific/longer match first)
      expect(["claude", "github-copilot"]).toContain(result);
    });

    it("should handle complex search terms", () => {
      expect(findToolByText("Using v0.dev for rapid prototyping")).toBe("v0");
      expect(findToolByText("Bolt.new is great for quick apps")).toBe("bolt");
      // Known gap: OpenHands isn't in defaultToolMappings at all
      expect(findToolByText("OpenHands helps with coding")).toBeNull();
      expect(findToolByText("All Hands AI project")).toBeNull();
    });

    it("should handle company name variations", () => {
      expect(findToolByText("Cognition Devin is impressive")).toBe("devin");
      expect(findToolByText("Cognition AI developed Devin")).toBe("devin");
      expect(findToolByText("Sourcegraph Cody extension")).toBe("cody");
      // Known gap: JetBrains AI Assistant isn't in defaultToolMappings at all
      expect(findToolByText("JetBrains AI Assistant")).toBeNull();
    });

    it("should handle tool variations and aliases", () => {
      expect(findToolByText("Using Gemini for code")).toBe("gemini");
      expect(findToolByText("Google Gemini helps")).toBe("gemini");
      // Known gap: "Duet AI" / "Google Duet" aren't search terms for gemini here
      expect(findToolByText("Duet AI from Google")).toBeNull();
      // Known gap: Microsoft IntelliCode isn't in defaultToolMappings at all
      expect(findToolByText("Microsoft IntelliCode suggestions")).toBeNull();
      expect(findToolByText("Visual Studio IntelliCode")).toBeNull();
    });
  });

  describe("getToolSearchTerms", () => {
    it("should return search terms for known tools", () => {
      const claudeTerms = getToolSearchTerms("claude");
      expect(claudeTerms).toEqual(["claude", "claude ai", "anthropic claude", "claude code"]);

      const copilotTerms = getToolSearchTerms("github-copilot");
      expect(copilotTerms).toEqual(["github copilot", "copilot", "gh copilot"]);

      const geminiTerms = getToolSearchTerms("gemini");
      expect(geminiTerms).toEqual(["gemini", "google gemini", "gemini ai", "gemini code"]);
    });

    it("should return empty array for unknown tools", () => {
      expect(getToolSearchTerms("unknown-tool")).toEqual([]);
      expect(getToolSearchTerms("nonexistent")).toEqual([]);
      // Known gap: "claude-code" and "gemini-code-assist" are the real
      // taxonomy's slugs, but defaultToolMappings only knows "claude"/"gemini"
      expect(getToolSearchTerms("claude-code")).toEqual([]);
      expect(getToolSearchTerms("gemini-code-assist")).toEqual([]);
    });
  });

  describe("getToolMapping", () => {
    it("should return mapping for known tools", () => {
      const claudeMapping = getToolMapping("claude");
      expect(claudeMapping).toEqual({
        tool_slug: "claude",
        tool_name: "Claude",
        search_terms: ["claude", "claude ai", "anthropic claude", "claude code"],
      });

      const copilotMapping = getToolMapping("github-copilot");
      expect(copilotMapping).toEqual({
        tool_slug: "github-copilot",
        tool_name: "GitHub Copilot",
        search_terms: ["github copilot", "copilot", "gh copilot"],
      });
    });

    it("should return null for unknown tools", () => {
      expect(getToolMapping("unknown-tool")).toBeNull();
      expect(getToolMapping("nonexistent")).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle null and undefined inputs", () => {
      expect(findToolByText(null as unknown as string)).toBeNull();
      expect(findToolByText(undefined as unknown as string)).toBeNull();
    });

    it("should handle empty string", () => {
      expect(findToolByText("")).toBeNull();
    });

    it("should handle whitespace-only strings", () => {
      expect(findToolByText("   ")).toBeNull();
      expect(findToolByText("\t\n")).toBeNull();
    });

    it("should handle special characters in text", () => {
      expect(findToolByText("I use Claude! It's amazing.")).toBe("claude");
      expect(findToolByText("Cursor??? Best editor ever!!!")).toBe("cursor");
      expect(findToolByText("v0.dev - rapid prototyping")).toBe("v0");
    });
  });

  describe("Real-world text scenarios", () => {
    it("should find tools in article-like content", () => {
      const articleText = `
        In today's AI coding landscape, developers have numerous options.
        GitHub Copilot remains popular for code completion, while Claude Code
        offers excellent analysis capabilities. Newer tools like Devin by
        Cognition AI are pushing the boundaries of autonomous coding.
        Meanwhile, Google's Gemini Code Assist provides strong competition.
      `;

      // Test finding different tools in the same text
      expect(findToolByText(articleText)).toBeTruthy();

      // Test specific tools can be found
      expect(findToolByText("GitHub Copilot remains popular")).toBe("github-copilot");
      expect(findToolByText("Claude Code offers excellent")).toBe("claude");
      expect(findToolByText("Devin by Cognition AI")).toBe("devin");
      expect(findToolByText("Gemini Code Assist provides")).toBe("gemini");
    });

    it("should handle common misspellings and variations", () => {
      expect(findToolByText("Github Copilot")).toBe("github-copilot"); // Different case
      // Known gap: CodeRabbit isn't in defaultToolMappings at all
      expect(findToolByText("Code Rabbit helps with reviews")).toBeNull();
      expect(findToolByText("I use Tab Nine for completion")).toBe("tabnine"); // Space in "tabnine"
    });

    it("should handle product announcements and news", () => {
      expect(findToolByText("OpenAI announces new ChatGPT Canvas features")).toBe("chatgpt");
      expect(findToolByText("Anthropic releases Claude Artifacts update")).toBe("claude");
      expect(findToolByText("Replit Agent now supports more languages")).toBe("replit-ai");
      expect(findToolByText("Amazon Q Developer (formerly CodeWhisperer)")).toBe(
        "amazon-codewhisperer"
      );
    });
  });
});
