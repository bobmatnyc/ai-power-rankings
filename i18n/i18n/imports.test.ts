import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Re-enabled for #76 (bit-rotted before vitest was wired, #10).
//
// This file lives inside `i18n/i18n/`, a duplicate copy of the real `i18n/`
// tree that has existed since the initial commit but is never imported by
// any app code (verified via grep: no `i18n/i18n` reference exists outside
// this directory). Every original assertion here targeted a `src/`-based
// layout (`src/middleware.ts`, `src/auth.ts`, `src/app/[lang]/page.tsx`,
// `src/i18n/config.ts`) that has never existed in this repo — this app has
// always used a root-level layout (`middleware.ts`, `app/[lang]/page.tsx`,
// `i18n/config.ts`). The suite could never have passed as written.
//
// Fix applied: repoint the assertions at the real, current root-level files
// so the suite verifies the actual import-extension convention it was meant
// to protect, instead of files that don't exist. One assertion (an `auth.ts`
// import check) was dropped rather than reinvented: there is no single
// `auth.ts` in this codebase, and the closest candidate, `lib/auth-config.ts`,
// turned out to be dead code (unused outside this test) — not something worth
// fabricating a check for. The duplicate `i18n/i18n/` directory itself is out
// of scope for this test-only change and is flagged separately for a
// follow-up cleanup issue.
describe("i18n imports", () => {
  it("should have correct import extensions in middleware.ts", async () => {
    const middlewarePath = path.join(process.cwd(), "middleware.ts");
    const content = await fs.readFile(middlewarePath, "utf-8");

    // Server-side imports should NOT have .js extension (project convention)
    expect(content).toContain('from "@clerk/nextjs/server"');
    expect(content).toContain('from "next/server"');

    // No import specifier in this file should carry a .js extension
    const importSpecifiers = [...content.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(importSpecifiers.length).toBeGreaterThan(0);
    for (const specifier of importSpecifiers) {
      expect(specifier).not.toMatch(/\.js$/);
    }
  });

  it("should NOT have .js extensions in client components", async () => {
    const pagePath = path.join(process.cwd(), "app/[lang]/page.tsx");
    const content = await fs.readFile(pagePath, "utf-8");

    // Client-side imports should NOT have .js extension
    expect(content).toContain('from "@/i18n/config"');
    expect(content).toContain('from "@/i18n/get-dictionary"');

    // Should not have imports with .js extension
    expect(content).not.toContain('from "@/i18n/config.js"');
    expect(content).not.toContain('from "@/i18n/get-dictionary.js"');
  });

  it("should export required items from i18n config", async () => {
    const configPath = path.join(process.cwd(), "i18n/config.ts");
    const content = await fs.readFile(configPath, "utf-8");

    // Check required exports
    expect(content).toContain("export const i18n");
    expect(content).toContain("export const locales");
    expect(content).toContain("export type Locale");
  });

  it("should have all required dictionary files", async () => {
    const configPath = path.join(process.cwd(), "i18n/config.ts");
    const configContent = await fs.readFile(configPath, "utf-8");
    const localesMatch = configContent.match(/locales:\s*\[(.*?)\]/);
    expect(localesMatch).not.toBeNull();

    const locales = (localesMatch?.[1] ?? "")
      .split(",")
      .map((l) => l.trim().replace(/['"]/g, ""))
      .filter((l) => l.length > 0);
    expect(locales.length).toBeGreaterThan(0);

    const dictPath = path.join(process.cwd(), "i18n/dictionaries");

    for (const locale of locales) {
      const filePath = path.join(dictPath, `${locale}.json`);
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists, `${locale}.json should exist`).toBe(true);
    }
  });

  it("should have matching locales in config and dictionary files", async () => {
    const configPath = path.join(process.cwd(), "i18n/config.ts");
    const configContent = await fs.readFile(configPath, "utf-8");

    // Extract locales array from config
    const localesMatch = configContent.match(/locales:\s*\[(.*?)\]/);
    expect(localesMatch).not.toBeNull();

    if (localesMatch?.[1]) {
      const localesStr = localesMatch[1];
      const configLocales = localesStr
        .split(",")
        .map((l) => l.trim().replace(/['"]/g, ""))
        .filter((l) => l.length > 0);

      // Check each locale has a dictionary file
      const dictPath = path.join(process.cwd(), "i18n/dictionaries");
      for (const locale of configLocales) {
        const filePath = path.join(dictPath, `${locale}.json`);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        expect(exists, `Dictionary file for locale '${locale}' should exist`).toBe(true);
      }
    }
  });
});
