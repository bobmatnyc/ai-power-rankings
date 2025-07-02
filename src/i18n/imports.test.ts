import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";

describe("i18n imports", () => {
  it("should have correct import extensions in middleware.ts", async () => {
    const middlewarePath = path.join(process.cwd(), "src/middleware.ts");
    const content = await fs.readFile(middlewarePath, "utf-8");
    
    // Server-side imports should have .js extension
    expect(content).toContain('from "./i18n/config.js"');
    expect(content).toContain('from "@/auth.js"');
    expect(content).toContain('from "@/lib/auth-config.js"');
    
    // Should not have imports without .js extension
    expect(content).not.toContain('from "./i18n/config"');
    expect(content).not.toContain('from "@/auth"');
    expect(content).not.toContain('from "@/lib/auth-config"');
  });

  it("should have correct import extensions in auth.ts", async () => {
    const authPath = path.join(process.cwd(), "src/auth.ts");
    const content = await fs.readFile(authPath, "utf-8");
    
    // Server-side imports should have .js extension
    expect(content).toContain('from "@/lib/auth-config.js"');
    
    // Should not have imports without .js extension
    expect(content).not.toContain('from "@/lib/auth-config"');
  });

  it("should NOT have .js extensions in client components", async () => {
    const pagePath = path.join(process.cwd(), "src/app/[lang]/page.tsx");
    const content = await fs.readFile(pagePath, "utf-8");
    
    // Client-side imports should NOT have .js extension
    expect(content).toContain('from "@/i18n/config"');
    expect(content).toContain('from "@/i18n/get-dictionary"');
    
    // Should not have imports with .js extension
    expect(content).not.toContain('from "@/i18n/config.js"');
    expect(content).not.toContain('from "@/i18n/get-dictionary.js"');
  });

  it("should export required items from i18n config", async () => {
    const configPath = path.join(process.cwd(), "src/i18n/config.ts");
    const content = await fs.readFile(configPath, "utf-8");
    
    // Check required exports
    expect(content).toContain("export const i18n");
    expect(content).toContain("export const locales");
    expect(content).toContain("export type Locale");
  });

  it("should have all required dictionary files", async () => {
    const locales = ["en", "de", "fr", "it", "ja", "ko", "uk", "hr", "zh"];
    const dictPath = path.join(process.cwd(), "src/i18n/dictionaries");
    
    for (const locale of locales) {
      const filePath = path.join(dictPath, `${locale}.json`);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists, `${locale}.json should exist`).toBe(true);
    }
  });

  it("should have matching locales in config and dictionary files", async () => {
    const configPath = path.join(process.cwd(), "src/i18n/config.ts");
    const configContent = await fs.readFile(configPath, "utf-8");
    
    // Extract locales array from config
    const localesMatch = configContent.match(/locales:\s*\[(.*?)\]/);
    expect(localesMatch).not.toBeNull();
    
    if (localesMatch && localesMatch[1]) {
      const localesStr = localesMatch[1];
      const configLocales = localesStr
        .split(",")
        .map(l => l.trim().replace(/['"]/g, ""))
        .filter(l => l.length > 0);
      
      // Check each locale has a dictionary file
      const dictPath = path.join(process.cwd(), "src/i18n/dictionaries");
      for (const locale of configLocales) {
        const filePath = path.join(dictPath, `${locale}.json`);
        const exists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(exists, `Dictionary file for locale '${locale}' should exist`).toBe(true);
      }
    }
  });
});