import { describe, expect, it } from "vitest";
import { ToolMapper } from "./services/article-ingestion.service";

// Re-enabled for #76 (bit-rotted before vitest was wired, #10). The
// tool-matcher cases were removed with lib/tool-matcher.ts (#109): news
// attribution now resolves against the tool catalogue, covered by
// tests/unit/news-tool-resolver-109.test.ts.
describe("Tool Detection Integration Tests", () => {
  describe("Required tool mappings from test scenarios", () => {
    it("should verify GPT-4 maps to ChatGPT Canvas", () => {
      expect(ToolMapper.normalizeTool("GPT-4")).toBe("ChatGPT Canvas");
      expect(ToolMapper.normalizeTool("gpt-4")).toBe("ChatGPT Canvas");
      expect(ToolMapper.normalizeTool("GPT-4o")).toBe("ChatGPT Canvas");
    });

    it("should verify Claude variations map to Claude Code", () => {
      expect(ToolMapper.normalizeTool("Claude")).toBe("Claude Code");
      expect(ToolMapper.normalizeTool("claude")).toBe("Claude Code");
      expect(ToolMapper.normalizeTool("Claude 3.5")).toBe("Claude Code");
    });

    it("should verify Replit maps to Replit Agent", () => {
      expect(ToolMapper.normalizeTool("Replit")).toBe("Replit Agent");
      expect(ToolMapper.normalizeTool("replit")).toBe("Replit Agent");
    });

    it("should verify Cognition maps to Devin", () => {
      expect(ToolMapper.normalizeTool("Cognition")).toBe("Devin");
      expect(ToolMapper.normalizeTool("cognition")).toBe("Devin");
      expect(ToolMapper.normalizeTool("Cognition AI")).toBe("Devin");
    });

    it("should verify Gemini maps to Google Gemini Code Assist", () => {
      expect(ToolMapper.normalizeTool("Gemini")).toBe("Google Gemini Code Assist");
      expect(ToolMapper.normalizeTool("gemini")).toBe("Google Gemini Code Assist");
    });

    it("should preserve unknown tools like GPT-5-Codex with fuzzy matching behavior", () => {
      // Note: GPT-5-Codex contains "Codex" which fuzzy matches to "OpenAI Codex CLI"
      expect(ToolMapper.normalizeTool("GPT-5-Codex")).toBe("OpenAI Codex CLI");

      // Truly unknown tools are preserved
      expect(ToolMapper.normalizeTool("Unknown Future Tool")).toBe("Unknown Future Tool");
    });
  });

  describe("Case insensitive matching", () => {
    it("should handle various case combinations", () => {
      expect(ToolMapper.normalizeTool("CLAUDE")).toBe("Claude Code");
      expect(ToolMapper.normalizeTool("gPt-4")).toBe("ChatGPT Canvas");
      expect(ToolMapper.normalizeTool("REPLIT")).toBe("Replit Agent");
      expect(ToolMapper.normalizeTool("GeMiNi")).toBe("Google Gemini Code Assist");
    });
  });

  describe("Multi-word variations", () => {
    it("should handle partial matches and multi-word tools", () => {
      expect(ToolMapper.normalizeTool("GitHub Copilot")).toBe("GitHub Copilot");
      expect(ToolMapper.normalizeTool("Copilot")).toBe("GitHub Copilot");
      expect(ToolMapper.normalizeTool("Amazon Q")).toBe("Amazon Q Developer");
      expect(ToolMapper.normalizeTool("CodeWhisperer")).toBe("Amazon Q Developer");
    });
  });

  describe("Fuzzy matching behavior", () => {
    it("should demonstrate fuzzy matching works for partial word matches", () => {
      // These show how fuzzy matching can sometimes produce unexpected results
      // due to partial word matching in the algorithm
      expect(ToolMapper.normalizeTool("CodeiumAI")).toBe("Claude Code"); // "code" substring match
      expect(ToolMapper.normalizeTool("Code Rabbit")).toBe("Claude Code"); // "code" word match

      // But direct aliases work as expected
      expect(ToolMapper.normalizeTool("Qodo")).toBe("Qodo Gen");
      expect(ToolMapper.normalizeTool("CodeRabbit")).toBe("CodeRabbit");
    });
  });

  describe("Edge cases and robustness", () => {
    it("should handle empty and invalid inputs gracefully", () => {
      expect(ToolMapper.normalizeTool("")).toBe("");
      expect(ToolMapper.normalizeTool(null as unknown as string)).toBe(null);
      expect(ToolMapper.normalizeTool(undefined as unknown as string)).toBe(undefined);
    });

    it("should handle whitespace and special characters", () => {
      expect(ToolMapper.normalizeTool("  Claude  ")).toBe("Claude Code");
      expect(ToolMapper.normalizeTool("\tGPT-4\n")).toBe("ChatGPT Canvas");
    });
  });

  describe("Tool mention processing in articles", () => {
    it("should normalize tool names in tool mentions array", () => {
      const mockMentions = [
        {
          tool: "GPT-4",
          context: "Using GPT-4 for code generation",
          sentiment: 0.8,
          relevance: 0.9,
        },
        {
          tool: "claude 3.5",
          context: "Claude 3.5 provides excellent analysis",
          sentiment: 0.7,
          relevance: 0.8,
        },
        {
          tool: "Replit",
          context: "Replit for rapid prototyping",
          sentiment: 0.6,
          relevance: 0.7,
        },
      ];

      const processed = ToolMapper.processToolMentions(mockMentions);

      expect(processed[0]?.tool).toBe("ChatGPT Canvas");
      expect(processed[1]?.tool).toBe("Claude Code");
      expect(processed[2]?.tool).toBe("Replit Agent");

      // Original context and scores should be preserved
      expect(processed[0]?.context).toBe("Using GPT-4 for code generation");
      expect(processed[0]?.sentiment).toBe(0.8);
      expect(processed[0]?.relevance).toBe(0.9);
    });
  });
});
