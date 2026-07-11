import { describe, expect, it } from "vitest";
import { ArticlesEntitiesService } from "./articles-entities.service";

/**
 * Guards for auto-tool creation (issue #79). These pin the taxonomy-gating
 * behavior so pruned noise (issue #80) cannot silently regrow via ingestion.
 * getAutoToolRejectionReason is pure/static, so it is tested without a DB.
 */
describe("ArticlesEntitiesService.getAutoToolRejectionReason", () => {
  const base = { name: "Cool Tool", slug: "cool-tool", category: "code-assistant" };

  it("accepts a valid tool in an allowlisted category", () => {
    expect(ArticlesEntitiesService.getAutoToolRejectionReason(base)).toBeNull();
  });

  it("accepts every allowlisted category", () => {
    const cats = [
      "code-editor", "code-assistant", "code-completion", "code-generation",
      "code-review", "autonomous-agent", "ide-assistant", "proprietary-ide",
      "app-builder", "open-source-framework", "testing-tool", "devops-assistant",
    ];
    for (const category of cats) {
      expect(
        ArticlesEntitiesService.getAutoToolRejectionReason({ ...base, category })
      ).toBeNull();
    }
  });

  it("rejects noise categories (other/llm/chat)", () => {
    for (const category of ["other", "llm", "chat"]) {
      expect(
        ArticlesEntitiesService.getAutoToolRejectionReason({ ...base, category })
      ).toContain("not in allowlist");
    }
  });

  it("rejects blocklisted slugs from the deletion report", () => {
    for (const slug of ["playwright", "apache-iceberg", "tower-python-sdk", "vib-os", "gws", "potpie"]) {
      expect(
        ArticlesEntitiesService.getAutoToolRejectionReason({ ...base, slug })
      ).toContain("blocklisted");
    }
  });

  it("rejects the known garbage possessive entity", () => {
    expect(
      ArticlesEntitiesService.getAutoToolRejectionReason({
        name: "Anthropic's Claude Agent",
        slug: "anthropic-s-claude-agent",
        category: "autonomous-agent",
      })
    ).not.toBeNull();
  });

  it("rejects possessive slug fragments via structural pattern", () => {
    expect(
      ArticlesEntitiesService.getAutoToolRejectionReason({
        name: "OpenAI's Agent",
        slug: "openai-s-agent",
        category: "autonomous-agent",
      })
    ).toMatch(/invalid entity pattern|blocklisted/);
  });

  it("rejects slugs starting with an article", () => {
    expect(
      ArticlesEntitiesService.getAutoToolRejectionReason({
        name: "The New Agent",
        slug: "the-new-agent",
        category: "autonomous-agent",
      })
    ).toContain("invalid entity pattern");
  });

  it("rejects runaway multi-word descriptive phrases", () => {
    expect(
      ArticlesEntitiesService.getAutoToolRejectionReason({
        name: "Armadin autonomous cybersecurity agents platform",
        slug: "armadin-autonomous-cybersecurity-agents-platform",
        category: "autonomous-agent",
      })
    ).toContain("too many segments");
  });

  it("still allows legitimate 4-segment product slugs", () => {
    expect(
      ArticlesEntitiesService.getAutoToolRejectionReason({
        name: "GitLab Duo Agent Platform",
        slug: "gitlab-duo-agent-platform",
        category: "autonomous-agent",
      })
    ).toBeNull();
  });
});
